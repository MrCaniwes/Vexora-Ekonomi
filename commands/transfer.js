const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { ecoDb } = require('../utils/db');
const { successEmbed, warningEmbed } = require('../utils/embedUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Başka bir oyuncuya para gönderirsiniz.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Para göndermek istediğiniz kişi')
                .setRequired(true)
        )
        .addIntegerOption(option => 
            option.setName('miktar')
                .setDescription('Gönderilecek miktar')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        // Wrapper (prefix) veya Slash Command'dan gelen kullanıcı
        const user = interaction.user ? interaction.user : interaction.author;
        const userId = user.id;

        const targetMember = interaction.options.getMember('kullanici');
        const miktar = interaction.options.getInteger('miktar');

        if (!targetMember) {
            return interaction.reply({ content: 'Lütfen geçerli bir kullanıcı belirtin!', flags: MessageFlags.Ephemeral });
        }

        if (targetMember.user.bot) {
            return interaction.reply({ content: 'Botlara para gönderemezsiniz!', flags: MessageFlags.Ephemeral });
        }

        if (targetMember.user.id === userId) {
            return interaction.reply({ content: 'Kendinize para gönderemezsiniz!', flags: MessageFlags.Ephemeral });
        }

        if (miktar <= 0) {
            return interaction.reply({ content: 'Göndereceğiniz miktar 0\'dan büyük olmalıdır!', flags: MessageFlags.Ephemeral });
        }

        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;

        if (bakiye < miktar) {
            return interaction.reply({ content: `❌ Yetersiz bakiye! Cüzdanınızda **${bakiye.toLocaleString()} 🪙** var.`, flags: MessageFlags.Ephemeral });
        }

        // Parayı gönderenden al, alıcıya ekle
        ecoDb.cikar(`cuzdan_${userId}`, miktar);
        ecoDb.ekle(`cuzdan_${targetMember.user.id}`, miktar);

        const mesaj = `💸 | **${targetMember.displayName}** adlı oyuncuya başarıyla **${miktar.toLocaleString()} 🪙** transfer ettiniz!`;

        await interaction.reply({ content: mesaj });
    },
};
