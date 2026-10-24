const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { ecoDb } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tokatla')
        .setDescription('İstediğiniz bir kişiye sanal bir tokat atarsınız!')
        .addUserOption(option => 
            option.setName('hedef')
                .setDescription('Tokatlamak istediğiniz kullanıcı')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const tokatlayan = interaction.user ? interaction.user : interaction.author;
        const tokatlanan = interaction.options.getUser('hedef');

        if (!tokatlanan) {
            return interaction.reply({ content: 'Kimi tokatlamak istediğini belirtmelisin! Örnek: `!tokatla @kullanıcı`', flags: MessageFlags.Ephemeral });
        }

        if (tokatlanan.id === tokatlayan.id) {
            return interaction.reply({ content: 'Kendini neden tokatlıyorsun? Lütfen başka birini seç! 😂', flags: MessageFlags.Ephemeral });
        }

        if (tokatlanan.id === interaction.client.user.id) {
            return interaction.reply({ content: 'Bana tokat atamazsın, ben sadece bir botum! 🤖🛡️', flags: MessageFlags.Ephemeral });
        }

        const bakiye = ecoDb.bul(`cuzdan_${tokatlayan.id}`) || 0;
        if (bakiye < 100) {
            return interaction.reply({ content: `❌ Birini tokatlamak için **100 🪙** ödemen gerekiyor! (Cüzdanın: ${bakiye.toLocaleString()} 🪙)`, flags: MessageFlags.Ephemeral });
        }

        ecoDb.cikar(`cuzdan_${tokatlayan.id}`, 100);

        const gifler = [
            'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjI4dHhsNGpwOGlvZW83M3UxZXpkZXlyZzl2cXRndzAwbWIyeWJraiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/uqSU9IEYEKAbS/giphy.gif',
            'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbDZ5c2RkYnlncGxueGJ3a3RzbTNpZ25yc2U5YzkxZzc4cWt0b3R3dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/mEtSQlxqBtWWA/giphy.gif',
            'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGc3cDN6NHA1dHNnejg4bHk0ZXpkamQ5czNwNmFmZzYxNHc1ZHJ4cSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Gf3AUz3eBNbTW/giphy.gif',
            'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExemxpM29rYXc5dWdvbXF3dTR5ZzIxb3JyMnp2b3o3ZjBkOXJvdm0wayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xUO4t2gkWBxDi/giphy.gif',
            'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdTZoYjJqMHdieGdkejB3dmFscTR5MTRmdG5qZHpkNm9zcXNrdHEzNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/k1uYB5LvlBZqU/giphy.gif',
            'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2w5cDk0bTZtMjhyaXZtMHRhaGJtb3BqdmswenBkcDN6NTlyN2t6YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/u2LJ0n4lx6jF6/giphy.gif'
        ];

        // Discord embedleri sayfaları (klipy.com vb.) resim olarak gömemediği için 
        // doğrudan .gif uzantılı yüksek kaliteli tokat gifleri ile değiştirdim.
        
        const rastgeleGif = gifler[Math.floor(Math.random() * gifler.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#ff4757') // Tatlı bir kırmızı
            .setDescription(`👋 <@${tokatlayan.id}>, acımadan <@${tokatlanan.id}> adlı kişiyi tokatladı!`)
            .setImage(rastgeleGif);

        await interaction.reply({ embeds: [embed] });
    }
};
