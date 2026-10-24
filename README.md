# 🪙 VEXORA - Discord Ekonomi Botu & Canlı Web Casino v1

<div align="center">
  <img src="https://img.shields.io/badge/Discord.js-v14.16.3-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="discord.js" />
  <img src="https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="node.js" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="express" />
  <img src="https://img.shields.io/badge/Platform-Web%20%26%20Discord-f59e0b?style=for-the-badge" alt="platform" />
</div>

<br/>

**Vexora**, Discord toplulukları için geliştirilmiş; Discord komutlarının yanı sıra **canlı fizik motoruna sahip 8 farklı web kumar oyunu, interaktif borsa & yatırım terminali ve tam donanımlı mağaza paneli** sunan yeni nesil bir ekonomi & casino ekosistemidir.

Oyuncular Discord'daki cüzdan bakiyeleriyle doğrudan web arayüzüne giriş yapabilir, anlık canlı oyunları oynayabilir ve büyük kazançlar sunucunun canlı durum kanalına otomatik olarak düşer.

---

## 🎮 1. İnteraktif Web Casino Oyunları (8 Oyun)

Stake & Roobet tarzı modern koyu neon tema, özel fizik motoru ve mobil uyumlu gövde mimarisi:

1. **🚀 Crash Arena:** Çarpan saniyeler içinde yükselir; roket infilak etmeden önce parayı nakit çekme oyunu.
2. **🟢 Plinko Pyramid:** 12 sıralı piramidin tepesinden bırakılan bilyenin çubuklardan sekerek çarpan kovalarına (110x'e kadar) düşüş simülasyonu.
3. **🎡 Avrupa Ruleti (0 - 36):** Klasik Fransız & Avrupa masası; düz sayılar (36x), Kırmızı/Siyah, Tek/Çift ve 1-12/13-24/25-36 bölgeleri.
4. **🎨 Klasik Çark (Wheel):** Kırmızı (2x), Siyah (2x) ve Yeşil (20x) jackpotlu canlı animasyonlu çark.
5. **🏰 Kule Tırmanışı (Towers):** 8 katlı gökdelende her katta mayına basmadan tepeye tırmanma oyunu.
6. **🎱 Altın Keno (Loto):** 1-40 arasından sayı seçip altın topların çekilişini izleyerek 1000x'e varan ikramiyeyi kazanma oyunu.
7. **🎯 Limbo Rocket:** Kendi belirlediğiniz hedef çarpana (1.05x - 1000x) göre roketi ateşleme oyunu.
8. **🐔 Chicken Road:** Vızır vızır geçen arabalara çarpmadan tavuğu 8 şeritten geçirip karşı kaldırıma ulaştırma oyunu.

---

## 📈 2. Canlı Borsa & Yatırım Terminali

* **Canlı Varlıklar:** Dolar (USD), Altın (ALTIN), Bitcoin (BTC) ve Vexora Coin (VEX).
* **Otomatik Dalgalanma:** Belirli periyotlarda piyasa matematiksel dalgalanır; dipten alıp tepeden satarak servet katlama imkânı.
* **Canlı Portföy:** Sahip olunan varlıklar, maliyetler ve kâr/zarar dökümü.

---

## 🛍️ 3. Discord & Web Mağazası

* **Meslek Rolleri:** Çiftçi, Doktor, Pilot, Şirket Sahibi gibi unvanlar (`/çalış` gelirini katlar).
* **İşletmeler (Pasif Gelir):** Kahve Otomatı, Kiralık Daire, Kripto Madenciliği, AVM, Holding (Seviye 1-5 yükseltilebilir, `/topla` ile hasılat alınır).
* **Büyülü Tılsımlar:** Bereket, Şans ve Koruma tılsımları.
* **Evlilik Yüzükleri & Sosyal Sistem:** Gümüş, Altın, Zümrüt, Elmas evlilik yüzükleri ve evlilik bonusları.

---

## 📢 4. Canlı Durum & Büyük Kazanç Akışı (Anti-Spam)

* Oyuncular web'de veya Discord komutlarında **büyük bir vurgun (1.500 🪙+ veya 2.5x+ çarpan)** yaptığında sunucunun canlı durum kanalına şık bir tebrik kartı atılır.
* **Sunucu Koruma Mimarisi:** Küçük kazançlar elenir, mesajlar hız limiti kuyruğu (throttling) ile aralıklı gönderilir; sunucuyu veya botu asla yormaz.

---

## ⚙️ Kurulum & Çalıştırma

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/MrCaniwes/Vexora-Ekonomi.git
cd Vexora-Ekonomi
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Çevresel Değişkenleri (.env) Ayarlayın
`.env.example` dosyasını `.env` olarak kopyalayın ve bilgilerinizi doldurun:
```ini
DISCORD_TOKEN=botunuzun_tokeni
CLIENT_ID=botunuzun_client_id
CLIENT_SECRET=botunuzun_oauth2_secret
GUILD_ID=sunucunuzun_id

# Kanallar
BORSA_KANAL_ID=borsa_kanali_id
CANLI_DURUM_KANAL_ID=canli_durum_kanali_id

# Web
PORT=3162
DOMAIN=https://vexora.siteniz.com
```

### 4. Discord Geliştirici Portalında Redirect URI Ekleyin
Discord Developer Portal -> Botunuz -> **OAuth2** -> **Redirects** kısmına şunu ekleyin:
```text
https://DOMAIN_ADRESINIZ/api/auth/callback
```

### 5. Botu Başlatın
```bash
node index.js
```

---

## 📜 Komut Listesi

| Komut | Açıklama |
| :--- | :--- |
| `/çalış` | Mesleğinize göre para kazanırsınız (Pasif gelir & seviye bonusları). |
| `/bakiye` | Cüzdan nakit para ve toplam servet durumunuzu gösterir. |
| `/profil` | Kariyer, işletmeler, evlilik ve servet kartınızı listeler. |
| `/zenginler` | Sunucunun en zengin balinalarını sıralar. |
| `/mağaza` | Meslek, işletme, tılsım ve yüzük satın alırsınız. |
| `/yükselt` | İşletmelerinizi seviye 5'e kadar yükseltir. |
| `/topla` | İşletmelerde biriken hasılatı toplarsınız. |
| `/transfer` | Başka bir üyeye nakit para gönderirsiniz. |
| `/borsa` | Borsa alım-satım ve portföy menüsünü açar. |
| `/canlidurum-ayarla` | Büyük kazançların gideceği bildirim kanalını belirler. |
| `/slot`, `/blackjack`, `/mines`, `/coinflip`, `/highlow`, `/kazikazan`, `/atyarisi` | Discord içi şans oyunları. |

---

## 📄 Lisans
Bu proje özel olarak geliştirilmiştir. İzinsiz ticari amaçla dağıtılamaz.
Tüm hakları saklıdır © 2026 **Vexora Development Team**
