-- 002: Test onay/red akışı iyileştirmesi
-- 1) Talep sahibi de test sonucunu onaylayabilir/reddedebilir (matris verisi güncellenir).
-- 2) Red (revize) durumunda neden zorunludur ve status_history.note alanına yazılır.

-- Talep sahibine test_bekliyor durumundaki geçişler için yetki ver.
update status_transitions
set allowed_roles = allowed_roles || '{talep_sahibi}'::member_role[]
where from_status = 'test_bekliyor'
  and not allowed_roles @> '{talep_sahibi}'::member_role[];

-- Durum değişikliği artık bu fonksiyonla yapılır; not, aynı transaction
-- içindeki trigger'a transaction-local ayar üzerinden aktarılır.
create or replace function public.change_project_status(
  p_project uuid,
  p_to project_status,
  p_note text default null
)
returns void
language plpgsql
security invoker set search_path = public
as $$
begin
  perform set_config('app.status_note', coalesce(p_note, ''), true);
  update projects set status = p_to where id = p_project;
  if not found then
    raise exception 'IS_BULUNAMADI: is yok veya erisim yetkiniz yok'
      using errcode = 'P0004';
  end if;
end;
$$;

-- Trigger güncellenir: revize geçişinde neden zorunlu, not geçmişe yazılır.
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

  insert into status_history (project_id, old_status, new_status, changed_by, note)
  values (new.id, old.status, new.status, auth.uid(), v_note);

  new.updated_at := now();
  return new;
end;
$$;
