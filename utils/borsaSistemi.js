const { ecoDb, userDb } = require('./db');

const VARLIKLAR = {
    'usd': { isim: '💵 Dolar', min: 25, max: 40, oynaklik: 0.05 },
    'altin': { isim: '🥇 Altın', min: 2000, max: 3500, oynaklik: 0.10 },
    'btc': { isim: '₿ Bitcoin', min: 40000, max: 90000, oynaklik: 0.20 },
    'vex': { isim: '🚀 Vexora Coin', min: 1, max: 100, oynaklik: 0.50 }
};

const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 Dakika

const piyasayiGuncelle = () => {
    let piyasa = ecoDb.bul('borsa_piyasa');
    
    if (!piyasa) {
        piyasa = {};
        for (const key in VARLIKLAR) {
            piyasa[key] = {
                fiyat: Math.floor((VARLIKLAR[key].min + VARLIKLAR[key].max) / 2),
                eskiFiyat: Math.floor((VARLIKLAR[key].min + VARLIKLAR[key].max) / 2)
            };
        }
    } else {
        for (const key in VARLIKLAR) {
            const v = VARLIKLAR[key];
            const eskiFiyat = piyasa[key].fiyat;
            
            let maxDegisim = eskiFiyat * v.oynaklik;
            
            // %15 İhtimalle Ani Patlama / Çöküş (Pump & Dump)
            if (Math.random() < 0.15) {
                maxDegisim = eskiFiyat * (v.oynaklik * 4); // Normalin 4 katı bir hareket!
            }
            
            if (maxDegisim < 1) maxDegisim = 1; // Çöküşten kurtulma garantisi! (Coin 1'de takılı kalmasın diye)
            
            const degisim = (Math.random() * maxDegisim * 2) - maxDegisim;
            
            // Math.floor aşağı yuvarladığı için zamanla fiyatlar sürekli düşme eğilimine giriyordu.
            // Math.round kullanarak bunu tam dengeli (%50 ihtimal) hale getirdik.
            let yeniFiyat = Math.round(eskiFiyat + degisim);
            
            if (yeniFiyat < v.min) yeniFiyat = v.min;
            if (yeniFiyat > v.max) yeniFiyat = v.max;

            piyasa[key].eskiFiyat = eskiFiyat;
            piyasa[key].fiyat = yeniFiyat;
        }
    }
    
    ecoDb.ayarla('borsa_piyasa', piyasa);
    ecoDb.ayarla('borsa_son_guncelleme', Date.now());
    return piyasa;
};

const piyasayiGetir = () => {
    let piyasa = ecoDb.bul('borsa_piyasa');
    let sonGuncelleme = ecoDb.bul('borsa_son_guncelleme') || 0;

    if (!piyasa || Date.now() - sonGuncelleme >= UPDATE_INTERVAL) {
        piyasa = piyasayiGuncelle();
        sonGuncelleme = Date.now();
    }
    
    const kalanZaman = UPDATE_INTERVAL - (Date.now() - sonGuncelleme);
    return { piyasa, kalanZaman };
};

module.exports = {
    VARLIKLAR,
    UPDATE_INTERVAL,
    piyasayiGuncelle,
    piyasayiGetir
};
