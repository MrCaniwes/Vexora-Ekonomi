const { 
    ContainerBuilder, 
    TextDisplayBuilder, 
    SeparatorBuilder,
    SectionBuilder,
    ThumbnailBuilder
} = require('discord.js');

/**
 * Temel bir ContainerBuilder şablonu oluşturur
 */
function createBaseContainer(memberOrUser, title, description, color, emoji) {
    // Eğer üye (member) objesi verildiyse sunucu nickini (displayName), 
    // sadece kullanıcı (user) verildiyse genel adını (username) alırız.
    const displayName = memberOrUser.displayName || memberOrUser.username;

    return new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${emoji} ${title}`)
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(description)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**${displayName}**`)
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(memberOrUser.displayAvatarURL({ extension: 'png' }))
                )
        );
}

module.exports = {
    successContainer: (memberOrUser, title, description) => {
        return createBaseContainer(memberOrUser, title, description, 0x2ecc71, '✅');
    },

    errorContainer: (memberOrUser, title, description) => {
        return createBaseContainer(memberOrUser, title, description, 0xe74c3c, '❌');
    },

    warningContainer: (memberOrUser, title, description) => {
        return createBaseContainer(memberOrUser, title, description, 0xf1c40f, '⚠️');
    },

    customContainer: (memberOrUser, title, description, color = 0x5865F2, emoji = '✨') => {
        return createBaseContainer(memberOrUser, title, description, color, emoji);
    }
};
