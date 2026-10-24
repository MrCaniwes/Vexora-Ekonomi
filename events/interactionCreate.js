const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Komut çalıştırılırken hata oluştu: ${error}`);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Bu komutu çalıştırırken bir hata oluştu!', ephemeral: true }).catch(()=>null);
                } else {
                    await interaction.reply({ content: 'Bu komutu çalıştırırken bir hata oluştu!', ephemeral: true }).catch(()=>null);
                }
            }
        }
        
        // Borsa Butonları
        if (interaction.isButton()) {
            if (interaction.customId === 'borsa_portfoy' || interaction.customId === 'borsa_al' || interaction.customId === 'borsa_sat') {
                const { borsaButtonHandler } = require('../utils/borsaHandler');
                await borsaButtonHandler(interaction);
            }
        }

        // Borsa Modalları
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'borsa_modal_al' || interaction.customId === 'borsa_modal_sat') {
                const { borsaModalHandler } = require('../utils/borsaHandler');
                await borsaModalHandler(interaction);
            }
        }
    },
};
