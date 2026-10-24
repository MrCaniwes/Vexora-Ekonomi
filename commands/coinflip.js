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
const { sansZariAt } = require('../utils/kaderUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yazı-tura')
        .setDescription('Yazı-Tura oynayarak bahsinizi ikiye katlayın!')
        .addIntegerOption(option => 
            option.setName('bahis')
                .setDescription('Ortaya koymak istediğiniz miktar (Nakit)')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const userId = interaction.user.id;
        const bahis = interaction.options.getInteger('bahis');

        if (bahis <= 0) {
            return interaction.reply({ content: 'Bahis miktarı 0\'dan büyük olmalıdır!', flags: MessageFlags.Ephemeral });
        }

        const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;

        if (cuzdan < bahis) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Cüzdanınızda **${cuzdan.toLocaleString()} 🪙** var.`, flags: MessageFlags.Ephemeral });
        }

        // Oyunu başlat, bahsi şimdilik düşüyoruz ki spam yapıp parayı buglamasınlar
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        const generateContainer = (durum, secim, sonuc, kazandi, kaderBilgi = null) => {
            const container = new ContainerBuilder().setAccentColor(durum === 'bekliyor' ? 0x3498db : (kazandi ? 0x2ecc71 : 0xe74c3c));

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('### 🪙 Yazı - Tura')
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            if (durum === 'bekliyor') {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`🪙 **Bahis:** ${bahis.toLocaleString()}`)
                );
                
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('yazi').setLabel('Yazı').setEmoji('🌑').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('tura').setLabel('Tura').setEmoji('🌕').setStyle(ButtonStyle.Secondary)
                );
                container.addActionRowComponents(row);
            } else if (durum === 'donuyor') {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`👤 **Sen:** ${secim.toUpperCase()}\n\n🪙 *Para havaya atıldı, dönüyor...* 🌪️`)
                );
            } else {
                const kazanc = kazandi ? bahis * 2 : 0;
                let aciklama = `👤 **Sen:** ${secim.toUpperCase()}\n🪙 **Sonuç:** ${sonuc.toUpperCase()}\n\n`;
                
                if (kazandi) {
                    aciklama += `🎉 **Kazandın!** (+${kazanc.toLocaleString()} 🪙)`;
                } else {
                    aciklama += `❌ **Kaybettin!** (-${bahis.toLocaleString()} 🪙)`;
                }

                if (kaderBilgi > 0) {
                    aciklama += `\n✨ *(Duaların seni korudu! +${kaderBilgi} Dua Puanı)*`;
                } else if (kaderBilgi < 0) {
                    aciklama += `\n💀 *(Üzerindeki lanet şansını zorlaştırdı! ${kaderBilgi} Lanet Puanı)*`;
                }
                
                const guncelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
                aciklama += `\n*Güncel Bakiye: ${guncelBakiye.toLocaleString()} 🪙*`;

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(aciklama)
                );
            }

            return container;
        };

        const response = await interaction.reply({ 
            components: [generateContainer('bekliyor')], 
            flags: MessageFlags.IsComponentsV2,
            withResponse: true 
        });

        const responseMessage = response.resource ? response.resource.message : response;
        const collector = responseMessage.createMessageComponentCollector({ time: 60000 }); // 60 saniye süre

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Bu oyunu sadece başlatan kişi oynayabilir!', flags: MessageFlags.Ephemeral });
            }

            // Seçimi yap
            const kullaniciSecimi = i.customId; 
            const karsit = kullaniciSecimi === 'yazi' ? 'tura' : 'yazi';

            // Temel kazanma oranı %50, her puan ±%2 kalıcı etki
            const sonucZari = sansZariAt(userId, 0.50);
            const kazandi = sonucZari.basarili;
            const botSecimi = kazandi ? kullaniciSecimi : karsit;

            // Collector'u durdur çünkü oyun bitti
            collector.stop();

            // Havada dönme animasyonu
            await i.update({ 
                components: [generateContainer('donuyor', kullaniciSecimi)], 
                flags: MessageFlags.IsComponentsV2 
            });

            // 2.5 saniye sonra sonucu açıkla
            setTimeout(async () => {
                if (kazandi) {
                    ecoDb.ekle(`cuzdan_${userId}`, bahis * 2); // Kazandıysa bahsin iki katını geri ver
                    const { canliDurumBildir } = require('../utils/canliDurum');
                    canliDurumBildir({ userId, oyunAdi: 'Yazı Tura (Coinflip)', bahis, kazanc: bahis * 2, carpan: 2, kaynak: 'discord' });
                }
                
                await interaction.editReply({ 
                    components: [generateContainer('bitti', kullaniciSecimi, botSecimi, kazandi, sonucZari.kaderPuani)], 
                    flags: MessageFlags.IsComponentsV2 
                }).catch(() => {});
            }, 2500);
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                // Oyuncu zamanında seçmezse bahsini geri ver (oyun iptal)
                ecoDb.ekle(`cuzdan_${userId}`, bahis);
                interaction.editReply({ 
                    content: '⏱️ Süre doldu, oyun iptal edildi. Paranız cüzdanınıza iade edildi.',
                    components: [],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }
        });
    },
};
