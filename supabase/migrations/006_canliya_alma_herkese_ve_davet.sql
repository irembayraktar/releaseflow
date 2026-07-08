-- 006: Canlıya alma tüm rollere açılır + e-posta ile davet
-- 1) Gerçek süreçte canlıya almayı bazen talep sahibi yürütüyor;
--    bu iki geçiş tüm rollere açılır. Sıra kuralı korunur:
--    test onaylanmadan canlıya alma geçişi kimseye görünmez.
-- 2) Henüz kayıt olmamış kişiler talep oluşturulurken e-postayla davet
--    edilebilir; aynı e-postayla kayıt oldukları anda üyeliğe dönüşür.

update status_transitions
set allowed_roles = '{talep_sahibi,gelistirici,yonetici,testci}'::member_role[]
where from_status in ('test_uygun', 'canliya_alma_bekliyor');

create table invited_members (
  project_id uuid not null references projects (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  member_role member_role not null,
  invited_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);

alter table invited_members enable row level security;

create policy invited_select on invited_members
  for select to authenticated using (is_member(project_id, auth.uid()));

create policy invited_insert on invited_members
  for insert to authenticated
  with check (
    invited_by = auth.uid()
    and member_roles(project_id, auth.uid()) && '{talep_sahibi,yonetici}'::member_role[]
  );

create policy invited_delete on invited_members
  for delete to authenticated
  using (member_roles(project_id, auth.uid()) && '{talep_sahibi,yonetici}'::member_role[]);

-- Kayıt anında bekleyen davetler üyeliğe dönüşür.
create or replace function public.handle_new_user()
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

  insert into public.project_members (project_id, user_id, member_role)
  select i.project_id, new.id, i.member_role
  from public.invited_members i
  where lower(i.email) = lower(new.email)
  on conflict do nothing;

  delete from public.invited_members where lower(email) = lower(new.email);

  return new;
end;
$$;
