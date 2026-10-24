const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { ecoDb } = require('./db');

// Eşik Değerleri (Sunucuyu ve kanalı spamden korumak için sadece kayda değer kazançlar)
const MIN_KAZANC_ESIGI = 1500; // En az 1.500 🪙
const MIN_CARPAN_ESIGI = 2.5;  // Veya en az 2.5x çarpan

// Bildirim kuyruğu (Rate limit ve sunucu yorulmasını önlemek için kuyruk & throttling)
const bildirimKuyrugu = [];
let bildirimDongusuAktif = false;
let globalClient = null;

function initCanliDurum(client) {
    globalClient = client;
    if (!bildirimDongusuAktif) {
        bildirimDongusuAktif = true;
        kuyruguIsle();
    }
}

/**
 * Kazanç bildirimi ekler
 * @param {Object} param0 
 * @param {string} param0.userId - Kazanan kullanıcının ID'si
 * @param {string} param0.oyunAdi - Oynanan oyunun adı (örn: 'Plinko', 'Crash Arena')
 * @param {number} param0.bahis - Yatırılan miktar
 * @param {number} param0.kazanc - Kazanılan miktar
 * @param {number} param0.carpan - Elde edilen çarpan
 * @param {string} [param0.kaynak] - 'web' veya 'discord'
 */
function canliDurumBildir({ userId, oyunAdi, bahis, kazanc, carpan, kaynak = 'web' }) {
    if (!userId || !kazanc || kazanc <= 0) return;

    // Küçük kazanç filtresi: 10.000 coin altı VE 5x altı kazançları yoksay
    const netKazanc = kazanc - (bahis || 0);
    const gecerliCarpan = carpan || (bahis > 0 ? (kazanc / bahis) : 1);

    if (kazanc < MIN_KAZANC_ESIGI && gecerliCarpan < MIN_CARPAN_ESIGI) {
        return; // Filtreden geçemedi (küçük kazanç)
    }

    // Aşırı kuyruk birikmesini önle (max 50 bekleyen bildirim)
    if (bildirimKuyrugu.length >= 50) {
        bildirimKuyrugu.shift();
    }

    bildirimKuyrugu.push({
        userId,
        oyunAdi,
        bahis: Math.floor(bahis || 0),
        kazanc: Math.floor(kazanc),
        carpan: Number(gecerliCarpan.toFixed(2)),
        kaynak,
        tarih: Date.now()
    });
}

// Kuyruğu belirli aralıklarla (en az 4-5 saniye) Discord'a göndererek sunucuyu ve kanalı yormayan işlemci
async function kuyruguIsle() {
    while (bildirimDongusuAktif) {
        try {
            if (bildirimKuyrugu.length > 0 && globalClient) {
                // Kanal ID: Öncelikle .env içindeki CANLI_DURUM_KANAL_ID, yoksa DB'deki ayar
                require('dotenv').config();
                const kanalId = process.env.CANLI_DURUM_KANAL_ID || ecoDb.bul('canli_durum_kanal_id');

                if (kanalId) {
                    const kanal = await globalClient.channels.fetch(kanalId).catch(() => null);
                    if (kanal && kanal.isTextBased()) {
                        const item = bildirimKuyrugu.shift();
                        
                        // Kullanıcı bilgisini çek
                        let kullaniciAdi = `<@${item.userId}>`;
                        try {
                            const user = await globalClient.users.fetch(item.userId).catch(() => null);
                            if (user) kullaniciAdi = `**${user.username}** (<@${user.id}>)`;
                        } catch (e) {}

                        // Renk ve Rozet belirleme
                        let accentColor = 0x10b981; // Yeşil
                        let baslikEmoji = '🎰';
                        let tebrik = 'Büyük Kazanç!';

                        if (item.carpan >= 50 || item.kazanc >= 250000) {
                            accentColor = 0xf43f5e; // Efsanevi Pembe/Kırmızı
                            baslikEmoji = '🔥';
                            tebrik = 'DEVASA REKOR KAZANÇ!';
                        } else if (item.carpan >= 15 || item.kazanc >= 50000) {
                            accentColor = 0xf59e0b; // Altın Sarısı
                            baslikEmoji = '⚡';
                            tebrik = 'YÜKSEK VURGUN!';
                        }

                        const container = new ContainerBuilder()
                            .setAccentColor(accentColor)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `### ${baslikEmoji} CANLI DURUM: ${tebrik}\n` +
                                    `${kullaniciAdi} az önce **${item.oyunAdi}** oyununda servet kazandı!\n`
                                )
                            )
                            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `🪙 **Kazanılan Tutar:** **+${item.kazanc.toLocaleString()} 🪙**\n` +
                                    `🎯 **Çarpan:** **${item.carpan}x**\n` +
                                    `💰 **Yatırılan Bahis:** ${item.bahis.toLocaleString()} 🪙\n` +
                                    `🌐 **Platform:** ${item.kaynak === 'web' ? '🖥️ Web Casino' : '💬 Discord Komutu'}\n` +
                                    `⏱️ **Zaman:** <t:${Math.floor(item.tarih / 1000)}:R>`
                                )
                            );

                        await kanal.send({ 
                            components: [container], 
                            flags: MessageFlags.IsComponentsV2 
                        }).catch(err => {
                            console.error('[Canlı Durum] Mesaj gönderilemedi:', err.message);
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[Canlı Durum Kuyruk Hatası]:', err);
        }

        // Sunucuyu ve Discord rate-limit'i yormamak için her bildirim arası en az 4 saniye bekle
        await new Promise(r => setTimeout(r, 4500));
    }
}

module.exports = {
    initCanliDurum,
    canliDurumBildir,
    MIN_KAZANC_ESIGI,
    MIN_CARPAN_ESIGI
};
