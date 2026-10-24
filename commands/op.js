const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { ecoDb } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('öp')
        .setDescription('İstediğiniz bir kişiyi öpersiniz! (Bedeli: 150 🪙)')
        .addUserOption(option => 
            option.setName('hedef')
                .setDescription('Öpmek istediğiniz kullanıcı')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const aktifKullanici = interaction.user ? interaction.user : interaction.author;
        const hedefKullanici = interaction.options.getUser('hedef');

        if (!hedefKullanici) {
            return interaction.reply({ content: 'Kimi öpmek istediğini belirtmelisin! Örnek: `!öp @kullanıcı`', flags: MessageFlags.Ephemeral });
        }

        if (hedefKullanici.id === aktifKullanici.id) {
            return interaction.reply({ content: 'Kendini öpemezsin, bu fizik kurallarına aykırı! 💋', flags: MessageFlags.Ephemeral });
        }

        const bakiye = ecoDb.bul(`cuzdan_${aktifKullanici.id}`) || 0;
        const ucret = 150;
        
        if (bakiye < ucret) {
            return interaction.reply({ content: `❌ Birini öpmek için **${ucret} 🪙** ödemen gerekiyor! (Cüzdanın: ${bakiye.toLocaleString()} 🪙)`, flags: MessageFlags.Ephemeral });
        }

        ecoDb.cikar(`cuzdan_${aktifKullanici.id}`, ucret);

        const gifler = [
            'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3BvanVldGYzMWo4cDhnNHp4ZTN5anZrMzhyYjFxcjcybjZzMDhwcCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/W1hd3uXRIbddu/giphy.gif',
            'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2k3ajd4b3dqNDZycmlkeGVmZzF3bm0zc3EzMWVheXJqaW85c2xyeiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KmxmoHUGPDjfQXqGgv/giphy.gif',
            'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmp4MmIzNW8wcTlvcnB6cWU5cjV4cWR0NnB5Y2VldGhwYXo2cWZvMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/qFmdpUKAFZ6rMobzzu/giphy.gif',
            'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3Z6bGt2dzVnZmZocmRrbzRndWdrNXM3Y2kwM3hmZTBwdW1hN3VyaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/naAaDvbAoOYdW/giphy.gif'
        ];
        
        const rastgeleGif = gifler[Math.floor(Math.random() * gifler.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#e84393') // Pembe
            .setDescription(`💋 <@${aktifKullanici.id}>, kocaman bir öpücükle <@${hedefKullanici.id}> adlı kişiyi öptü!`)
            .setImage(rastgeleGif);

        await interaction.reply({ embeds: [embed] });
    }
};
