const { 
    SlashCommandBuilder, 
    MessageFlags, 
    EmbedBuilder 
} = require('discord.js');
const { ecoDb } = require('../utils/db');
const { getKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('at-yarışı')
        .setDescription('Kendi atını seç ve yarışa katıl! (x3 Kazanç)')
        .addIntegerOption(option => 
            option.setName('bahis')
                .setDescription('Bahis miktarı')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('at')
                .setDescription('Hangi ata bahis oynayacaksın?')
                .setRequired(true)
                .addChoices(
                    { name: '🔴 Kırmızı At', value: '🔴' },
                    { name: '🔵 Mavi At', value: '🔵' },
                    { name: '🟢 Yeşil At', value: '🟢' },
                    { name: '🟡 Sarı At', value: '🟡' }
                )
        ),
        
    async execute(interaction) {
        const userId = interaction.user ? interaction.user.id : interaction.author.id;
        const bahis = interaction.options.getInteger('bahis');
        const secilenAt = interaction.options.getString('at');

        if (bahis <= 0) {
            return interaction.reply({ content: 'Bahis miktarı 0\'dan büyük olmalıdır!', flags: MessageFlags.Ephemeral });
        }

        const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (cuzdan < bahis) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Cüzdanınızda **${cuzdan.toLocaleString()} 🪙** var.`, flags: MessageFlags.Ephemeral });
        }

        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        // Atlar ve başlangıç pozisyonları
        const atlar = [
            { emoji: '🔴', isim: 'Kırmızı', pozisyon: 0 },
            { emoji: '🔵', isim: 'Mavi', pozisyon: 0 },
            { emoji: '🟢', isim: 'Yeşil', pozisyon: 0 },
            { emoji: '🟡', isim: 'Sarı', pozisyon: 0 }
        ];

        const parkurUzunlugu = 20;

        const parkuruCiz = (durumMesaji) => {
            let yazi = `🏁 **BİTİŞ ÇİZGİSİ** 🏁\n\n`;
            for (const at of atlar) {
                const cizgi = '-'.repeat(parkurUzunlugu);
                // Atın bulunduğu pozisyona at emojisini koy
                const on = '-'.repeat(at.pozisyon);
                const arka = '-'.repeat(Math.max(0, parkurUzunlugu - at.pozisyon - 1));
                
                if (at.pozisyon >= parkurUzunlugu) {
                    yazi += `${at.emoji} ${'-'.repeat(parkurUzunlugu)} 🏇 **BİTİŞ!**\n`;
                } else {
                    yazi += `${at.emoji} ${on}🏇${arka} |\n`;
                }
            }
            yazi += `\n${durumMesaji}`;
            return yazi;
        };

        const embed = new EmbedBuilder()
            .setTitle('🐎 At Yarışı Başlıyor!')
            .setColor('#f39c12')
            .setDescription(parkuruCiz(`🪙 **Bahis:** ${bahis.toLocaleString()}\n🎯 **Seçilen At:** ${secilenAt}`));

        const response = await interaction.reply({ embeds: [embed], withResponse: true });
        // Prefix Wrapper'da response.resource kullanmıyoruz, direkt mesaj dönüyor olabilir
        const replyMessage = response.resource ? response.resource.message : response;
        
        const bekle = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        let yarisBitti = false;
        let kazanan = null;

        // Yarış Döngüsü
        const kaderPuani = getKaderPuani(userId);
        const deparIhtimali = Math.abs(kaderPuani) * PUAN_BASINA_SANS; // Her puan %2

        for (let i = 0; i < 8; i++) {
            await bekle(1500);

            // Her ata rastgele 1 ile 4 arası adım attır
            for (const at of atlar) {
                let adim = Math.floor(Math.random() * 4) + 1;

                // Seçilen ata kader desteği veya kösteği
                if (at.emoji === secilenAt) {
                    if (kaderPuani > 0 && Math.random() < deparIhtimali) {
                        adim += 1; // Dua etkisi: At ekstra şahlanıp hızlanır (+1 adım)
                    } else if (kaderPuani < 0 && Math.random() < deparIhtimali) {
                        adim = Math.max(1, adim - 1); // Lanet etkisi: At sendeler (-1 adım)
                    }
                }

                at.pozisyon += adim;
                if (at.pozisyon >= parkurUzunlugu && !yarisBitti) {
                    yarisBitti = true;
                    kazanan = at;
                }
            }

            if (yarisBitti) {
                // Beraberlik olmaması için ilk bitireni direkt kazanan sayıyoruz
                break;
            } else {
                const guncelEmbed = new EmbedBuilder()
                    .setTitle('🐎 Yarış Devam Ediyor!')
                    .setColor('#f39c12')
                    .setDescription(parkuruCiz(`🪙 **Bahis:** ${bahis.toLocaleString()}\n🎯 **Seçilen At:** ${secilenAt}\n\n*Atlar dört nala koşuyor...* 💨`));
                
                await interaction.editReply({ embeds: [guncelEmbed] }).catch(() => {});
            }
        }

        // Yarış bitti, eğer kimse bitiremediyse en öndekini kazanan yap
        if (!kazanan) {
            atlar.sort((a, b) => b.pozisyon - a.pozisyon);
            kazanan = atlar[0];
            kazanan.pozisyon = parkurUzunlugu;
        }

        const kazandimi = (kazanan.emoji === secilenAt);
        const odul = kazandimi ? bahis * 3 : 0; // x3 ödül
        let sonucMesaji = `🏆 **KAZANAN:** ${kazanan.emoji} ${kazanan.isim} At!\n\n`;

        if (kazandimi) {
            sonucMesaji += `🎉 **Tebrikler!** Kendi atın birinci oldu. (+${odul.toLocaleString()} 🪙)`;
            ecoDb.ekle(`cuzdan_${userId}`, odul);
            const { canliDurumBildir } = require('../utils/canliDurum');
            canliDurumBildir({ userId, oyunAdi: 'At Yarışı', bahis, kazanc: odul, carpan: 3, kaynak: 'discord' });
        } else {
            sonucMesaji += `❌ **Kaybettin!** Seçtiğin at (${secilenAt}) yarışı kazanamadı. (-${bahis.toLocaleString()} 🪙)`;
        }

        const guncelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        sonucMesaji += `\n*Güncel Bakiye: ${guncelBakiye.toLocaleString()} 🪙*`;

        const bitisEmbed = new EmbedBuilder()
            .setTitle('🏁 Yarış Bitti!')
            .setColor(kazandimi ? '#2ecc71' : '#e74c3c')
            .setDescription(parkuruCiz(sonucMesaji));

        await interaction.editReply({ embeds: [bitisEmbed] }).catch(() => {});
    }
};
