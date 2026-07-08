-- 003: Arşivleme ve tamamlanan işi yeniden açma
-- Modelleme kararı: arşiv bir iş akışı durumu değil görünürlük bayrağıdır
-- (archived_at kolonu); yeniden açma ise gerçek bir durum geçişidir
-- (kapatildi -> revize_gerekli, neden zorunlu kuralı otomatik uygulanır).

alter table projects add column archived_at timestamptz;

-- Yeniden açma geçişi: talep sahibi (veya yönetici) tamamlanan işte revize ister.
insert into status_transitions (from_status, to_status, allowed_roles)
values ('kapatildi', 'revize_gerekli', '{talep_sahibi,yonetici}')
on conflict do nothing;

-- Arşiv kuralları veritabanında zorlanır:
-- sadece tamamlanmış iş arşivlenir; sadece talep sahibi/yönetici arşivler.
create function public.enforce_archive()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_roles member_role[];
begin
  if new.archived_at is distinct from old.archived_at then
    v_roles := member_roles(new.id, auth.uid());

    if not (v_roles && '{talep_sahibi,yonetici}'::member_role[]) then
      raise exception 'YETKISIZ_ARSIV: arsivleme icin talep sahibi veya yonetici olmalisiniz'
        using errcode = 'P0005';
    end if;

    if new.archived_at is not null and new.status <> 'kapatildi' then
      raise exception 'ARSIV_KURALI: sadece tamamlanmis is arsivlenebilir'
        using errcode = 'P0006';
    end if;
  end if;

  return new;
end;
$$;

create trigger on_project_archive
  before update of archived_at on projects
  for each row execute function public.enforce_archive();

-- Durum geçiş trigger'ı: tamamlanmış iş yeniden açılırsa arşivden de çıkar.
create or replace function public.enforce_status_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_roles member_role[];
  v_allowed member_role[];
  v_note text;
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

  v_note := nullif(trim(coalesce(current_setting('app.status_note', true), '')), '');

  if new.status = 'revize_gerekli' and v_note is null then
    raise exception 'NEDEN_GEREKLI: revize istemek icin neden yazilmali'
      using errcode = 'P0003';
  end if;

  -- Yeniden açılan iş arşivde kalamaz.
  if old.status = 'kapatildi' then
    new.archived_at := null;
  end if;

  insert into status_history (project_id, old_status, new_status, changed_by, note)
  values (new.id, old.status, new.status, auth.uid(), v_note);

  new.updated_at := now();
  return new;
end;
$$;

-- Bildirimler: yeniden açılan iş geliştirici VE yöneticinin önüne düşer.
create or replace function public.notify_on_status_change()
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

  if old.status = 'kapatildi' and new.status = 'revize_gerekli' then
    insert into notifications (user_id, project_id, title, body)
    select pm.user_id, new.id, 'Is yeniden acildi: revize istendi', new.title
    from project_members pm
    where pm.project_id = new.id
      and pm.member_role in ('gelistirici', 'yonetici')
      and pm.user_id <> auth.uid();
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
