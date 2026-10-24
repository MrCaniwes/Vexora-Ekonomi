const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { ecoDb, userDb } = require('../utils/db');
const { VARLIKLAR, piyasayiGetir } = require('../utils/borsaSistemi');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('borsa')
        .setDescription('Canlı piyasayı görüntüleyin ve yatırım (döviz/kripto) alım satımı yapın!'),
        
    async execute(interaction) {
        const userId = interaction.user ? interaction.user.id : interaction.author.id;

        const generateMarketContainer = () => {
            const { piyasa, kalanZaman } = piyasayiGetir();
            const dakika = Math.floor(kalanZaman / (60 * 1000));
            
            const container = new ContainerBuilder().setAccentColor(0x34495e);
            
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### 📈 VEXORA Borsa & Yatırım\nFiyatların değişmesine **${dakika} dakika** kaldı.\n`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            let tablo = ``;
            for (const key in VARLIKLAR) {
                const f = piyasa[key].fiyat;
                const ef = piyasa[key].eskiFiyat;
                let durum = '➖';
                if (f > ef) durum = `🟢 (+%${(((f - ef) / ef) * 100).toFixed(1)})`;
                if (f < ef) durum = `🔴 (-%${(((ef - f) / ef) * 100).toFixed(1)})`;

                tablo += `**${VARLIKLAR[key].isim}**\n> 💰 Birim Fiyat: **${f.toLocaleString()} 🪙** ${durum}\n\n`;
            }

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(tablo));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('borsa_portfoy').setLabel('💼 Portföyüm').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('borsa_al').setLabel('🟢 Alış Yap').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('borsa_sat').setLabel('🔴 Satış Yap').setStyle(ButtonStyle.Danger)
            );
            
            container.addActionRowComponents(row);
            return container;
        };

        const response = await interaction.reply({ 
            components: [generateMarketContainer()], 
            flags: MessageFlags.IsComponentsV2,
            withResponse: true 
        });
    }
};
