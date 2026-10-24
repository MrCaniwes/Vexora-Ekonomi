const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags 
} = require('discord.js');
const { ecoDb } = require('../utils/db');
const { getKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('büyük-küçük')
        .setDescription('Sıradaki sayının büyük mü küçük mü olacağını bil, seriyi bozmadan parayı katla!')
        .addIntegerOption(option => 
            option.setName('bahis')
                .setDescription('Ortaya koymak istediğiniz miktar')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const userId = interaction.user.id;
        const bahis = interaction.options.getInteger('bahis');

        if (bahis <= 0) return interaction.reply({ content: 'Bahis miktarı 0\'dan büyük olmalıdır!', flags: MessageFlags.Ephemeral });

        const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (cuzdan < bahis) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Cüzdanınızda **${cuzdan.toLocaleString()} 🪙** var.`, flags: MessageFlags.Ephemeral });
        }

        // Bahsi düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        let oyunBitti = false;
        let durum = 'devam'; // 'devam', 'kaybetti', 'cekti'
        
        // Başlangıç değerleri
        let currentNumber = Math.floor(Math.random() * 100) + 1;
        let genelCarpan = 1.0;
        let history = [currentNumber]; // Sadece sayıları tutacağız: [50, 75, 20]

        // Yardımcı Matematik (Kasa payı %5 (0.95), minimum çarpan 1.02x)
        const getCarpanlar = (num) => {
            const kucukCount = num - 1;
            const buyukCount = 100 - num;

            // Formül: (100 / ihtimal) * 0.95. Asla 1.01'den aşağı düşmesin.
            const kucukCarpan = kucukCount > 0 ? Math.max(1.01, (100 / kucukCount) * 0.95) : 0;
            const buyukCarpan = buyukCount > 0 ? Math.max(1.01, (100 / buyukCount) * 0.95) : 0;

            return { 
                kucukCarpan: parseFloat(kucukCarpan.toFixed(2)), 
                buyukCarpan: parseFloat(buyukCarpan.toFixed(2)) 
            };
        };

        const generateContainer = () => {
            let renk = 0x3498db;
            if (durum === 'cekti') renk = 0x2ecc71;
            else if (durum === 'kaybetti') renk = 0xe74c3c;

            const container = new ContainerBuilder().setAccentColor(renk);

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('### 🔢 High or Low (Seri Yap!)')
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            const guncelKazanc = Math.floor(bahis * genelCarpan);
            const { kucukCarpan, buyukCarpan } = getCarpanlar(currentNumber);
            const ayniCarpan = 95.00; // 1/100 ihtimal, sabit yüksek oran
            
            // Geçmişi sadece sayılarla temiz bir şekilde göster
            let historyText = history.join(' ➔ ');
            if (durum === 'kaybetti') historyText += ' ❌';
            if (durum === 'cekti') historyText += ' ✅';

            if (durum === 'devam') {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`🪙 **Bahis:** ${bahis.toLocaleString()}\n💰 **Kazanç:** ${guncelKazanc.toLocaleString()} (x${genelCarpan.toFixed(2)})\n📜 **Geçmiş:** ${historyText}\n\n🎯 **Hedef Sayı: ${currentNumber}**`)
                );
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('kucuk')
                        .setLabel(`⬇️ Küçük (x${kucukCarpan})`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentNumber === 1),
                    new ButtonBuilder()
                        .setCustomId('ayni')
                        .setLabel(`🟰 Aynı (x${ayniCarpan})`)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('buyuk')
                        .setLabel(`⬆️ Büyük (x${buyukCarpan})`)
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(currentNumber === 100)
                );
                
                const altRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('paracek')
                        .setLabel(`💸 Para Çek (${guncelKazanc.toLocaleString()} 🪙)`)
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(history.length === 1) // Sadece 1 sayı varken çekilmez
                );
                
                container.addActionRowComponents(row);
                container.addActionRowComponents(altRow);
            } else if (durum === 'kaybetti') {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`📜 **Geçmiş:** ${historyText}\n\n❌ **Kaybettin!** (-${bahis.toLocaleString()} 🪙)`)
                );
            } else if (durum === 'cekti') {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`📜 **Geçmiş:** ${historyText}\n\n🎉 **Kazandın!** (+${guncelKazanc.toLocaleString()} 🪙)`)
                );
            }

            return container;
        };

        const response = await interaction.reply({ 
            components: [generateContainer()], 
            flags: MessageFlags.IsComponentsV2,
            withResponse: true 
        });

        const responseMessage = response.resource ? response.resource.message : response;
        const collector = responseMessage.createMessageComponentCollector({ time: 180000 }); // 3 dakika afk süresi

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Bu oyunu sadece başlatan kişi oynayabilir!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'paracek') {
                oyunBitti = true;
                durum = 'cekti';
                const sonKazanc = Math.floor(bahis * genelCarpan);
                ecoDb.ekle(`cuzdan_${userId}`, sonKazanc);
                const { canliDurumBildir } = require('../utils/canliDurum');
                canliDurumBildir({ userId, oyunAdi: 'Yüksek / Düşük (HighLow)', bahis, kazanc: sonKazanc, carpan: genelCarpan, kaynak: 'discord' });
                collector.stop();
                await i.update({ components: [generateContainer()], flags: MessageFlags.IsComponentsV2 });
                return;
            }

            const secim = i.customId; // 'buyuk', 'kucuk' veya 'ayni'
            const { kucukCarpan, buyukCarpan } = getCarpanlar(currentNumber);
            const ayniCarpan = 95.00;
            
            let nextNumber = Math.floor(Math.random() * 100) + 1;

            // Dua / Lanet Kader Etkisi: Her puan için %2 olasılık manipülasyonu
            const kaderPuani = getKaderPuani(userId);
            const kaderSansFaktoru = Math.abs(kaderPuani) * PUAN_BASINA_SANS;

            if (kaderPuani > 0 && Math.random() < kaderSansFaktoru) {
                // Dua etkisi: Yanlış sayı geldiyse doğru tarafa çek
                if (secim === 'buyuk' && nextNumber <= currentNumber) {
                    nextNumber = Math.min(100, currentNumber + Math.floor(Math.random() * 10) + 1);
                } else if (secim === 'kucuk' && nextNumber >= currentNumber) {
                    nextNumber = Math.max(1, currentNumber - Math.floor(Math.random() * 10) - 1);
                }
            } else if (kaderPuani < 0 && Math.random() < kaderSansFaktoru) {
                // Lanet etkisi: Doğru geldiyse ters tarafa çek
                if (secim === 'buyuk' && nextNumber > currentNumber) {
                    nextNumber = Math.max(1, currentNumber - Math.floor(Math.random() * 10) - 1);
                } else if (secim === 'kucuk' && nextNumber < currentNumber) {
                    nextNumber = Math.min(100, currentNumber + Math.floor(Math.random() * 10) + 1);
                }
            }

            let dogruBildimi = false;
            let secilenCarpan = ayniCarpan;

            if (secim === 'buyuk') {
                dogruBildimi = (nextNumber > currentNumber);
                secilenCarpan = buyukCarpan;
            } else if (secim === 'kucuk') {
                dogruBildimi = (nextNumber < currentNumber);
                secilenCarpan = kucukCarpan;
            } else if (secim === 'ayni') {
                dogruBildimi = (nextNumber === currentNumber);
                secilenCarpan = ayniCarpan;
            }

            // Sayıyı geçmişe ekle
            history.push(nextNumber);
            currentNumber = nextNumber;

            // Tahmin kontrolü
            if (dogruBildimi) {
                // Bildi!
                genelCarpan *= secilenCarpan;
                await i.update({ components: [generateContainer()], flags: MessageFlags.IsComponentsV2 });
            } else {
                // Bilemedi!
                oyunBitti = true;
                durum = 'kaybetti';
                collector.stop();
                const hlRemBal = ecoDb.bul(`cuzdan_${userId}`) || 0;
                if (hlRemBal === 0) {
                    const { canliDurumIflasBildir } = require('../utils/canliDurum');
                    canliDurumIflasBildir({ userId, oyunAdi: 'Yüksek / Düşük (HighLow)', kaybedilenBahis: bahis, kaynak: 'discord' });
                }
                await i.update({ components: [generateContainer()], flags: MessageFlags.IsComponentsV2 });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && !oyunBitti) {
                // Süre biterse ve oyun bitmemişse parayı otomatik çek (kullanıcı mağdur olmasın)
                durum = 'cekti';
                const sonKazanc = Math.floor(bahis * genelCarpan);
                ecoDb.ekle(`cuzdan_${userId}`, sonKazanc);
                interaction.editReply({ components: [generateContainer()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }
        });
    },
};
