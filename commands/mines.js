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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mayın-tarlası')
        .setDescription('Mayın tarlası oynayarak paranızı katlayın!')
        .addIntegerOption(option => 
            option.setName('bahis')
                .setDescription('Ortaya koymak istediğiniz miktar')
                .setRequired(true)
        )
        .addIntegerOption(option => 
            option.setName('mayin_sayisi')
                .setDescription('Tarladaki mayın sayısı (1 ile 15 arası)')
                .setMinValue(1)
                .setMaxValue(15)
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const userId = interaction.user.id;
        const bahis = interaction.options.getInteger('bahis');
        let mayinSayisi = interaction.options.getInteger('mayin_sayisi');

        if (!mayinSayisi || isNaN(mayinSayisi) || mayinSayisi < 1 || mayinSayisi > 15) {
            mayinSayisi = 3; // Varsayılan mayın sayısı
        }

        if (bahis <= 0) return interaction.reply({ content: 'Bahis miktarı 0\'dan büyük olmalıdır!', flags: MessageFlags.Ephemeral });

        const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (cuzdan < bahis) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Cüzdanınızda **${cuzdan.toLocaleString()} 🪙** var.`, flags: MessageFlags.Ephemeral });
        }

        // Bahsi düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        const gridSize = 16; // 4x4
        let field = Array(gridSize).fill('safe');
        
        // Mayınları yerleştir
        let mayinlarYerlesti = 0;
        while (mayinlarYerlesti < mayinSayisi) {
            let rnd = Math.floor(Math.random() * gridSize);
            if (field[rnd] !== 'mine') {
                field[rnd] = 'mine';
                mayinlarYerlesti++;
            }
        }

        let tiklananlar = [];
        let oyunBitti = false;
        let carpan = 1.0;
        
        // Gerçek Olasılık Çarpanı Fonksiyonu (Tüm 1-15 mayın ve adımlar için dinamik)
        // Matematiksel Formül: (Toplam Kombinasyon / Güvenli Kombinasyon) * 0.95 (Kasa Avantajı)
        const hesaplaMinesCarpan = (secilenMayin, acilanElmasSayisi) => {
            if (acilanElmasSayisi === 0) return 1.0;
            let carpanSonuc = 1.0;
            for (let k = 0; k < acilanElmasSayisi; k++) {
                // Kalan toplam kare / Kalan güvenli kare
                const toplamKalan = 16 - k;
                const guvenliKalan = 16 - secilenMayin - k;
                carpanSonuc *= (toplamKalan / guvenliKalan);
            }
            // %5 Kasa Avantajı (House Edge: 0.95)
            const nihaiCarpan = carpanSonuc * 0.95;
            return Math.max(1.02, parseFloat(nihaiCarpan.toFixed(2)));
        }; 

        const generateContainer = (durum, guncelCarpan) => {
            const container = new ContainerBuilder().setAccentColor(durum === 'kaybetti' ? 0xe74c3c : (durum === 'cekti' ? 0x2ecc71 : 0x3498db));

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('### 💣 Mayın Tarlası (Mines)')
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            const guncelKazanc = Math.floor(bahis * guncelCarpan);

            if (durum === 'devam') {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`💣 **Mayın:** ${mayinSayisi}\n🪙 **Bahis:** ${bahis.toLocaleString()}\n💰 **Kazanç:** ${guncelKazanc.toLocaleString()} (x${guncelCarpan.toFixed(2)})`)
                );
            } else if (durum === 'cekti') {
                let txt = `🎉 **Kazandın!** (+${guncelKazanc.toLocaleString()} 🪙)`;
                const guncelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
                txt += `\n*Güncel Bakiye: ${guncelBakiye.toLocaleString()} 🪙*`;
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(txt));
            } else if (durum === 'kaybetti') {
                let txt = `💥 **Büüm! Mayına bastın!** (-${bahis.toLocaleString()} 🪙)`;
                const guncelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
                txt += `\n*Güncel Bakiye: ${guncelBakiye.toLocaleString()} 🪙*`;
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(txt));
            }

            // 4x4 Buton Grid'i (4 ActionRow)
            for (let r = 0; r < 4; r++) {
                const row = new ActionRowBuilder();
                for (let c = 0; c < 4; c++) {
                    const index = r * 4 + c;
                    const btn = new ButtonBuilder().setCustomId(`mine_${index}`);
                    
                    if (oyunBitti) {
                        btn.setDisabled(true);
                        if (field[index] === 'mine') {
                            btn.setEmoji('💣').setStyle(tiklananlar.includes(index) ? ButtonStyle.Danger : ButtonStyle.Secondary);
                        } else {
                            btn.setEmoji('💎').setStyle(tiklananlar.includes(index) ? ButtonStyle.Success : ButtonStyle.Secondary);
                        }
                    } else {
                        if (tiklananlar.includes(index)) {
                            btn.setEmoji('💎').setStyle(ButtonStyle.Success).setDisabled(true);
                        } else {
                            btn.setLabel('❓').setStyle(ButtonStyle.Primary);
                        }
                    }
                    row.addComponents(btn);
                }
                container.addActionRowComponents(row);
            }

            // 5. ActionRow: Para Çek butonu
            const altRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('paracek')
                    .setLabel(`Para Çek (${guncelKazanc.toLocaleString()} 🪙)`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(oyunBitti || tiklananlar.length === 0)
            );
            container.addActionRowComponents(altRow);

            return container;
        };

        const response = await interaction.reply({ 
            components: [generateContainer('devam', carpan)], 
            flags: MessageFlags.IsComponentsV2,
            withResponse: true 
        });

        const responseMessage = response.resource ? response.resource.message : response;
        const collector = responseMessage.createMessageComponentCollector({ time: 120000 }); // 2 dakika

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Bu oyunu sadece başlatan kişi oynayabilir!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'paracek') {
                oyunBitti = true;
                const sonKazanc = Math.floor(bahis * carpan);
                ecoDb.ekle(`cuzdan_${userId}`, sonKazanc);
                const { canliDurumBildir } = require('../utils/canliDurum');
                canliDurumBildir({ userId, oyunAdi: 'Mayın Tarlası', bahis, kazanc: sonKazanc, carpan, kaynak: 'discord' });
                collector.stop('cekti');
                await i.update({ components: [generateContainer('cekti', carpan)], flags: MessageFlags.IsComponentsV2 });
                return;
            }

            if (i.customId.startsWith('mine_')) {
                const index = parseInt(i.customId.split('_')[1]);
                tiklananlar.push(index);

                if (field[index] === 'mine') {
                    // Kaybetti
                    oyunBitti = true;
                    collector.stop('kaybetti');
                    await i.update({ components: [generateContainer('kaybetti', carpan)], flags: MessageFlags.IsComponentsV2 });
                } else {
                    // Elmas buldu
                    carpan = hesaplaMinesCarpan(mayinSayisi, tiklananlar.length);
                    
                    // Tüm elmasları buldu mu? (16 - mayinSayisi)
                    if (tiklananlar.length === (gridSize - mayinSayisi)) {
                        oyunBitti = true;
                        const sonKazanc = Math.floor(bahis * carpan);
                        ecoDb.ekle(`cuzdan_${userId}`, sonKazanc);
                        const { canliDurumBildir } = require('../utils/canliDurum');
                        canliDurumBildir({ userId, oyunAdi: 'Mayın Tarlası', bahis, kazanc: sonKazanc, carpan, kaynak: 'discord' });
                        collector.stop('kazandi');
                        await i.update({ components: [generateContainer('cekti', carpan)], flags: MessageFlags.IsComponentsV2 });
                    } else {
                        // Oyun devam ediyor
                        await i.update({ components: [generateContainer('devam', carpan)], flags: MessageFlags.IsComponentsV2 });
                    }
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                // Afk kalırsa otomatik çektir (oyuncu mağdur olmasın)
                if (!oyunBitti && tiklananlar.length > 0) {
                    const sonKazanc = Math.floor(bahis * carpan);
                    ecoDb.ekle(`cuzdan_${userId}`, sonKazanc);
                    oyunBitti = true;
                    interaction.editReply({ components: [generateContainer('cekti', carpan)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                } else if (!oyunBitti && tiklananlar.length === 0) {
                    ecoDb.ekle(`cuzdan_${userId}`, bahis);
                    interaction.editReply({ 
                        content: '⏱️ Süre doldu, oyun iptal edildi.',
                        components: [],
                        flags: MessageFlags.IsComponentsV2 
                    }).catch(() => {});
                }
            }
        });
    },
};
