-- 005: Geliştirici de canlıya alma sürecini yürütebilir
-- (test_uygun -> canliya_alma_bekliyor ve canliya_alma_bekliyor -> canliya_alindi
-- geçişlerine gelistirici rolü eklenir; yönetici yetkisi de durur.)

update status_transitions
set allowed_roles = allowed_roles || '{gelistirici}'::member_role[]
where from_status in ('test_uygun', 'canliya_alma_bekliyor')
  and not allowed_roles @> '{gelistirici}'::member_role[];
