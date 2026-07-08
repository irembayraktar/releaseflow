-- ReleaseFlow: İş Talep ve Canlıya Alma Takip Uygulaması
-- Şemanın iki temel kararı:
-- 1) Durum geçişleri UI'da değil veritabanında zorlanır (status_transitions matrisi + trigger).
-- 2) "Kullanıcı sadece dahil olduğu projeyi görür" kuralı Row Level Security ile çözülür.

-- ---------------------------------------------------------------
-- Enum'lar
-- ---------------------------------------------------------------

create type project_status as enum (
  'yeni_talep',
  'inceleniyor',
  'gelistirmede',
  'test_bekliyor',
  'revize_gerekli',
  'test_uygun',
  'canliya_alma_bekliyor',
  'canliya_alindi',
  'kapatildi'
);

create type member_role as enum ('talep_sahibi', 'gelistirici', 'yonetici', 'testci');

create type project_priority as enum ('dusuk', 'orta', 'yuksek', 'kritik');

create type comment_kind as enum ('yorum', 'test_bildirimi', 'test_sonucu', 'revize_talebi');

-- ---------------------------------------------------------------
-- Profiller (auth.users'a 1-1; kayıt olunca trigger ile oluşur)
-- ---------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  department text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Projeler ve üyelik
-- ---------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) >= 10),
  expected_outcome text,
  status project_status not null default 'yeni_talep',
  priority project_priority not null default 'orta',
  requester_id uuid not null references profiles (id),
  developer_id uuid references profiles (id),
  manager_id uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  member_role member_role not null,
  created_at timestamptz not null default now(),
  -- Aynı kişi aynı projeye iki kez eklenemez.
  primary key (project_id, user_id)
);

-- RLS içinden üyelik kontrolü; security definer olması policy döngüsünü kırar.
create function public.is_member(p_project uuid, p_user uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project and user_id = p_user
  );
$$;

create function public.member_roles(p_project uuid, p_user uuid)
returns member_role[]
language sql
security definer set search_path = public
stable
as $$
  select coalesce(array_agg(member_role), '{}')
  from project_members
  where project_id = p_project and user_id = p_user;
$$;

-- Proje açılınca talep sahibi + atanan geliştirici/yönetici otomatik üye olur.
create function public.handle_new_project()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into project_members (project_id, user_id, member_role)
  values (new.id, new.requester_id, 'talep_sahibi')
  on conflict do nothing;

  if new.developer_id is not null then
    insert into project_members (project_id, user_id, member_role)
    values (new.id, new.developer_id, 'gelistirici')
    on conflict do nothing;
  end if;

  if new.manager_id is not null then
    insert into project_members (project_id, user_id, member_role)
    values (new.id, new.manager_id, 'yonetici')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger on_project_created
  after insert on projects
  for each row execute function public.handle_new_project();

-- ---------------------------------------------------------------
-- Durum makinesi: geçiş matrisi veri olarak tutulur
-- ---------------------------------------------------------------

create table status_transitions (
  from_status project_status not null,
  to_status project_status not null,
  allowed_roles member_role[] not null,
  primary key (from_status, to_status)
);

insert into status_transitions (from_status, to_status, allowed_roles) values
  ('yeni_talep',            'inceleniyor',           '{gelistirici,yonetici}'),
  ('inceleniyor',           'gelistirmede',          '{gelistirici}'),
  ('gelistirmede',          'test_bekliyor',         '{gelistirici}'),
  ('test_bekliyor',         'test_uygun',            '{testci}'),
  ('test_bekliyor',         'revize_gerekli',        '{testci}'),
  ('revize_gerekli',        'gelistirmede',          '{gelistirici}'),
  ('test_uygun',            'canliya_alma_bekliyor', '{yonetici}'),
  ('canliya_alma_bekliyor', 'canliya_alindi',        '{yonetici}'),
  ('canliya_alindi',        'kapatildi',             '{talep_sahibi,yonetici}');

create table status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  old_status project_status,
  new_status project_status not null,
  changed_by uuid not null references profiles (id),
  note text,
  created_at timestamptz not null default now()
);

-- Geçersiz geçiş veya yetkisiz rol veritabanı seviyesinde reddedilir.
create function public.enforce_status_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_roles member_role[];
  v_allowed member_role[];
begin
  if new.status = old.status then
    return new;
  end if;

  select allowed_roles into v_allowed
  from status_transitions
  where from_status = old.status and to_status = new.status;

  if v_allowed is null then
    raise exception 'GECERSIZ_GECIS: % -> % gecisi tanimli degil', old.status, new.status
      using errcode = 'P0001';
  end if;

  v_roles := member_roles(new.id, auth.uid());

  if not (v_roles && v_allowed) then
    raise exception 'YETKISIZ_GECIS: bu gecis icin % rollerinden biri gerekir', v_allowed
      using errcode = 'P0002';
  end if;

  insert into status_history (project_id, old_status, new_status, changed_by)
  values (new.id, old.status, new.status, auth.uid());

  new.updated_at := now();
  return new;
end;
$$;

create trigger on_project_status_change
  before update of status on projects
  for each row execute function public.enforce_status_transition();

-- ---------------------------------------------------------------
-- Yorum akışı, dosyalar, bildirimler
-- ---------------------------------------------------------------

create table comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  sender_id uuid not null references profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  kind comment_kind not null default 'yorum',
  created_at timestamptz not null default now()
);

create table files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  uploaded_by uuid not null references profiles (id),
  file_name text not null,
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10 * 1024 * 1024),
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Bildirim üretimi: durum değişince ilgili role bildirim düşer.
-- Mail yerine uygulama içi bildirim; mail entegrasyonu bilinçli olarak MVP sonrasına ertelendi.
create function public.notify_on_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_target member_role;
  v_title text;
begin
  if new.status = old.status then
    return new;
  end if;

  case new.status
    when 'test_bekliyor' then
      v_target := 'testci';
      v_title := 'Test etmeniz bekleniyor';
    when 'revize_gerekli' then
      v_target := 'gelistirici';
      v_title := 'Revize istendi';
    when 'test_uygun' then
      v_target := 'yonetici';
      v_title := 'Test uygun; canliya alma onayi bekleniyor';
    when 'canliya_alindi' then
      v_target := 'talep_sahibi';
      v_title := 'Is canliya alindi';
    else
      return new;
  end case;

  insert into notifications (user_id, project_id, title, body)
  select pm.user_id, new.id, v_title, new.title
  from project_members pm
  where pm.project_id = new.id
    and pm.member_role = v_target
    and pm.user_id <> auth.uid();

  return new;
end;
$$;

create trigger on_project_status_notify
  after update of status on projects
  for each row execute function public.notify_on_status_change();

-- Yeni iş atanan geliştiriciye bildirim.
create function public.notify_on_project_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.developer_id is not null and new.developer_id <> new.requester_id then
    insert into notifications (user_id, project_id, title, body)
    values (new.developer_id, new.id, 'Yeni is talebi atandi', new.title);
  end if;
  return new;
end;
$$;

create trigger on_project_created_notify
  after insert on projects
  for each row execute function public.notify_on_project_created();

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table status_transitions enable row level security;
alter table status_history enable row level security;
alter table comments enable row level security;
alter table files enable row level security;
alter table notifications enable row level security;

-- Profiller: kişi seçebilmek için tüm giriş yapmış kullanıcılara görünür.
create policy profiles_select on profiles
  for select to authenticated using (true);

create policy profiles_update_own on profiles
  for update to authenticated using (id = auth.uid());

-- Projeler: sadece üyeler görür; talep sahibi oluşturur; üyeler günceller
-- (durum geçişinin rol kontrolünü trigger yapar).
create policy projects_select on projects
  for select to authenticated using (is_member(id, auth.uid()));

create policy projects_insert on projects
  for insert to authenticated with check (requester_id = auth.uid());

create policy projects_update on projects
  for update to authenticated using (is_member(id, auth.uid()));

-- Üyelik: üyeler listeyi görür; talep sahibi ve yönetici kişi ekleyip çıkarır.
create policy members_select on project_members
  for select to authenticated using (is_member(project_id, auth.uid()));

create policy members_insert on project_members
  for insert to authenticated
  with check (member_roles(project_id, auth.uid()) && '{talep_sahibi,yonetici}'::member_role[]);

create policy members_delete on project_members
  for delete to authenticated
  using (member_roles(project_id, auth.uid()) && '{talep_sahibi,yonetici}'::member_role[]);

-- Geçiş matrisi herkese salt okunur (UI hangi butonları göstereceğini buradan öğrenir).
create policy transitions_select on status_transitions
  for select to authenticated using (true);

create policy history_select on status_history
  for select to authenticated using (is_member(project_id, auth.uid()));

create policy comments_select on comments
  for select to authenticated using (is_member(project_id, auth.uid()));

create policy comments_insert on comments
  for insert to authenticated
  with check (sender_id = auth.uid() and is_member(project_id, auth.uid()));

create policy files_select on files
  for select to authenticated using (is_member(project_id, auth.uid()));

create policy files_insert on files
  for insert to authenticated
  with check (uploaded_by = auth.uid() and is_member(project_id, auth.uid()));

create policy files_delete_own on files
  for delete to authenticated
  using (uploaded_by = auth.uid());

create policy notifications_select on notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update on notifications
  for update to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------
-- Storage: proje dosyaları bucket'ı ve erişim kuralları
-- Dosya yolu kuralı: {project_id}/{dosya_adi}
-- ---------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files', 'project-files', false, 10485760,
  array['image/png','image/jpeg','application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain']
);

create policy storage_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and is_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy storage_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and is_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy storage_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-files'
    and owner = auth.uid()
  );

-- ---------------------------------------------------------------
-- Dashboard özet görünümü (aggregate sorgu örneği)
-- ---------------------------------------------------------------

create view my_dashboard_counts
with (security_invoker = true)
as
select
  count(*) filter (where pm.member_role = 'gelistirici'
                   and p.status in ('yeni_talep','inceleniyor','gelistirmede','revize_gerekli')) as bana_atanan,
  count(*) filter (where pm.member_role = 'testci'
                   and p.status = 'test_bekliyor') as test_bekleyen,
  count(*) filter (where pm.member_role = 'yonetici'
                   and p.status in ('test_uygun','canliya_alma_bekliyor')) as onay_bekleyen,
  count(*) filter (where pm.member_role = 'talep_sahibi'
                   and p.status not in ('kapatildi')) as taleplerim
from projects p
join project_members pm on pm.project_id = p.id
where pm.user_id = auth.uid();
