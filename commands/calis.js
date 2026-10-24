const { SlashCommandBuilder } = require('discord.js');
const { ecoDb, cooldownDb, userDb } = require('../utils/db');
const { successEmbed, warningEmbed } = require('../utils/embedUtils');
const { getKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');
const { checkTilsim } = require('../utils/tilsimUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('çalış')
        .setDescription('Çalışarak cüzdanınıza para kazanırsınız. (Belirli aralıklarla kullanılabilir)'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const cooldownKey = `calis_${userId}`; 
        
        const cooldownAmount = 10 * 60 * 1000; // 10 dakika
        const lastWork = cooldownDb.bul(cooldownKey);
        
        if (lastWork && Date.now() < lastWork + cooldownAmount) {
            const beklemeBitis = Math.floor((lastWork + cooldownAmount) / 1000);
            
            const uyari = warningEmbed(
                interaction.member,
                'Çok Yorgunsun!',
                `Mesaini yeni bitirdin ve şu an çok yorgunsun. **<t:${beklemeBitis}:t>** (<t:${beklemeBitis}:R>) tekrar çalışabilirsin.`
            );
            return interaction.reply({ embeds: [uyari] });
        }

        // Kullanıcının mesleğini kontrol et
        const envanter = userDb.bul(`envanter_${userId}`) || [];
        const meslek = envanter.find(e => e.kategori === 'meslekler');
        const meslekId = meslek ? meslek.id : 'issiz';

        // Temel Maaş Hesaplaması
        let temelMaas = Math.floor(Math.random() * (750 - 250 + 1)) + 250; // Mesleği olanlar için 250-750 arası
        
        if (meslekId === 'issiz') {
            temelMaas = Math.floor(Math.random() * (150 - 50 + 1)) + 50; // İşsizler için sürünme maaşı: 50-150 arası
        }

        let toplamBonusYuzdesi = 0;
        let bonusMesaji = '';
        
        // Meslek rollerindeki bonusları topla (Varsa)
        if (meslek && meslek.bonusYuzdesi) {
            toplamBonusYuzdesi += meslek.bonusYuzdesi;
        }

        let bonusPara = 0;
        if (toplamBonusYuzdesi > 0) {
            bonusPara = Math.floor(temelMaas * (toplamBonusYuzdesi / 100));
            bonusMesaji = `\n🌟 *Meslek Bonusu (+%${toplamBonusYuzdesi}):* **+${bonusPara} 🪙**`;
        }

        // Tılsım Bonusu (Bereket Tılsımı +%25)
        const bereket = checkTilsim(userId, 'gelir');
        let tilsimBonusPara = 0;
        if (bereket) {
            tilsimBonusPara = Math.floor(temelMaas * (bereket.bonusYuzde / 100));
            bonusMesaji += `\n💰 *Bereket Tılsımı (+%${bereket.bonusYuzde}):* **+${tilsimBonusPara} 🪙**`;
        }

        const toplamKazanc = temelMaas + bonusPara + tilsimBonusPara;
        
        const meslekMesajlari = {
            'issiz': [
                'sokakta gitar çalarak', 'komşunun bahçesini temizleyerek', 'kağıt toplayarak',
                'anket doldurarak', 'broşür dağıtarak'
            ],
            'koylu': [
                'tarlayı sürerek', 'inekleri sağarak', 'pazarda meyve satarak',
                'buğday hasadı yaparak', 'tavukları yemleyerek'
            ],
            'torbaci': [
                'karanlık sokaklarda mal satarak', 'şifreli mesajları ileterek', 'gece yarısı teslimat yaparak',
                'polisten kaçmayı başararak', 'yeni müşteriler bularak'
            ],
            'garson': [
                'masaları temizleyerek', 'müşterilerden sağlam bahşiş alarak', 'tabakları düşürmeden taşıyarak',
                'bozuk kahve makinesini tamir ederek', 'siparişleri yetiştirerek'
            ],
            'kurye': [
                'yağmurda paket yetiştirerek', 'trafiğe takılmadan siparişi vererek', 'bahşişleri toplayarak',
                'motorla akrobatik hareketler yaparak', 'gecikmeden pizzayı ulaştırarak'
            ],
            'yazilimci': [
                'gece boyu kod yazarak', 'üretimdeki kritik bir bug\'ı çözerek', 'yeni bir uygulama geliştirerek',
                'kahve içip klavye parçalayarak', 'StackOverflow\'dan kod kopyalayarak'
            ],
            'doktor': [
                'başarılı bir ameliyat yaparak', 'hastaları iyileştirerek', 'acil serviste hayat kurtararak',
                'nöbette sabahlayarak', 'reçete yazarak'
            ],
            'pilot': [
                'okyanus aşırı uçuş yaparak', 'türbülanslı havada uçağı indirerek', 'yolcuları güvenle ulaştırarak',
                'özel jetle VIP müşteri taşıyarak', 'otomatik pilottan çıkıp uçağı kurtararak'
            ],
            'mimar': [
                'dev bir gökdelen tasarlayarak', 'ihaleyi kazanarak', 'inşaat projesini çizerek',
                'müşteriye şık bir tasarım sunarak', 'şantiyeyi denetleyerek'
            ],
            'ceo': [
                'yönetim kurulu toplantısına katılarak', 'dev bir şirket satın alarak', 'hisseleri yükselterek',
                'medyaya röportaj vererek', 'yatırımcıları ikna ederek'
            ],
            'sirket_sahibi': [
                'yeni bir şube açarak', 'rakipleri piyasadan silerek', 'borsada milyonlar kazanarak',
                'holdingin cirosunu ikiye katlayarak', 'lüks yatında iş görüşmesi yaparak'
            ]
        };

        const isler = meslekMesajlari[meslekId] || meslekMesajlari['issiz'];
        const rastgeleIs = isler[Math.floor(Math.random() * isler.length)];

        // Mesleklere Özel Başarısızlık Mesajları
        const hataMesajlari = {
            'issiz': ['Gitarının teli koptu, günü boşa harcadın.', 'Zabıta kovaladı, bütün gün kaçtın.', 'Dağıttığın broşürleri rüzgar uçurdu.'],
            'koylu': ['Traktör bozuldu, tarlada mahsur kaldın.', 'Kargalar bütün ekinleri yedi.', 'İnek seni tekmeledi, yevmiye yattı.'],
            'torbaci': ['Sivil polise denk geldin, malı bırakıp zar zor kaçtın.', 'Müşteri parayı vermeden kaçtı.', 'Rakip çete yolunu kesti, günü zararla kapattın.'],
            'garson': ['Müşterinin üstüne sıcak çorba döktün, yevmiyen kesildi.', 'Tepsiyi düşürüp bütün bardakları kırdın.', 'Müşteriyle kavga ettin, patron yevmiyene el koydu.'],
            'kurye': ['Paketi yanlış adrese teslim ettin, patron çıldırdı.', 'Motordan düştün, pizzalar ezildi.', 'Trafik polisine yakalandın, bütün günün boşa gitti.'],
            'yazilimci': ['Yanlışlıkla üretim veritabanını (Production DB) sildin!', 'Yazdığın kod yüzünden sunucular çöktü.', 'Bütün gün hata (bug) aradın ama noktalı virgülü bulamadın.'],
            'doktor': ['Yanlış teşhis koydun, hasta yakınları hastaneyi bastı.', 'Ameliyatta neşteri içeride unuttun.', 'Nöbette uyuya kaldın, maaşından kesinti yapıldı.'],
            'pilot': ['Yanlış piste inmeye çalıştın, uçuş lisansın tehlikede.', 'Uçakta kahveni kontrol paneline döktün.', 'Yanlış anons yaptın, yolcular panik çıkardı.'],
            'mimar': ['Çizdiğin bina yamuk oldu, proje iptal edildi.', 'Bütçeyi yanlış hesapladın, ihale elden gitti.', 'Şantiyede kafana tuğla düştü, hastanelik oldun.'],
            'ceo': ['Yanlış yatırım kararı şirketi zarara soktu.', 'Canlı yayında pot kırdın, hisseler çakıldı.', 'Vergi müfettişleri baskın yaptı, günü zararla kapattın.'],
            'sirket_sahibi': ['En büyük ihaleyi rakip holdinge kaptırdın.', 'Asistanın milyonluk sözleşmeyi çöpe attı.', 'Borsada büyük manipülasyona kurban gittin.']
        };

        let basarisizlikIhtimali = Math.random();
        const kaderPuani = getKaderPuani(userId);

        // Dua edenin iş kazası yaşama ihtimali düşer, lanetlinin artar (Her puan ±%2)
        // Taban risk: 0.20 (%20)
        let riskLimiti = Math.min(0.50, Math.max(0.02, 0.20 - (kaderPuani * PUAN_BASINA_SANS)));

        const guncelBakiyeAnlik = ecoDb.bul(`cuzdan_${userId}`) || 0;

        // Dengelendi: Risk oranı (Dua/Lanet modifiyeli) (Fakat parası 0 veya ekside olanlar "acınası" durumda olduğu için %100 başarılı olur)
        if (guncelBakiyeAnlik > 0 && basarisizlikIhtimali < riskLimiti) { 
            const kullaniciHatalari = hataMesajlari[meslekId] || hataMesajlari['issiz'];
            const secilenHata = kullaniciHatalari[Math.floor(Math.random() * kullaniciHatalari.length)];
            
            const hataEmbed = warningEmbed(
                interaction.member,
                'İşler Ters Gitti!',
                `❌ **${rastgeleIs.charAt(0).toUpperCase() + rastgeleIs.slice(1)}** çalışmaya çalıştın ama...\n\n*${secilenHata}*\n\nKazanç: **0 🪙**\n*Güncel Bakiye: ${guncelBakiyeAnlik.toLocaleString()} 🪙*`
            );
            
            cooldownDb.ayarla(cooldownKey, Date.now()); 
            return interaction.reply({ embeds: [hataEmbed] });
        }

        // XP ve Level Sistemi (Başarılı çalışmalarda XP kazanılır)
        let mevcutXp = userDb.bul(`xp_${userId}`) || 0;
        const kazanilanXp = Math.floor(Math.random() * (25 - 15 + 1)) + 15; // 15 - 25 XP
        mevcutXp += kazanilanXp;
        userDb.ayarla(`xp_${userId}`, mevcutXp);
        
        // Formül: Level = floor(sqrt(XP / 350)) + 1 
        // Lv 2 = 350 XP (~17 kere), Lv 3 = 1400 XP (~70 kere), Lv 4 = 3150 XP (~150 kere), Lv 5 = 5600 XP (~280 kere)
        let mevcutLevel = Math.floor(Math.sqrt(mevcutXp / 350)) + 1;
        if (mevcutLevel > 5) mevcutLevel = 5; // Maksimum Level 5 Sınırı

        // Evlilik / Yüzük Bonusu
        const evlilikVerisi = userDb.bul(`evlilik_${userId}`);
        let evlilikBonusYuzdesi = 0;
        let evlilikBonusPara = 0;

        if (evlilikVerisi && evlilikVerisi.yuzuk) {
            evlilikBonusYuzdesi = evlilikVerisi.yuzuk.bonusYuzdesi;
            evlilikBonusPara = Math.floor(temelMaas * (evlilikBonusYuzdesi / 100));
        }

        // Seviyeye göre ekstra bonus (Her seviye için %2.5 daha fazla maaş, Maksimum %10)
        const levelBonusYuzdesi = (mevcutLevel - 1) * 2.5;
        let levelBonusPara = 0;
        
        if (levelBonusYuzdesi > 0) {
            levelBonusPara = Math.floor(temelMaas * (levelBonusYuzdesi / 100));
        }

        const gercekToplamKazanc = toplamKazanc + levelBonusPara + evlilikBonusPara;

        // Başarılı çalışma durumu
        ecoDb.ekle(`cuzdan_${userId}`, gercekToplamKazanc);
        cooldownDb.ayarla(cooldownKey, Date.now());

        const guncelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        
        let aciklama = `💼 **${rastgeleIs.charAt(0).toUpperCase() + rastgeleIs.slice(1)}:** ${temelMaas} 🪙\n`;
        
        if (toplamBonusYuzdesi > 0) {
            aciklama += `> *🌟 Meslek Bonusu (+%${toplamBonusYuzdesi}): +${bonusPara} 🪙*\n`;
        }
        
        if (levelBonusYuzdesi > 0) {
            aciklama += `> *📈 Kariyer Seviyesi (Lv.${mevcutLevel}) Bonusu (+%${levelBonusYuzdesi}): +${levelBonusPara} 🪙*\n`;
        }

        if (evlilikBonusYuzdesi > 0) {
            aciklama += `> *💍 Aşkın Gücü (${evlilikVerisi.yuzuk.isim}) Bonusu (+%${evlilikBonusYuzdesi}): +${evlilikBonusPara} 🪙*\n`;
        }
        
        aciklama += `\n💰 **Toplam Kazanç:** ${gercekToplamKazanc} 🪙\n✨ **Kazanılan Tecrübe:** +${kazanilanXp} XP *(Toplam: ${mevcutXp} XP)*\n\n*Güncel Bakiye: ${guncelBakiye.toLocaleString()} 🪙*`;

        const basari = successEmbed(
            interaction.member,
            'Maaş Günü!',
            aciklama
        );

        await interaction.reply({ embeds: [basari] });
    },
};
