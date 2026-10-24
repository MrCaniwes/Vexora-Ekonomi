const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ecoDb } = require('./db');
const { piyasayiGetir, VARLIKLAR } = require('./borsaSistemi');

let borsaTimeout = null;

const borsaMesajiOlustur = () => {
    const { piyasa, kalanZaman } = piyasayiGetir();
    const bitisZamani = Math.floor((Date.now() + Math.max(0, kalanZaman)) / 1000);
    
    const container = new ContainerBuilder().setAccentColor(0x34495e);
    
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### 📈 VEXORA Borsa & Yatırım\nPiyasa sürekli hareket halinde. Aşağıdaki butonlardan yatırım yapabilirsiniz!\n(Sonraki Dalgalanma: <t:${bitisZamani}:R>)\n`)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    let tablo = ``;
    for (const key in VARLIKLAR) {
        const f = piyasa[key].fiyat;
        const ef = piyasa[key].eskiFiyat;
        let durum = '➖';
        if (f > ef) durum = `🟢 (+%${(((f - ef) / ef) * 100).toFixed(1)})`;
        if (f < ef) durum = `🔴 (-%${(((ef - f) / ef) * 100).toFixed(1)})`;

        tablo += `**${VARLIKLAR[key].isim}**\n> 💰 Birim Fiyat: **${f.toLocaleString()} 🪙** ${durum}\n\n`;
    }

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(tablo));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('borsa_portfoy').setLabel('💼 Portföyüm').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('borsa_al').setLabel('🟢 Alış Yap').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('borsa_sat').setLabel('🔴 Satış Yap').setStyle(ButtonStyle.Danger)
    );
    
    container.addActionRowComponents(row);
    return container;
};

const guncelle = async (client) => {
    require('dotenv').config();
    const kanalId = process.env.BORSA_KANAL_ID;
    
    if (!kanalId) return;

    const kanal = await client.channels.fetch(kanalId).catch(() => null);
    if (!kanal) {
        console.error(`Borsa kanalı bulunamadı. Lütfen .env dosyasındaki BORSA_KANAL_ID değerini kontrol edin.`);
        return;
    }

    const { piyasa } = piyasayiGetir(); 
    const container = borsaMesajiOlustur();
    const mesajId = ecoDb.bul('borsa_mesaj_id');

    if (mesajId) {
        try {
            const mesaj = await kanal.messages.fetch(mesajId);
            await mesaj.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
            return;
        } catch (e) {
            // Mesaj silinmişse yenisini atacağız
        }
    }

    const yeniMesaj = await kanal.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    ecoDb.ayarla('borsa_mesaj_id', yeniMesaj.id);
};

const baslatBorsaDongusu = (client, hemenBaslat = false) => {
    if (borsaTimeout) clearTimeout(borsaTimeout);
    
    if (hemenBaslat) {
        guncelle(client);
    }
    
    const { kalanZaman } = piyasayiGetir();
    
    // Süre bittiğinde guncelle() çağır ve döngüyü tekrar kur
    borsaTimeout = setTimeout(() => {
        guncelle(client);
        baslatBorsaDongusu(client, false);
    }, Math.max(1000, kalanZaman)); 
};

module.exports = { baslatBorsaDongusu, borsaMesajiOlustur, guncelle };
