# ReleaseFlow

Talep → geliştirme → test → canlıya alma akışıyla çalışan ekiplerde mail üzerinden dağılan iş takibini tek merkezde toplayan uygulama.

## Problem

Geliştirme talepleri, test bildirimleri ve canlıya alma onayları ayrı mail zincirlerinde kayboluyor; hangi işin kimde olduğu ve hangi aşamada beklediği takip edilemiyor. Bu problemi SAP/ABAP geliştirme süreçlerinde bizzat yaşadım; uygulama, aynı onay akışıyla çalışan her ekipte (kurumsal yazılım, iç araçlar, ajans işleri) kullanılabilecek şekilde tasarlandı.

## Çözüm

Her talep bir iş kaydı olarak açılır; ilgili kişiler (talep sahibi, geliştirici, test kullanıcısı, yönetici) işe eklenir. Tüm yorumlar, dosyalar ve durum değişiklikleri iş altında izlenebilir şekilde saklanır. İş, kurallı bir durum makinesinden geçer:

```text
Yeni Talep → İnceleniyor → Geliştirmede → Test Bekliyor → { Test Uygun | Revize Gerekli }
Revize Gerekli → Geliştirmede (döngü)
Test Uygun → Canlıya Alma Bekliyor → Canlıya Alındı → Kapatıldı
```

<!-- TODO: Ekran görüntüsü / demo GIF (seed verisiyle dolu dashboard) -->

## Teknik Kararlar

- **Durum geçişleri veritabanında zorlanır.** Geçiş matrisi `status_transitions` tablosunda veri olarak durur; bir Postgres trigger'ı hem geçişin tanımlı olduğunu hem de kullanıcının o projedeki rolünün geçişe yetkili olduğunu doğrular. UI ne gösterirse göstersin, geçersiz geçiş kayda geçemez.
- **"Kullanıcı sadece dahil olduğu işi görür" kuralı Row Level Security ile çözülür.** Yetki kontrolü uygulama koduna değil veritabanı politikalarına yaslanır; dosya erişimi de aynı üyelik fonksiyonunu kullanan Storage politikalarıyla korunur.
- **Her durum değişikliği `status_history` tablosuna otomatik yazılır** (audit izi) ve ilgili role uygulama içi bildirim üretir.
- **Mail bildirimi bilinçli olarak MVP dışı bırakıldı**; aynı bilgiyi uygulama içi bildirim taşıyor. Dış servise bağımlılık eklemeden akış uçtan uca çalışıyor. <!-- trade-off cümlesi -->

## Kurulum

1. [Supabase](https://supabase.com) üzerinde yeni bir proje oluşturun.
2. SQL Editor'de `supabase/migrations/001_schema.sql` dosyasını çalıştırın.
3. `.env.example` dosyasını `.env` olarak kopyalayıp proje URL'i ve anon key'i girin.
4. Bağımlılıkları kurup başlatın:

```bash
npm install
npm run dev
```

## Demo Akışı

<!-- TODO: 2 dakikalık demo senaryosu (talep aç → geliştirmeye al → test bildirimi → test sonucu → canlıya alma onayı) -->

## Bilinen Sınırlar ve Sonraki Adımlar

- Mail bildirimi (Resend) — MVP sonrası ilk aday
- Gelişmiş filtreleme ve arama
- Kurumsal domain kısıtı ile kayıt sınırlandırma
