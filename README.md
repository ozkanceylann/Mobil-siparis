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

## Mesajdan yeni sipariş (yalnız mobil)

Giriş yaptıktan sonra üstteki **Yeni sipariş** düğmesinden hazır WhatsApp mesajını yapıştırıp **Gönder**'e basın. Satıcı telefonu sunucuda oturumdan belirlenir. İşlem sırasında düğme kilitlenir; başarılı kayıtta sipariş numarası gösterilir. Eksik bilgilerde mesaj korunur ve düzeltme açıklaması görünür.

Gönderim kimliği sekme oturumunda korunur; sayfa yenilendiğinde aynı işlemin sonucu sorgulanır. Aynı kullanıcının aynı metni 10 dakika içinde yeniden göndermesi de mevcut işlemi döndürür. Mobil giriş, WhatsApp'ın telefon bazlı güncelleme yolunu kullanmaz; yeni sipariş oluşturur.

Sunucu sözleşmesi `supabase/sql/mobile-order-intake.sql`, n8n işçisi `n8n/mobile-order-intake.sdk.js` içindedir. Kuyruk özel şemada tutulur. Kullanıcılar yalnızca kendi gönderimlerini başlatıp sorgular; ayrıştırma ve kayıt RPC'leri yalnız hizmet rolüne açıktır. n8n webhook'u yalnızca kayıtlı bir isteği uyandırır; metin ve satıcı verisi kabul etmez. Zamanlayıcı bulunmaz; yalnız Gönder eylemiyle alınan istek işlenir. Bağlantı kesilirse kullanıcı aynı gönderimin sonucunu kontrol edebilir. WhatsApp sipariş akışı ve operasyon arayüzü ayrı kalır.

`npm run test:intake` mobil gönderim, çift tıklama, eksik bilgi, yanıt kaybı ve yenileme senaryolarını örnek API yanıtlarıyla sınar. `tests/mobile-order-intake.sql` veritabanı yetkilerini, tekilleştirmeyi ve gerçek kayıt yolunu geri alınan bir işlemde doğrular.
