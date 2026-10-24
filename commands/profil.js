const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ecoDb, userDb } = require('../utils/db');
const { getKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');
const { getAktifTilsimlar } = require('../utils/tilsimUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Kendinizin veya başka bir oyuncunun detaylı ekonomi profilini gösterir.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Profiline bakmak istediğiniz kullanıcı (Opsiyonel)')
                .setRequired(false)
        ),
        
    async execute(interaction) {
        const targetMember = interaction.options.getMember('kullanici') || interaction.member;
        const userId = targetMember.user.id;

        // 1. Verileri Çek
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        const envanter = userDb.bul(`envanter_${userId}`) || [];
        const portfoy = userDb.bul(`portfoy_${userId}`) || {};
        const piyasa = ecoDb.bul('borsa_piyasa') || {};

        // 2. Meslek ve Seviye Bilgisi
        const meslek = envanter.find(e => e.kategori === 'meslekler');
        let mevcutXp = userDb.bul(`xp_${userId}`) || 0;
        let mevcutLevel = Math.floor(Math.sqrt(mevcutXp / 350)) + 1;
        if (mevcutLevel > 5) mevcutLevel = 5;

        const levelYazisi = `\n> 📈 **Seviye:** Lv.${mevcutLevel} | **XP:** ${mevcutXp}`;
        const meslekYazisi = meslek ? `**${meslek.isim}** *(+%${meslek.bonusYuzdesi} Maaş Bonusu)*${levelYazisi}` : `*İşsiz (Bir mesleği yok)*${levelYazisi}`;

        // 3. İşletmeler (Pasif Gelir)
        const yatirimlar = envanter.filter(e => e.kategori === 'yatirimlar');
        let yatirimYazisi = yatirimlar.length > 0 
            ? yatirimlar.map(y => `🏢 **${y.isim}**`).join('\n')
            : '*Hiçbir işletmesi yok.*';

        // Özel Roller
        const roller = envanter.filter(e => e.kategori === 'roller');
        let rolYazisi = roller.length > 0 
            ? roller.map(r => `🎭 **${r.isim}**`).join('\n')
            : '*Özel bir rolü yok.*';

        // Çantadaki Yüzükler (Envanter)
        const cantaYuzukleri = envanter.filter(e => e.kategori === 'yuzukler');
        let cantaYuzukYazisi = cantaYuzukleri.length > 0
            ? cantaYuzukleri.map(y => `💍 **${y.isim}**`).join('\n')
            : '*Çantasında yüzük yok.*';

        // Borsa Portföy Değeri
        let borsaDegeri = 0;
        for (const key in portfoy) {
            let veri = portfoy[key];
            if (!veri) continue;
            
            let adet = typeof veri === 'number' ? veri : veri.adet;
            if (adet > 0 && piyasa[key]) {
                borsaDegeri += adet * piyasa[key].fiyat;
            }
        }
        
        // Evlilik Durumu
        const evlilikVerisi = userDb.bul(`evlilik_${userId}`);
        let medeniDurum = 'Bekar 💔';
        if (evlilikVerisi) {
            medeniDurum = `<@${evlilikVerisi.partnerId}> ile Evli (${evlilikVerisi.yuzuk.emoji} ${evlilikVerisi.yuzuk.isim})`;
        }
        
        // Toplam Servet
        const toplamServet = bakiye + borsaDegeri;

        // Dua / Lanet Kalıcı Kader Puanı
        const kaderPuani = getKaderPuani(userId);
        let kaderMetni = '⚖️ Nötr (0 Puan)';
        if (kaderPuani > 0) {
            kaderMetni = `✨ Kutsanmış (+${kaderPuani} Dua) | Şans: +%${(kaderPuani * PUAN_BASINA_SANS * 100).toFixed(0)}`;
        } else if (kaderPuani < 0) {
            kaderMetni = `💀 Lanetli (${kaderPuani} Lanet) | Şans: %${(kaderPuani * PUAN_BASINA_SANS * 100).toFixed(0)}`;
        }

        // Aktif Tılsımlar
        const aktifTilsimlar = getAktifTilsimlar(userId);
        let tilsimMetni = '*Aktif tılsım yok.*';
        if (aktifTilsimlar.length > 0) {
            tilsimMetni = aktifTilsimlar.map(t => {
                const bitisUnix = Math.floor(t.bitis / 1000);
                return `${t.emoji} **${t.isim}** (<t:${bitisUnix}:R>)`;
            }).join(', ');
        }

        // Modern Profil Tasarımı (Description üzerinden)
        const aciklama = `
### 💎 Finansal Durum
> 💰 **Nakit Varlık:** ${bakiye.toLocaleString()} 🪙
> 📈 **Borsa Portföyü:** ${Math.floor(borsaDegeri).toLocaleString()} 🪙
> 🏆 **Toplam Servet:** ${Math.floor(toplamServet).toLocaleString()} 🪙

### 💼 Kariyer & Özel Hayat
> 👔 **Meslek:** ${meslek ? `**${meslek.isim}** *(+%${meslek.bonusYuzdesi} Bonus)*` : '*İşsiz*'}
> 📊 **Seviye:** **Lv.${mevcutLevel}** *(${mevcutXp} XP)*
> 💍 **Medeni Durum:** ${medeniDurum}
> 🔮 **Aura / Ruh Hali:** ${kaderMetni}
> 🧿 **Aktif Tılsımlar:** ${tilsimMetni}

### 🎒 Envanter & Varlıklar
> 🏢 **İşletmeler:** ${yatirimlar.length > 0 ? yatirimlar.map(y => `${y.isim} *(Lvl ${y.seviye || 1})*`).join(', ') : '*Yok*'}
> 💎 **Özel Roller:** ${roller.length > 0 ? roller.map(r => r.isim).join(', ') : '*Yok*'}
> 💍 **Çantadaki Yüzükler:** ${cantaYuzukleri.length > 0 ? cantaYuzukleri.map(y => y.isim).join(', ') : '*Yok*'}
        `;

        // Profil Kartını (Embed) Oluştur - Embed thumbnail'i resmi tam olarak sağ üste sabitler
        const profilEmbed = new EmbedBuilder()
            .setColor(0xf1c40f) // Altın sarısı detay
            .setAuthor({ name: `${targetMember.displayName} - Oyuncu Profili`, iconURL: targetMember.user.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true, size: 256 })) // SAĞ ÜSTTEKİ PROFİL RESMİ
            .setDescription(aciklama)
            .setFooter({ text: 'Vexora Ekonomi Sistemi' })
            .setTimestamp();

        await interaction.reply({ embeds: [profilEmbed] });
    },
};
