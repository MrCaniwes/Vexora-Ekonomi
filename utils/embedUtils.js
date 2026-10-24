const { EmbedBuilder } = require('discord.js');

/**
 * Temel bir Embed şablonu oluşturur
 */
function createBaseEmbed(member, title, description, color) {
    const displayName = member.displayName || member.username;
    
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ 
            name: displayName, 
            iconURL: member.displayAvatarURL({ dynamic: true }) 
        })
        .setTitle(title)
        .setDescription(description);
}

module.exports = {
    /**
     * Başarılı işlemleri göstermek için yeşil temalı embed
     */
    successEmbed: (member, title, description) => {
        return createBaseEmbed(member, `✅ ${title}`, description, '#2ecc71');
    },

    /**
     * Hatalı işlemleri göstermek için kırmızı temalı embed
     */
    errorEmbed: (member, title, description) => {
        return createBaseEmbed(member, `❌ ${title}`, description, '#e74c3c');
    },

    /**
     * Uyarıları göstermek için sarı temalı embed
     */
    warningEmbed: (member, title, description) => {
        return createBaseEmbed(member, `⚠️ ${title}`, description, '#f1c40f');
    },

    /**
     * Özel renk ile embed
     */
    customEmbed: (member, title, description, color = '#5865F2', emoji = '✨') => {
        return createBaseEmbed(member, `${emoji} ${title}`, description, color);
    }
};
