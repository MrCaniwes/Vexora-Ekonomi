const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SectionBuilder,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    SeparatorBuilder
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oyunlar')
        .setDescription('Tüm kumarhane ve şans oyunlarını listeler.'),
        
    async execute(interaction) {
        const container = new ContainerBuilder().setAccentColor(0xf1c40f);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### 🎰 Kumarhane & Oyunlar\nOynamak istediğiniz oyunu aşağıdan seçin.')
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        // Oyunlar listesi
        const oyunlar = [
            { id: 'düello', isim: '⚔️ Düello', aciklama: 'Bota karşı teke tek düelloya çık! (PvE Modu)' },
            { id: 'kazı-kazan', isim: '🎫 Kazı Kazan', aciklama: 'Bilet al, 9 kutuyu kazı, 3 aynı sembolü bulursan Jackpotu kap!' },
            { id: 'slot', isim: '🎰 Slot Makinesi', aciklama: 'Kolu çek ve 3 aynı sembolü bularak Jackpot\'u (x15) patlat!' },
            { id: 'at-yarışı', isim: '🏇 At Yarışı', aciklama: 'Favori atını seç, dört nala koşarak bahsini x3 yap!' },
            { id: 'yazı-tura', isim: '🪙 Yazı - Tura', aciklama: 'Parayı havaya at ve şansını dene! Bahsini 2\'ye katla.' },
            { id: 'büyük-küçük', isim: '📈 Büyük - Küçük (HighLow)', aciklama: 'Sıradaki sayıyı tahmin et, seriyi bozmadan çarpanları topla.' },
            { id: 'mayın-tarlası', isim: '💣 Mayın Tarlası', aciklama: 'Mayınlara basmadan elmasları topla ve kazancını katla!' },
            { id: '21', isim: '🃏 Blackjack (21)', aciklama: 'Kurpiyere karşı oyna, 21\'e en çok yaklaşan kazanır.' }
        ];

        for (let i = 0; i < oyunlar.length; i++) {
            const oyun = oyunlar[i];
            const btn = new ButtonBuilder()
                .setCustomId(`play_${oyun.id}`)
                .setLabel('Oyna')
                .setStyle(ButtonStyle.Success);

            const section = new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**${oyun.isim}**\n${oyun.aciklama}`)
                )
                .setButtonAccessory(btn);

            container.addSectionComponents(section);
            if (i < oyunlar.length - 1) {
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            }
        }

        const response = await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            withResponse: true
        });

        const responseMessage = response.resource ? response.resource.message : response;
        const collector = responseMessage.createMessageComponentCollector({ time: 300000 }); // 5 dakika

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Bu menüyü sadece komutu yazan kişi kullanabilir!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId.startsWith('play_')) {
                const oyunId = i.customId.replace('play_', ''); // Örn: yazı-tura

                // Seçilen oyuna göre bahsi almak için bir Modal (açılır pencere) oluşturuyoruz
                const modal = new ModalBuilder()
                    .setCustomId(`modal_${oyunId}`)
                    .setTitle('Bahis Ayarları');

                const bahisInput = new TextInputBuilder()
                    .setCustomId('bahis')
                    .setLabel('Bahis Miktarı')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Örn: 100')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(bahisInput));

                // Mayın tarlası için ek olarak mayın sayısı
                if (oyunId === 'mayın-tarlası') {
                    const mayinInput = new TextInputBuilder()
                        .setCustomId('mayin_sayisi')
                        .setLabel('Mayın Sayısı (1-15)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Örn: 3')
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(mayinInput));
                }
                
                // At yarışı için at seçimi
                if (oyunId === 'at-yarışı') {
                    const atInput = new TextInputBuilder()
                        .setCustomId('at')
                        .setLabel('At Seçimi (kirmizi, mavi, yesil, sari)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Örn: kirmizi')
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(atInput));
                }

                // Modalı göster
                await i.showModal(modal);

                try {
                    // Kullanıcının modalı doldurmasını bekle
                    const modalInteraction = await i.awaitModalSubmit({
                        filter: m => m.customId === `modal_${oyunId}` && m.user.id === interaction.user.id,
                        time: 60000 // 1 dakika içinde doldurması lazım
                    });

                    const bahisDegeri = parseInt(modalInteraction.fields.getTextInputValue('bahis'));

                    if (isNaN(bahisDegeri) || bahisDegeri <= 0) {
                        return modalInteraction.reply({ content: 'Lütfen geçerli bir bahis sayısı girin!', flags: MessageFlags.Ephemeral });
                    }

                    let mayinDegeri = null;
                    if (oyunId === 'mayın-tarlası') {
                        mayinDegeri = parseInt(modalInteraction.fields.getTextInputValue('mayin_sayisi'));
                        if (isNaN(mayinDegeri) || mayinDegeri < 1 || mayinDegeri > 15) {
                            return modalInteraction.reply({ content: 'Mayın sayısı 1 ile 15 arasında olmalıdır!', flags: MessageFlags.Ephemeral });
                        }
                    }

                    let secilenAtEmoji = null;
                    if (oyunId === 'at-yarışı') {
                        const atGirdi = modalInteraction.fields.getTextInputValue('at').toLowerCase();
                        if (atGirdi.includes('kirmizi') || atGirdi.includes('kırmızı') || atGirdi.includes('red')) secilenAtEmoji = '🔴';
                        else if (atGirdi.includes('mavi') || atGirdi.includes('blue')) secilenAtEmoji = '🔵';
                        else if (atGirdi.includes('yesil') || atGirdi.includes('yeşil') || atGirdi.includes('green')) secilenAtEmoji = '🟢';
                        else if (atGirdi.includes('sari') || atGirdi.includes('sarı') || atGirdi.includes('yellow')) secilenAtEmoji = '🟡';
                        else {
                            return modalInteraction.reply({ content: 'Geçersiz at! Lütfen Kırmızı, Mavi, Yeşil veya Sarı yazın.', flags: MessageFlags.Ephemeral });
                        }
                    }

                    // Hedef komutu bul
                    const slashCommand = interaction.client.commands.get(oyunId);
                    if (!slashCommand) {
                        return modalInteraction.reply({ content: 'Oyun bulunamadı!', flags: MessageFlags.Ephemeral });
                    }

                    // Sahte bir etkileşim objesi oluşturup seçilen oyunun execute metoduna paslıyoruz
                    const fakeInteraction = {
                        user: modalInteraction.user,
                        member: modalInteraction.member,
                        guild: modalInteraction.guild,
                        options: {
                            getInteger: (name) => {
                                if (name === 'bahis' || name === 'miktar') return bahisDegeri;
                                if (name === 'mayin_sayisi') return mayinDegeri;
                                return null;
                            },
                            getString: (name) => {
                                if (name === 'at') return secilenAtEmoji;
                                return null;
                            },
                            getUser: (name) => null // Oyunlar menüsünden girilirse her zaman PvE (Bota karşı) olur
                        },
                        // Artık modalInteraction üzerinden cevap veriyoruz, böylece oyunlar modal submitini yanıtlıyor
                        reply: async (opts) => await modalInteraction.reply(opts),
                        editReply: async (opts) => await modalInteraction.editReply(opts),
                        deferReply: async (opts) => await modalInteraction.deferReply(opts),
                        client: interaction.client
                    };

                    await slashCommand.execute(fakeInteraction);

                } catch (err) {
                    console.error('Modal zaman aşımına uğradı veya iptal edildi.');
                }
            }
        });
    }
};
