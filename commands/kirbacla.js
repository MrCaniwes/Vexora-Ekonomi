const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { ecoDb } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kırbaçla')
        .setDescription('İstediğiniz bir kişiyi kırbaçlarsınız! (Bedeli: 200 🪙)')
        .addUserOption(option => 
            option.setName('hedef')
                .setDescription('Kırbaçlamak istediğiniz kullanıcı')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        const aktifKullanici = interaction.user ? interaction.user : interaction.author;
        const hedefKullanici = interaction.options.getUser('hedef');

        if (!hedefKullanici) {
            return interaction.reply({ content: 'Kimi kırbaçlamak istediğini belirtmelisin! Örnek: `!kırbaçla @kullanıcı`', flags: MessageFlags.Ephemeral });
        }

        if (hedefKullanici.id === aktifKullanici.id) {
            return interaction.reply({ content: 'Kendini neden kırbaçlıyorsun? Lütfen başka birini seç! 😬', flags: MessageFlags.Ephemeral });
        }

        if (hedefKullanici.id === interaction.client.user.id) {
            return interaction.reply({ content: 'Bana kırbaç sökmez, ben çelikten yapıldım! 🤖🛡️', flags: MessageFlags.Ephemeral });
        }

        const bakiye = ecoDb.bul(`cuzdan_${aktifKullanici.id}`) || 0;
        const ucret = 200;
        
        if (bakiye < ucret) {
            return interaction.reply({ content: `❌ Birini kırbaçlamak için **${ucret} 🪙** ödemen gerekiyor! (Cüzdanın: ${bakiye.toLocaleString()} 🪙)`, flags: MessageFlags.Ephemeral });
        }

        ecoDb.cikar(`cuzdan_${aktifKullanici.id}`, ucret);

        const gifler = [
            'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTdrMDhuNnl0c3o2cXA2enlzY3Y3a216Z3oybzBwZDI2bHY0bHR2eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0ErD3ZBW6vQgYCgE/giphy.gif',
            'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWhtaW5kaTI0eGUzYmkxaW05a3E3YjQzMTI2b29pZ3FwcmNjaTBrbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/23LIwxLIXgr6M/giphy.gif',
            'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnM3djFqenIyenQycG4xa3V3Mm5tMmZscnVmMzM5dGppMDFjbnhmaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/eJMMTagmkI6fncNoVi/giphy.gif',
            'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHFxZ21wd3I5eDlld2VzNGs2eWUwZDJmaWIzMnAxaTZpaWE5MHRnYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/VyjosVIFq5Z96/giphy.gif',
            'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExeDdkeDBrcTUwcTU1M3prdnNza3ZvMWkwNjNsM3hwcDFuYnMzZnc3EzZnc3dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/7J8675iO9e3JeOOqRd/giphy.gif'
        ];
        
        const rastgeleGif = gifler[Math.floor(Math.random() * gifler.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#8e44ad') // Mor tema
            .setDescription(`💥 **ŞLAAAK!**\n<@${aktifKullanici.id}>, acımadan <@${hedefKullanici.id}> adlı kişiyi kırbaçladı!`)
            .setImage(rastgeleGif);

        await interaction.reply({ embeds: [embed] });
    }
};
