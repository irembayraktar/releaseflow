-- 009: Tamamlanan işi yeniden açma yetkisi yalnızca talep sahibinde
-- Revize ihtiyacını iş sahibi bilir; yönetici dahil diğer roller
-- tamamlanmış işi yeniden açamaz.

update status_transitions
set allowed_roles = '{talep_sahibi}'::member_role[]
where from_status = 'kapatildi' and to_status = 'revize_gerekli';
