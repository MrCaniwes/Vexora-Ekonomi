const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // Prefix'i .env dosyasından çek veya yoksa varsayılan olarak '!' kullan
        const prefix = process.env.PREFIX || '!';

        // Mesajı bot gönderdiyse veya mesaj prefix ile başlamıyorsa işlem yapma
        if (message.author.bot || !message.content.startsWith(prefix)) return;

        // Mesaj içeriğini parçalara ayırarak komut adını ve argümanları bul
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        let commandName = args.shift().toLowerCase();

        // İngilizce karakterleri Türkçe Slash komut isimlerine çeviren alias haritası
        const aliases = {
            'calis': 'çalış',
            'magaza': 'mağaza',
            'coinflip': 'yazı-tura',
            'yazitura': 'yazı-tura',
            'mines': 'mayın-tarlası',
            'mayin': 'mayın-tarlası',
            'highlow': 'büyük-küçük',
            'buyukkucuk': 'büyük-küçük',
            'blackjack': '21',
            'atyarisi': 'at-yarışı',
            'at-yarisi': 'at-yarışı',
            'yukselt': 'yükselt'
        };
        
        if (aliases[commandName]) commandName = aliases[commandName];

        // Önce prefix klasöründeki özel komutları ara
        let command = client.prefixCommands.get(commandName);

        // Eğer prefix klasöründe yoksa, Slash komutunu çalıştıracak bir sarmalayıcı (wrapper) yapalım
        if (!command) {
            const slashCommand = client.commands.get(commandName);
            if (slashCommand) {
                // Sahte interaction objesi oluştur (Sadece kullandığımız metodları içeriyor)
                let replyMessage = null;
                const fakeInteraction = {
                    user: message.author,
                    member: message.member,
                    guild: message.guild,
                    channel: message.channel,
                    options: {
                        getInteger: (name) => {
                            // Mentions vb. atlayıp sadece sayı olan ilk argümanı bul
                            const numIndex = args.findIndex(arg => !isNaN(parseInt(arg)) && !arg.startsWith('<@'));
                            if (numIndex !== -1) {
                                let val = parseInt(args[numIndex]);
                                args.splice(numIndex, 1);
                                return val;
                            }
                            return null;
                        },
                        getMember: (name) => message.mentions.members.first(),
                        getUser: (name) => message.mentions.users.first(),
                        getString: (name) => args.join(' ')
                    },
                    reply: async (options) => {
                        const sent = await message.reply(options);
                        replyMessage = sent;
                        return { resource: { message: sent } }; // collector için yapı
                    },
                    fetchReply: async () => {
                        return replyMessage;
                    },
                    followUp: async (options) => {
                        return await message.channel.send(options);
                    },
                    editReply: async (options) => {
                        if (replyMessage) {
                            return await replyMessage.edit(options);
                        }
                        return await message.reply(options);
                    },
                    client: client
                };
                
                try {
                    await slashCommand.execute(fakeInteraction);
                    return;
                } catch (err) {
                    console.error('Sarmalayıcı (wrapper) hatası:', err);
                }
            }
        }

        if (!command) return;

        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(`Prefix komutu (${commandName}) çalıştırılırken hata:`, error);
            message.reply('Bu komutu çalıştırırken bir hata oluştu!');
        }
    },
};
