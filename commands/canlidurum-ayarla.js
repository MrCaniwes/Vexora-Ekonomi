const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const { ecoDb } = require('../utils/db');
const { MIN_KAZANC_ESIGI, MIN_CARPAN_ESIGI } = require('../utils/canliDurum');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('canlidurum-ayarla')
        .setDescription('Büyük kazançların duyurulacağı canlı-durum kanalını belirler veya kapatır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => 
            option.setName('kanal')
                .setDescription('Canlı durum duyurularının yapılacağı metin kanalı (Boş bırakılırsa sistem kapatılır)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const secilenKanal = interaction.options.getChannel('kanal');

        if (!secilenKanal) {
            ecoDb.sil('canli_durum_kanal_id');
            
            const container = new ContainerBuilder()
                .setAccentColor(0xe74c3c)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('### 🔕 Canlı Durum Bildirimleri Kapatıldı\nCanlı durum kanalı sıfırlandı. Artık otomatik kazanç bildirimleri atılmayacak.')
                );

            return await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        if (!secilenKanal.isTextBased()) {
            return await interaction.reply({ 
                content: '❌ Lütfen geçerli bir metin kanalı seçin!', 
                ephemeral: true 
            });
        }

        ecoDb.ayarla('canli_durum_kanal_id', secilenKanal.id);

        const container = new ContainerBuilder()
            .setAccentColor(0x10b981)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### 📢 Canlı Durum Kanalı Ayarlandı!\n` +
                    `Büyük kazançlar artık anlık olarak ${secilenKanal} kanalına aktarılacak.\n`
                )
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `🛡️ **Spam & Performans Koruması:**\n` +
                    `• **Minimum Kazanç Eşiği:** ${MIN_KAZANC_ESIGI.toLocaleString()} 🪙 veya **${MIN_CARPAN_ESIGI}x** çarpan.\n` +
                    `• **Hız Limiti:** Sunucuyu ve Discord API'sini yormamak için her bildirim arasına en az 4.5 saniye aralık uygulanır.\n` +
                    `• Küçük ve önemsiz kazançlar kanala düşmez, sunucuda kalabalık yapmaz.`
                )
            );

        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};
