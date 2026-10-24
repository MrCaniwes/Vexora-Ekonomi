const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { ecoDb, cooldownDb } = require('../utils/db');
const { degistirKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');
const { checkTilsim } = require('../utils/tilsimUtils');

// Ücret: 10.000 🪙
const LANET_UCRETI = 10000;
// Cooldown: 12 Saat
const COOLDOWN_SURESI = 12 * 60 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lanet')
        .setDescription('Rakibine kara büyü yapıp lanetlersin! Hedefin şansı kalıcı olarak düşer.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Lanetlemek istediğiniz oyuncu')
                .setRequired(true)
        ),

    async execute(interaction) {
        const lanetleyen = interaction.user;
        const hedefUser = interaction.options.getUser('kullanici');

        if (!hedefUser) {
            return interaction.reply({ content: '❌ Lütfen lanetlemek istediğiniz birini etiketleyin! (Örn: `!lanet @kullanici`)', flags: MessageFlags.Ephemeral });
        }

        if (hedefUser.bot) {
            return interaction.reply({ content: '❌ Botlara kara büyü işlemez!', flags: MessageFlags.Ephemeral });
        }

        if (hedefUser.id === lanetleyen.id) {
            return interaction.reply({ content: '❌ Kendini lanetleyemezsin!', flags: MessageFlags.Ephemeral });
        }

        const suan = Date.now();

        // 12 Saat Cooldown Kontrolü
        const sonLanet = cooldownDb.bul(`lanet_${lanetleyen.id}`);
        if (sonLanet && suan < sonLanet + COOLDOWN_SURESI) {
            const kalanMilisaniye = (sonLanet + COOLDOWN_SURESI) - suan;
            const kalanSaat = Math.floor(kalanMilisaniye / (1000 * 60 * 60));
            const kalanDakika = Math.ceil((kalanMilisaniye % (1000 * 60 * 60)) / (1000 * 60));
            return interaction.reply({
                content: `⏳ Kara büyü enerjini henüz toparlayamadın! Tekrar lanet okumak için **${kalanSaat} saat ${kalanDakika} dakika** beklemelisin.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Bakiye kontrolü
        const cuzdan = ecoDb.bul(`cuzdan_${lanetleyen.id}`) || 0;
        if (cuzdan < LANET_UCRETI) {
            return interaction.reply({
                content: `❌ Kara büyü ve kurban masrafı için **${LANET_UCRETI.toLocaleString()} 🪙** gerekiyor! (Cüzdanın: ${cuzdan.toLocaleString()} 🪙)`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Parayı kes ve cooldown ayarla
        ecoDb.cikar(`cuzdan_${lanetleyen.id}`, LANET_UCRETI);
        cooldownDb.ayarla(`lanet_${lanetleyen.id}`, suan);

        // 1. Tılsım Kontrolü: Yansıma Aynası var mı?
        const yansima = checkTilsim(hedefUser.id, 'yansima');
        if (yansima) {
            // Büyü geri teper ve lanetleyen kişiyi vurur!
            const sekenPuan = degistirKaderPuani(lanetleyen.id, -1);
            const container = new ContainerBuilder().setAccentColor(0xe74c3c);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### 🪞 Büyü Geri Tepti! (Yansıma Aynası)\n**<@${hedefUser.id}>** üzerindeki **Yansıma Aynası**, **${lanetleyen.displayName}** tarafından gönderilen kara büyüyü aynen geri yansıttı!`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`💥 **Kendi Kazdığı Kuyuya Düştü:** Lanet bumerang gibi geri döndü ve <@${lanetleyen.id}> **-1 Lanet Puanı** aldı!\n🔮 **Güncel Kaderin:** ${sekenPuan} Puan`)
            );
            return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // 2. Tılsım Kontrolü: Nazar Boncuğu var mı?
        const koruma = checkTilsim(hedefUser.id, 'koruma');
        if (koruma) {
            const container = new ContainerBuilder().setAccentColor(0x3498db);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### 🧿 Lanet Engellendi! (Nazar Boncuğu)\n**<@${hedefUser.id}>** üzerindeki **Nazar Boncuğu**, kara büyüyü ve kem gözleri tamamen savuşturdu! Büyü boşa gitti.`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`🛡️ Hedefin koruması aşılmaz bir kalkan gibi duruyor. Harcanan 10.000 🪙 buharlaştı!`)
            );
            return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // Hedefin puanını kalıcı olarak -1 düşür
        const hedefYeniPuan = degistirKaderPuani(hedefUser.id, -1);

        const container = new ContainerBuilder().setAccentColor(0x9b59b6);

        let hedefAura = '';
        if (hedefYeniPuan < 0) {
            hedefAura = `💀 **${hedefYeniPuan} Lanet** | Şans Kaybı: **%${(hedefYeniPuan * PUAN_BASINA_SANS * 100).toFixed(0)}**`;
        } else if (hedefYeniPuan > 0) {
            hedefAura = `✨ **+${hedefYeniPuan} Dua** | *(Lanet basıldı ve duaları zayıfladı!)*`;
        } else {
            hedefAura = `⚖️ **Nötr (0 Puan)** | *(Duaları tamamen sıfırlandı!)*`;
        }

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🔮 Kara Büyü & Lanet Gerçekleşti!\n**${lanetleyen.displayName}**, 10.000 🪙 harcayarak **<@${hedefUser.id}>** üzerine kalıcı bir nazar ve kara büyü fısıldadı!`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        const detay = `💀 **Hedef Oyuncu:** <@${hedefUser.id}>\n` +
                      `📉 **Uygulanan Etki:** Hedefin kader havuzu **-1 Puan** düştü! (Şansı kalıcı **-%${(PUAN_BASINA_SANS * 100).toFixed(0)}** azaldı)\n` +
                      `🔮 **Hedefin Güncel Kaderi:** ${hedefAura}\n` +
                      `⏳ **Sonraki Lanet:** <t:${Math.floor((suan + COOLDOWN_SURESI) / 1000)}:R>\n\n` +
                      `✨ *İpucu: Kurban \`/dua\` ederek kader puanını tekrar yükseltebilir!*`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detay));

        return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};
