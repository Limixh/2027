# YKS 2027 Takip

YKS 2027'ye hazırlanırken çalışmanı, denemelerini, konu ilerlemeni ve hatalarını takip eden; Claude destekli yapay zekâ koçu olan bir **Windows masaüstü uygulaması**.

> **Müfredat notu:** YKS 2027, mevcut (2018 tabanlı) müfredatla yapılacak **son** sınavdır. Maarif Modeli değişiklikleri 2028 YKS'den itibaren geçerli olur. Uygulamadaki 450+ konu bu yüzden mevcut YKS müfredatına göre hazırlandı.

## Özellikler

| Bölüm | Neler var |
|---|---|
| **Genel Bakış** | Sınava geri sayım, günlük hedef halkası, seri (🔥), son TYT/AYT netleri, tahmini puan, tekrarı gelen konular, en zayıf 5 konu |
| **Çalışma Takibi** | GitHub tarzı **Activity Heatmap** (son 12 ay ya da sınava kadar tüm yolculuk), pomodoro/kronometre, çalışma ekleme (ders, konu, soru sayısı, D/Y), günlük/haftalık/ders bazlı grafikler |
| **Denemeler** | TYT/AYT deneme girişi (D/Y/B → net otomatik), alanına göre AYT dersleri, **her yanlış/boşun hangi konudan ve hangi nedenle** (bilgi eksiği, dikkat, süre, yorum) olduğunu girme, net trend grafikleri, tahmini puan |
| **Konu Takibi** | Tüm TYT/AYT konuları; durum (başlanmadı → pekişti), öz güven, aralıklı tekrar hatırlatmaları, konu bazında çözülen soru ve deneme hataları |
| **Hata Analizi** | Hangi konularda yanlışın var: öncelik puanlı zayıf konu listesi, ders performans tablosu, hata türü dağılımı, otomatik içgörüler |
| **Hata Defteri** | Yanlış yaptığın soruları not al, "doğrusu/çıkardığım ders" yaz, kart modunda tekrar et |
| **AI Koç** | Claude'a bağlan; tüm verilerin otomatik özetlenip gönderilir. Deneme analizi, haftalık program, zayıf konu stratejisi... |
| **Ayarlar** | Alan (SAY/EA/SÖZ/DİL), hedef netler, OBP, sınav tarihi, tema (koyu/açık), yedek al/yükle, örnek veri |

Veriler bilgisayarında yerel olarak saklanır (`%APPDATA%/YKS 2027 Takip/yks-data.json`), her gün otomatik yedek alınır.

## Kurulum (Windows)

### Hazır kurulum dosyası
GitHub'da **Actions → Windows build** iş akışının son çalışmasından `YKS-2027-Takip-Windows` artifact'ini indir:
- `YKS 2027 Takip-1.0.0-x64.exe` → kurulum sihirbazı
- `YKS 2027 Takip-1.0.0-Portable.exe` → kurulumsuz, çift tıkla çalışır

(`v1.0.0` gibi bir etiket push edersen, dosyalar otomatik olarak bir GitHub Release'e de eklenir.)

> İmzasız bir uygulama olduğu için Windows SmartScreen "Windows bilgisayarınızı korudu" uyarısı gösterebilir: **Ek bilgi → Yine de çalıştır**.

### Kaynaktan derleme
[Node.js 22](https://nodejs.org) kurulu olmalı.

```bash
npm install
npm run dev          # geliştirme modunda çalıştır
npm run dist:win     # release/ klasörüne Windows kurulum dosyası üretir
```

## AI Koç'u bağlama (Claude)

### A) Claude aboneliğinle (Pro/Max) — önerilen, ek ücret yok
Uygulama, bilgisayarına kurulu **Claude Code**'u arka planda çalıştırır; Claude Code senin abonelik girişini kullanır.

1. Başlat menüsünden **PowerShell**'i aç, şunu yapıştırıp Enter'a bas:
   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```
2. PowerShell'i kapatıp yeniden aç, `claude` yaz, Enter'a bas ve açılan tarayıcıda Claude hesabınla giriş yap.
3. Uygulamada **AI Koç → Bağlantıyı kontrol et**. Hazır.

Model menüsünden Opus 5.5 / Sonnet 5.5 / Haiku 5.5 seçebilirsin (aboneliğinin izin verdiği kadarıyla). Kullanım, aboneliğinin limitlerinden düşer.

### B) Kurulumsuz: claude.ai'ye kopyala-yapıştır
AI Koç sayfasında bir soruya tıkla → verilerin panoya kopyalanır ve claude.ai açılır → mesaj kutusuna **Ctrl+V**, Enter.

### C) API anahtarı (abonelikten ayrı ücretli)
Ayarlar → Yapay Zeka → "API anahtarı" seçip [console.anthropic.com](https://console.anthropic.com/settings/keys)'dan aldığın anahtarı gir.

**Bağlam** (👁) düğmesiyle Claude'a tam olarak hangi verilerin gönderildiğini görebilirsin.

## Puan tahmini hakkında
Puan tahminleri geçmiş yılların ortalama katsayılarına dayanan **yaklaşık** değerlerdir (ham puan + OBP × 0,12). ÖSYM'nin gerçek hesaplaması o yılın standart sapmalarına bağlıdır.

## Teknik
Electron · React 19 · TypeScript · Tailwind CSS · Zustand · Recharts · Anthropic TypeScript SDK

```
src/main       Electron ana süreç (pencere, veri dosyası, Claude API)
src/preload    Güvenli IPC köprüsü
src/renderer   Arayüz (React)
  src/data/curriculum.ts   TYT/AYT müfredatı
  src/lib                  veri deposu, net/puan hesapları, istatistik, AI bağlamı
  src/pages                sayfalar
src/shared     ortak tipler
```

Tarayıcıda arayüzü denemek için (AI hariç): `npm run web`.
