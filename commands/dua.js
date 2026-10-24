const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { cooldownDb } = require('../utils/db');
const { degistirKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');

// Cooldown: 12 Saat
const COOLDOWN_SURESI = 12 * 60 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dua')
        .setDescription('Bir dostun için dua edersin! Hedefin şansı kalıcı olarak +1 artar.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Dua etmek istediğiniz oyuncu')
                .setRequired(true)
        ),

    async execute(interaction) {
        const duaEden = interaction.user;
        const hedefUser = interaction.options.getUser('kullanici');

        if (!hedefUser) {
            return interaction.reply({ content: '❌ Lütfen dua etmek istediğiniz birini belirtin! (Örn: `!dua @kullanici`)', flags: MessageFlags.Ephemeral });
        }

        if (hedefUser.bot) {
            return interaction.reply({ content: '❌ Botlara dua edemezsin, onların ruhu yok!', flags: MessageFlags.Ephemeral });
        }

        if (hedefUser.id === duaEden.id) {
            return interaction.reply({ 
                content: '❌ **Kendi kendine dua edemezsin!** Birbirinize destek olmalı ve hayır dualarını paylaşmalısınız. Git bir arkadaşından rica et!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const suan = Date.now();

        // 12 Saat Cooldown Kontrolü (Dua eden kişinin cooldown'u)
        const sonDua = cooldownDb.bul(`dua_${duaEden.id}`);
        if (sonDua && suan < sonDua + COOLDOWN_SURESI) {
            const kalanMilisaniye = (sonDua + COOLDOWN_SURESI) - suan;
            const kalanSaat = Math.floor(kalanMilisaniye / (1000 * 60 * 60));
            const kalanDakika = Math.ceil((kalanMilisaniye % (1000 * 60 * 60)) / (1000 * 60));
            return interaction.reply({
                content: `🤲 Henüz yeni dua ettin ve kalbin huzurlu. Tekrar bir başkasına dua etmek için **${kalanSaat} saat ${kalanDakika} dakika** beklemelisin.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Hedefin puanını kalıcı olarak +1 artır
        const yeniPuan = degistirKaderPuani(hedefUser.id, 1);
        cooldownDb.ayarla(`dua_${duaEden.id}`, suan);

        const container = new ContainerBuilder().setAccentColor(0x2ecc71);

        let auraMetni = '';
        if (yeniPuan > 0) {
            auraMetni = `✨ **Kutsanmış (+${yeniPuan} Dua)** | Şans Bonusu: **+%${(yeniPuan * PUAN_BASINA_SANS * 100).toFixed(0)}**`;
        } else if (yeniPuan < 0) {
            auraMetni = `💀 **Lanetli (${yeniPuan} Lanet)** | Şans Kaybı: **%${(yeniPuan * PUAN_BASINA_SANS * 100).toFixed(0)}** *(Dua sayesinde laneti hafifledi!)*`;
        } else {
            auraMetni = `⚖️ **Nötr (0 Puan)** | *(Üzerindeki tüm lanetler temizlendi ve dengelendi!)*`;
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🤲 Bir Dostun İçin Dua Ettin!\n**${duaEden.displayName}**, ellerini semaya açıp samimiyetle **<@${hedefUser.id}>** için hayır duasında bulundu! İlahi bir şans ve bereket ruhunu sardı.`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const detay = `🌟 **Kutsanan Oyuncu:** <@${hedefUser.id}>\n` +
                      `📈 **Kazanılan Etki:** Hedefin kader havuzu **+1 Puan** arttı! (Şansı kalıcı **+%${(PUAN_BASINA_SANS * 100).toFixed(0)}** yükseldi)\n` +
                      `🔮 **Hedefin Güncel Kaderi:** ${auraMetni}\n` +
                      `⏳ **Sonraki Dua Hakkın:** <t:${Math.floor((suan + COOLDOWN_SURESI) / 1000)}:R>\n\n` +
                      `💡 *Not: Mayın Tarlası gibi taktiksel oyunlarda kader işlemez.*`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detay));

        return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};
