const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { ecoDb, userDb } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boşan')
        .setDescription('Eşinizden boşanmanızı sağlar. (Avukat masrafı: 20.000 🪙)'),
        
    async execute(interaction) {
        const userId = interaction.user ? interaction.user.id : interaction.author.id;
        
        const evlilikVerisi = userDb.bul(`evlilik_${userId}`);

        if (!evlilikVerisi) {
            return interaction.reply({ content: 'Zaten evli değilsin! 🤷‍♂️', flags: MessageFlags.Ephemeral });
        }

        const avukatMasrafi = 5000;
        const cuzdan = ecoDb.bul(`cuzdan_${userId}`) || 0;

        if (cuzdan < avukatMasrafi) {
            return interaction.reply({ content: `❌ Boşanmak sandığın kadar kolay değil! Avukat masrafları için en az **${avukatMasrafi.toLocaleString()} 🪙** paraya ihtiyacın var.`, flags: MessageFlags.Ephemeral });
        }

        ecoDb.cikar(`cuzdan_${userId}`, avukatMasrafi);
        
        const partnerId = evlilikVerisi.partnerId;
        
        // İki taraftan da evlilik verisini sil
        userDb.sil(`evlilik_${userId}`);
        userDb.sil(`evlilik_${partnerId}`);

        const embed = new EmbedBuilder()
            .setColor('#34495e')
            .setTitle('📜 Boşanma Kararı')
            .setDescription(`<@${userId}> ve <@${partnerId}> resmi olarak boşandılar.\n\nMahkeme kararıyla boşanma davası masrafı olarak **${avukatMasrafi.toLocaleString()} 🪙** kesildi.\nYüzüğün gücü sonsuza dek kayboldu.`);

        await interaction.reply({ embeds: [embed] });
    }
};
