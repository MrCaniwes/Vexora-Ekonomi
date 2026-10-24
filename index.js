require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // Prefix komutları için mesajları okuma izni
    ] 
});

client.commands = new Collection(); // Slash komutları
client.prefixCommands = new Collection(); // Prefix komutları

// Slash Komutlarını Yükleme
const commandsData = [];
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commandsData.push(command.data.toJSON());
        } else {
            console.log(`[UYARI] ${filePath} dosyasındaki komutta 'data' veya 'execute' özelliği eksik.`);
        }
    }
}

// Prefix Komutlarını Yükleme
const prefixCommandsPath = path.join(__dirname, 'prefixCommands');
if (!fs.existsSync(prefixCommandsPath)) fs.mkdirSync(prefixCommandsPath);
const prefixCommandFiles = fs.readdirSync(prefixCommandsPath).filter(file => file.endsWith('.js'));
for (const file of prefixCommandFiles) {
    const filePath = path.join(prefixCommandsPath, file);
    const command = require(filePath);
    if ('name' in command && 'execute' in command) {
        client.prefixCommands.set(command.name, command);
    } else {
        console.log(`[UYARI] ${filePath} dosyasındaki komutta 'name' veya 'execute' özelliği eksik.`);
    }
}

// Eventleri Yükleme
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`${commandsData.length} adet slash (/) komutu Discord API'ye yükleniyor...`);
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commandsData },
        );
        console.log(`${data.length} adet slash (/) komutu başarıyla yüklendi.`);
        
        await client.login(process.env.DISCORD_TOKEN);

        // Web Panelini Başlat
        const { startWebServer } = require('./utils/webServer');
        startWebServer(client);
    } catch (error) {
        console.error('Komutlar yüklenirken veya bot başlatılırken hata oluştu:', error);
    }
})();
