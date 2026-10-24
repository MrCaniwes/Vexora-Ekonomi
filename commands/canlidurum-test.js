const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ecoDb } = require('../utils/db');
const { canliDurumBildir } = require('../utils/canliDurum');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('canlidurum-test')
        .setDescription('Canlı durum kanalına örnek bir test bildirimi gönderir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const kanalId = ecoDb.bul('canli_durum_kanal_id') || process.env.CANLI_DURUM_KANAL_ID;

        if (!kanalId) {
            return await interaction.reply({
                content: '⚠️ Henüz bir canlı durum kanalı ayarlanmamış! Lütfen önce `/canlidurum-ayarla #kanal` komutuyla bir kanal belirleyin.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Test bildirimi tetikle
        canliDurumBildir({
            userId: interaction.user.id,
            oyunAdi: 'Plinko (Test)',
            bahis: 500,
            kazanc: 5000,
            carpan: 10,
            kaynak: 'web'
        });

        await interaction.reply({
            content: `✅ Test bildirimi sıraya alındı! 1-4 saniye içinde <#${kanalId}> kanalına düşecektir.`,
            flags: MessageFlags.Ephemeral
        });
    }
};
