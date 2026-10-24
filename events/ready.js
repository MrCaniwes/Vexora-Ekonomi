const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        const { ActivityType } = require('discord.js');
        console.log(`Hazır! ${client.user.tag} olarak giriş yapıldı.`);

        const durumlar = [
            { name: '💰 !çalış | Pasif Gelirler', type: ActivityType.Playing },
            { name: '📈 !borsa | Al & Sat', type: ActivityType.Watching },
            { name: '🎰 !oyunlar | Casino', type: ActivityType.Playing },
            { name: '🪙 VEXORA Ekonomi', type: ActivityType.Listening },
            { name: '🏢 !topla | İşletmeler', type: ActivityType.Watching }
        ];

        let index = 0;
        setInterval(() => {
            if (index >= durumlar.length) index = 0;
            client.user.setPresence({
                activities: [durumlar[index]],
                status: 'online'
            });
            index++;
        }, 10000); // 10 saniyede bir değiştir

        // Otomatik Borsa Sistemini Başlat
        const { baslatBorsaDongusu } = require('../utils/borsaDongusu');
        baslatBorsaDongusu(client, true);

        // Canlı Durum Bildirim Motorunu Başlat
        const { initCanliDurum } = require('../utils/canliDurum');
        initCanliDurum(client);
    },
};
