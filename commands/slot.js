const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder, 
    MessageFlags 
} = require('discord.js');
const { ecoDb } = require('../utils/db');
const { getKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slot')
        .setDescription('Slot makinesini çevir, büyük ikramiyeyi (Jackpot) yakala!')
        .addIntegerOption(option => 
            option.setName('bahis')
                .setDescription('Ortaya koymak istediğiniz miktar (Nakit)')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        // Eğer komut modal (oyunlar hub) üzerinden geldiyse user bilgisi farklı olabilir
        const userId = interaction.user ? interaction.user.id : interaction.author.id; 
        const bahis = interaction.options.getInteger('bahis');

        if (bahis <= 0) {
            return interaction.reply({ content: 'Bahis miktarı 0\'dan büyük olmalıdır!', flags: MessageFlags.Ephemeral });
        }

        const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;

        if (cuzdan < bahis) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Cüzdanınızda **${cuzdan.toLocaleString()} 🪙** var.`, flags: MessageFlags.Ephemeral });
        }

        // Bahsi düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        const semboller = ['🍎', '🍋', '🍇', '🍒', '💎', '7️⃣'];

        // Rastgele 3 sembol seç
        let sonuc1 = semboller[Math.floor(Math.random() * semboller.length)];
        let sonuc2 = semboller[Math.floor(Math.random() * semboller.length)];
        let sonuc3 = semboller[Math.floor(Math.random() * semboller.length)];

        // Dua / Lanet Etkisi (Her puan ±%2)
        const kaderPuani = getKaderPuani(userId);
        const kaderSansFaktoru = Math.abs(kaderPuani) * PUAN_BASINA_SANS;

        if (kaderPuani > 0 && Math.random() < kaderSansFaktoru) {
            // Dua etkisi: 2. sembolü 1. sembolle eşleştir (kazanma şansını artırır)
            sonuc2 = sonuc1;
        } else if (kaderPuani < 0 && Math.random() < kaderSansFaktoru) {
            // Lanet etkisi: Eğer eşleşme varsa eşleşmeyi boz
            if (sonuc1 === sonuc2 || sonuc2 === sonuc3 || sonuc1 === sonuc3) {
                const digerleri = semboller.filter(s => s !== sonuc1 && s !== sonuc2);
                sonuc3 = digerleri[Math.floor(Math.random() * digerleri.length)];
                if (sonuc1 === sonuc2) {
                    sonuc2 = semboller.filter(s => s !== sonuc1 && s !== sonuc3)[0];
                }
            }
        }

        // Çarpan hesaplama
        let carpan = 0;
        let aciklamaMesaji = '';

        if (sonuc1 === sonuc2 && sonuc2 === sonuc3) {
            // 3'lü eşleşme
            if (sonuc1 === '7️⃣') {
                carpan = 15; // Jackpot
                aciklamaMesaji = `🎇 **JACKPOT! 7-7-7!** İnanılmaz şanslısın! (+${(bahis * carpan).toLocaleString()} 🪙)`;
            } else if (sonuc1 === '💎') {
                carpan = 10;
                aciklamaMesaji = `💎 **Büyük Ödül!** Elmasları dizdin! (+${(bahis * carpan).toLocaleString()} 🪙)`;
            } else {
                carpan = 5;
                aciklamaMesaji = `🎉 **3'lü Eşleşme!** Harika kazanç! (+${(bahis * carpan).toLocaleString()} 🪙)`;
            }
        } else if (sonuc1 === sonuc2 || sonuc2 === sonuc3 || sonuc1 === sonuc3) {
            // 2'li eşleşme
            carpan = 2;
            aciklamaMesaji = `👍 **2'li Eşleşme!** Bahsini ikiye katladın! (+${(bahis * carpan).toLocaleString()} 🪙)`;
        } else {
            // Hiçbiri eşleşmedi
            carpan = 0;
            aciklamaMesaji = `❌ **Kaybettin!** Hiçbir sembol eşleşmedi. (-${bahis.toLocaleString()} 🪙)`;
        }

        const kazanc = bahis * carpan;

        // Container oluşturucu
        const generateContainer = (adim) => {
            const container = new ContainerBuilder().setAccentColor(adim === 4 ? (carpan > 0 ? 0x2ecc71 : 0xe74c3c) : 0xe67e22);

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('### 🎰 Slot Makinesi')
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            // Rastgele dönen animasyon hissi için geçici semboller
            const rnd = () => semboller[Math.floor(Math.random() * semboller.length)];

            let g1 = adim >= 2 ? sonuc1 : rnd();
            let g2 = adim >= 3 ? sonuc2 : rnd();
            let g3 = adim >= 4 ? sonuc3 : rnd();

            if (adim < 4) {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`🪙 **Bahis:** ${bahis.toLocaleString()}\n\n> 🎰 | **${g1} - ${g2} - ${g3}** | 🎰\n\n*Makineler dönüyor...* 🔄`)
                );
            } else {
                const guncelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`🪙 **Bahis:** ${bahis.toLocaleString()}\n\n> 🎰 | **${sonuc1} - ${sonuc2} - ${sonuc3}** | 🎰\n\n${aciklamaMesaji}\n*Güncel Bakiye: ${guncelBakiye.toLocaleString()} 🪙*`)
                );
            }

            return container;
        };

        // Animasyon: 1. Kare (Hepsi dönüyor)
        await interaction.reply({ 
            components: [generateContainer(1)], 
            flags: MessageFlags.IsComponentsV2 
        });

        const bekle = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Sırayla editleme işlemi (Discord rate-limit'e takılmamak için 1 saniye aralık ideal)
        await bekle(1000);
        await interaction.editReply({ components: [generateContainer(2)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        
        await bekle(1000);
        await interaction.editReply({ components: [generateContainer(3)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        
        await bekle(1000);
        if (carpan > 0) {
            ecoDb.ekle(`cuzdan_${userId}`, kazanc);
            const { canliDurumBildir } = require('../utils/canliDurum');
            canliDurumBildir({ userId, oyunAdi: 'Slot', bahis, kazanc, carpan, kaynak: 'discord' });
        }
        await interaction.editReply({ components: [generateContainer(4)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    },
};
