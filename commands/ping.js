const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botun gecikme süresini (ping) gösterir.'),
    async execute(interaction) {
        await interaction.reply(`Pong! Gecikme süresi: ${interaction.client.ws.ping}ms`);
    },
};
