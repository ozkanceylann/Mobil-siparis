# Sipariş Takip

Satıcıların kendi siparişlerini telefondan takip ettiği, ana ekrana eklenebilen uygulama.

## Özellikler

- Telefon numarası ve kişisel şifreyle giriş.
- Satıcıya ait siparişler, durum filtreleri ve hızlı arama.
- Bekleyen siparişlerde müşteri, adres, ürün ve tutar düzenleme.
- Diğer aşamalarda sipariş ve kargo bilgilerini görüntüleme.
- Android ve iPhone için ana ekrana ekleme desteği.
- Yönetici bölümünden satıcı hesabı açma ve şifre yenileme.

## Kullanım

Yönetici girişinden hesabınızı açın. İlgili satıcı telefonunu doğrulayarak kişisel şifre belirleyin. Satıcı telefon numarası ve bu şifreyle giriş yapabilir.

Android Chrome menüsünden veya iPhone Safari paylaşım menüsünden **Ana ekrana ekle** seçeneğini kullanın.

## Yayın

GitHub Pages kaynağını **GitHub Actions** seçin. Ana dala gönderilen değişiklikler otomatik yayınlanır.

## Yerelde çalıştırma

`python -m http.server 8765` ardından `http://localhost:8765` adresini açın.

İstemci ayarları `config.js` dosyasındadır. Yalnızca tarayıcıda kullanılabilen yayınlanabilir/anon anahtar kullanılmalıdır. Sunucuya özel anahtarlar istemciye eklenmemelidir.

## Kontroller

`npm run check` JavaScript sözdizimini kontrol eder. `npm install`, `npx playwright install chromium` ve `npm run test:mobile` ile örnek yanıtlar üzerinden mobil arayüz akışları kontrol edilir.

Üçüncü taraf lisansları: `THIRD_PARTY_NOTICES.md`.
