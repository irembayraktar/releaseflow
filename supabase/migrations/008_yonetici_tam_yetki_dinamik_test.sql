-- 008: Yönetici her aşamada yetkili + dinamik test kuralı
-- 1) Yönetici, test adımı hariç tüm geçişlere eklenir (test zaten koşullu).
-- 2) Test geçişleri (test_bekliyor -> test_uygun / revize_gerekli):
--    işte testçi VARSA matristeki roller geçerli (testçi + talep sahibi);
--    testçi YOKSA geliştirici ve yönetici de test sonucunu girebilir.
--    Kural trigger'da uygulanır; yetki projenin ekibine göre dinamiktir.

update status_transitions
set allowed_roles = allowed_roles || '{yonetici}'::member_role[]
where from_status <> 'test_bekliyor'
  and not allowed_roles @> '{yonetici}'::member_role[];

-- 3) Testçi yalnızca test yapar: test adımı dışındaki tüm geçişlerden
--    testci rolü çıkarılır (006'da canlıya alma adımlarına eklenmişti).
update status_transitions
set allowed_roles = array_remove(allowed_roles, 'testci'::member_role)
where from_status <> 'test_bekliyor'
  and allowed_roles @> '{testci}'::member_role[];

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

  -- Dinamik test kuralı: projede testçi yoksa geliştirici ve yönetici
  -- de test sonucunu girebilir; testçi varsa matris (testçi + talep sahibi) geçerli.
  if old.status = 'test_bekliyor' and not exists (
    select 1 from project_members
    where project_id = new.id and member_role = 'testci'
  ) then
    v_allowed := v_allowed || '{gelistirici,yonetici}'::member_role[];
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

  if old.status = 'kapatildi' then
    new.archived_at := null;
  end if;

  insert into status_history (project_id, old_status, new_status, changed_by, note)
  values (new.id, old.status, new.status, auth.uid(), v_note);

  new.updated_at := now();
  return new;
end;
$$;
