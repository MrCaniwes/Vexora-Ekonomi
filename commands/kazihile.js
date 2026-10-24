const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { userDb } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kazihile')
        .setDescription('Sadece sunucu sahibine özel! Bir kullanıcının sıradaki kazı kazan oyununu ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Sadece yetkililer
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Hile uygulanacak hedef oyuncu')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('sembol')
                .setDescription('Oyuncuya kesin olarak çıkacak sembol')
                .setRequired(true)
                .addChoices(
                    { name: '💎 Elmas (25x Katlar)', value: '💎' },
                    { name: '🍉 Karpuz (10x Katlar)', value: '🍉' },
                    { name: '🍋 Limon (5x Katlar)', value: '🍋' },
                    { name: '🍇 Üzüm (3x Katlar)', value: '🍇' },
                    { name: '🍒 Kiraz (2x Katlar)', value: '🍒' },
                    { name: '❌ Kesinlikle Kaybetsin', value: 'kayip' }
                )
        ),
        
    async execute(interaction) {
        const hedef = interaction.options.getUser('kullanici');
        const sembol = interaction.options.getString('sembol');

        // Hedef kullanıcının hesabına gizlice hile etiketini yerleştir
        userDb.ayarla(`hileli_kazi_${hedef.id}`, sembol);

        const mesaj = sembol === 'kayip' 
            ? `😈 Hile aktif edildi! **${hedef.username}** bir sonraki kazı kazan oynayışında **kesinlikle kaybedecek**.`
            : `🤫 Hile aktif edildi! **${hedef.username}** bir sonraki kazı kazan oynayışında kesinlikle **${sembol}** bulacak!`;

        // Mesajı sadece komutu yazan görebilir (ephemeral)
        await interaction.reply({ content: mesaj, flags: MessageFlags.Ephemeral });
    }
};
