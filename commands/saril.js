const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { ecoDb } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sarıl')
        .setDescription('İstediğiniz bir kişiye sımsıkı sarılırsınız! (Bedeli: 50 🪙)')
        .addUserOption(option => 
            option.setName('hedef')
                .setDescription('Sarılmak istediğiniz kullanıcı')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const aktifKullanici = interaction.user ? interaction.user : interaction.author;
        const hedefKullanici = interaction.options.getUser('hedef');

        if (!hedefKullanici) {
            return interaction.reply({ content: 'Kime sarılmak istediğini belirtmelisin! Örnek: `!sarıl @kullanıcı`', flags: MessageFlags.Ephemeral });
        }

        if (hedefKullanici.id === aktifKullanici.id) {
            return interaction.reply({ content: 'Kendine sarılmak... Biraz üzücü. Gel ben sana sarılayım! 🫂', flags: MessageFlags.Ephemeral });
        }

        const bakiye = ecoDb.bul(`cuzdan_${aktifKullanici.id}`) || 0;
        const ucret = 50;
        
        if (bakiye < ucret) {
            return interaction.reply({ content: `❌ Birine sarılmak için **${ucret} 🪙** ödemen gerekiyor! (Cüzdanın: ${bakiye.toLocaleString()} 🪙)`, flags: MessageFlags.Ephemeral });
        }

        ecoDb.cikar(`cuzdan_${aktifKullanici.id}`, ucret);

        const gifler = [
            'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZzM4ZnVzdGZpNm42dHI1bDFveTN5bW5oZTMzYjRqY2Mxam5mb3pwOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/42YlR8u9gV5Cw/giphy.gif',
            'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbWEwcDZpdGM4eXR3NjZpdXcxZWNyeGFlcGp5cW9nbTRkcjBzdXpqMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/D5uT2tFIjlZQM3c92O/giphy.gif',
            'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjBud2NhcDhpcDZ4NzZwZWlidXVlNWp6bm9mdTlyOWZldHZ4Y2hhbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/16bJmyPvRbCDu/giphy.gif',
            'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHh4NjMybGp1b3Vlamtucnk5cm1ldzJiNmd2eXN4YXpxN2Z1cWhhcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/QbkL9WuorOlgI/giphy.gif',
            'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGcxMW91NDBwZW44Zjc2cnJtNjYxM3Z4MmFvcGpzMjZ6ZjN1aWprbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JGNmo9nBmmy8U/giphy.gif',
            'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzZvNDh1eTVxbTMzcm04aDhkOGNseGQ0NHBhNzFyamkyMm84NnJ4eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/VGACXbkf0AeGs/giphy.gif'
        ];
        
        const rastgeleGif = gifler[Math.floor(Math.random() * gifler.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#2ecc71') // Yeşil
            .setDescription(`🫂 <@${aktifKullanici.id}>, sevgiyle <@${hedefKullanici.id}> adlı kişiye sımsıkı sarıldı!`)
            .setImage(rastgeleGif);

        await interaction.reply({ embeds: [embed] });
    }
};
