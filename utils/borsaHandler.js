const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { ecoDb, userDb } = require('./db');
const { VARLIKLAR, piyasayiGetir, UPDATE_INTERVAL } = require('./borsaSistemi');

const borsaButtonHandler = async (i) => {
    const userId = i.user.id;
    const { piyasa } = piyasayiGetir();
    let cüzdan = userDb.bul(`portfoy_${userId}`) || {}; 

    if (i.customId === 'borsa_portfoy') {
        let pYazi = `### 💼 Yatırım Çantan\n\n`;
        let toplamDeger = 0;
        let toplamMaliyet = 0;
        
        let varlikVarMi = false;
        for (const key in VARLIKLAR) {
            let veri = cüzdan[key];
            if (!veri) continue;
            
            let adet = typeof veri === 'number' ? veri : veri.adet;
            let maliyet = typeof veri === 'number' ? adet * piyasa[key].fiyat : veri.maliyet;

            if (adet > 0) {
                varlikVarMi = true;
                const deger = adet * piyasa[key].fiyat;
                toplamDeger += deger;
                toplamMaliyet += maliyet;
                
                const karZarar = deger - maliyet;
                let durum = karZarar >= 0 ? `🟢 +${Math.floor(karZarar).toLocaleString()}` : `🔴 ${Math.ceil(karZarar).toLocaleString()}`;
                
                pYazi += `**${VARLIKLAR[key].isim} (${key.toUpperCase()}):** ${adet.toLocaleString()} adet (Değer: ${Math.floor(deger).toLocaleString()} 🪙 | K/Z: ${durum})\n`;
            }
        }

        if (!varlikVarMi) pYazi += `*Şu an elinizde hiçbir yatırım bulunmuyor.*\n`;
        
        const toplamKZ = toplamDeger - toplamMaliyet;
        let genelDurum = toplamKZ >= 0 ? `🟢 +${Math.floor(toplamKZ).toLocaleString()}` : `🔴 ${Math.ceil(toplamKZ).toLocaleString()}`;
        
        pYazi += `\n**📊 Toplam Portföy Değeri:** ${Math.floor(toplamDeger).toLocaleString()} 🪙 (Genel K/Z: ${genelDurum})`;

        return i.reply({ content: pYazi, flags: MessageFlags.Ephemeral });
    }

    if (i.customId === 'borsa_al' || i.customId === 'borsa_sat') {
        const islem = i.customId === 'borsa_al' ? 'al' : 'sat';
        
        const modal = new ModalBuilder()
            .setCustomId(`borsa_modal_${islem}`)
            .setTitle(islem === 'al' ? 'Yatırım Satın Al' : 'Yatırım Sat');

        const varlikInput = new TextInputBuilder()
            .setCustomId('varlik_kodu')
            .setLabel('Varlık Kodu (Örn: usd, btc, altin, vex)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const miktarInput = new TextInputBuilder()
            .setCustomId('miktar')
            .setLabel('Kaç Adet?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(varlikInput));
        modal.addComponents(new ActionRowBuilder().addComponents(miktarInput));
        
        await i.showModal(modal);
    }
};

const borsaModalHandler = async (modalInteraction) => {
    const userId = modalInteraction.user.id;
    const islem = modalInteraction.customId === 'borsa_modal_al' ? 'al' : 'sat';
    
    const girilenVarlik = modalInteraction.fields.getTextInputValue('varlik_kodu').toLowerCase().trim();
    const girilenMiktar = parseInt(modalInteraction.fields.getTextInputValue('miktar'));

    if (!VARLIKLAR[girilenVarlik]) {
        await modalInteraction.reply({ content: `❌ Hatalı varlık kodu! Lütfen listelenen kodlardan birini girin (usd, altin, btc, vex).`, flags: MessageFlags.Ephemeral }).catch(() => {});
        return;
    }

    if (isNaN(girilenMiktar) || girilenMiktar <= 0) {
        await modalInteraction.reply({ content: '❌ Lütfen geçerli bir adet girin!', flags: MessageFlags.Ephemeral }).catch(() => {});
        return;
    }

    const { piyasa } = piyasayiGetir();
    const fiyat = piyasa[girilenVarlik].fiyat;
    const toplamTutar = Math.round(fiyat * girilenMiktar);
    const nakit = ecoDb.bul(`cuzdan_${userId}`) || 0;
    
    let cüzdan = userDb.bul(`portfoy_${userId}`) || {}; 
    let mevcut = cüzdan[girilenVarlik];
    
    if (typeof mevcut === 'number') {
        mevcut = { adet: mevcut, maliyet: mevcut * fiyat };
    } else if (!mevcut) {
        mevcut = { adet: 0, maliyet: 0 };
    }
    
    const ETKI_KATSAYISI = 0.01; 
    const HEDEF_HACIM = 20000;
    const yuzdeDegisim = (toplamTutar / HEDEF_HACIM) * ETKI_KATSAYISI;

    if (islem === 'al') {
        if (nakit < toplamTutar) {
            await modalInteraction.reply({ content: `❌ Yetersiz bakiye! ${girilenMiktar} adet ${VARLIKLAR[girilenVarlik].isim} almak için **${toplamTutar.toLocaleString()} 🪙** nakite ihtiyacın var.`, flags: MessageFlags.Ephemeral }).catch(() => {});
            return;
        }
        
        ecoDb.cikar(`cuzdan_${userId}`, toplamTutar);
        
        mevcut.adet += girilenMiktar;
        mevcut.maliyet += toplamTutar; 
        cüzdan[girilenVarlik] = mevcut;
        
        userDb.ayarla(`portfoy_${userId}`, cüzdan);

        let yeniFiyat = fiyat * (1 + yuzdeDegisim);
        piyasa[girilenVarlik].fiyat = parseFloat(yeniFiyat.toFixed(2));
        ecoDb.ayarla('borsa_piyasa', piyasa);

        await modalInteraction.reply({ content: `✅ Başarılı! Toplam **${toplamTutar.toLocaleString()} 🪙** ödeyerek ${girilenMiktar} adet **${VARLIKLAR[girilenVarlik].isim}** aldın!\n📈 *Senin bu büyük alımın piyasayı hareketlendirdi ve fiyatı biraz yükseltti!*`, flags: MessageFlags.Ephemeral }).catch(() => {});
        
        const { guncelle } = require('./borsaDongusu');
        guncelle(modalInteraction.client);
        return;
    } 
    
    if (islem === 'sat') {
        if (mevcut.adet < girilenMiktar) {
            await modalInteraction.reply({ content: `❌ Elinde o kadar yok! Şu an portföyünde sadece **${mevcut.adet}** adet var.`, flags: MessageFlags.Ephemeral }).catch(() => {});
            return;
        }
        
        const ortalamaMaliyet = mevcut.maliyet / mevcut.adet;
        mevcut.adet -= girilenMiktar;
        mevcut.maliyet -= (ortalamaMaliyet * girilenMiktar);
        
        if (mevcut.adet <= 0) {
            delete cüzdan[girilenVarlik];
        } else {
            cüzdan[girilenVarlik] = mevcut;
        }
        
        userDb.ayarla(`portfoy_${userId}`, cüzdan);
        ecoDb.ekle(`cuzdan_${userId}`, toplamTutar);

        let yeniFiyat = fiyat * (1 - yuzdeDegisim);
        if (yeniFiyat < 0.1) yeniFiyat = 0.1;
        piyasa[girilenVarlik].fiyat = parseFloat(yeniFiyat.toFixed(2));
        ecoDb.ayarla('borsa_piyasa', piyasa);

        await modalInteraction.reply({ content: `✅ Başarılı! ${girilenMiktar} adet **${VARLIKLAR[girilenVarlik].isim}** bozdurarak cüzdanına **${toplamTutar.toLocaleString()} 🪙** ekledin!\n📉 *Piyasaya toplu mal sattığın için fiyatlar hafifçe geriledi.*`, flags: MessageFlags.Ephemeral }).catch(() => {});
        
        const { guncelle } = require('./borsaDongusu');
        guncelle(modalInteraction.client);
        return;
    }
};

module.exports = { borsaButtonHandler, borsaModalHandler };
