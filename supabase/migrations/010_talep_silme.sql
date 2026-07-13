-- 010: Talep silme
-- Yanlış açılan talep, iş geliştirmeye alınmadan talep sahibi tarafından
-- silinebilir. İş başladıktan sonra silme yoktur: geçmiş (yorumlar, durum
-- kayıtları) izlenebilirlik için korunur; onun yerine kapatma/arşiv kullanılır.

create policy projects_delete on projects
  for delete to authenticated
  using (
    requester_id = auth.uid()
    and status in ('yeni_talep', 'inceleniyor')
  );
