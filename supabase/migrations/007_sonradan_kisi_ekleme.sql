-- 007: İşe sonradan kişi ekleme ve bildirim sadeleştirmesi
-- Talep yalnız yöneticiyle açılabilir; yönetici (veya talep sahibi) iş
-- sayfasından geliştirici/testçi/yönetici ekler (RLS zaten izin veriyor).
-- Bildirim artık üyelik eklenme anında üretilir: ister talep açılırken
-- ister sonradan eklensin, kişi aynı şekilde haberdar olur.

drop trigger if exists on_project_created_notify on projects;
drop function if exists public.notify_on_project_created();

create function public.notify_on_member_added()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Kendini ekleyen (örn. talep sahibi) bildirim almaz.
  -- Davet dönüşümünde (kayıt anında auth.uid() boştur) bildirim düşer.
  if new.user_id is distinct from auth.uid() then
    insert into notifications (user_id, project_id, title, body)
    select new.user_id, new.project_id, 'Bir ise eklendiniz', p.title
    from projects p
    where p.id = new.project_id;
  end if;

  return new;
end;
$$;

create trigger on_member_added
  after insert on project_members
  for each row execute function public.notify_on_member_added();
