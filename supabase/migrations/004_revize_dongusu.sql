-- 004: Revize edilen iş tam döngüye girer
-- Revize istenen iş, ilk açılan iş gibi önce "İnceleniyor"a alınabilir;
-- oradan mevcut zincir işler: inceleniyor -> gelistirmede -> test_bekliyor -> ...
-- (revize_gerekli -> gelistirmede geçişi de duruyor; geliştirici direkt başlayabilir.)

insert into status_transitions (from_status, to_status, allowed_roles)
values ('revize_gerekli', 'inceleniyor', '{gelistirici,yonetici}')
on conflict do nothing;
