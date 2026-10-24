const { userDb } = require('./db');

/**
 * Kullanıcının aktif tılsımlarını getirir ve süresi bitenleri otomatik temizler.
 * @param {string} userId 
 * @returns {Array<object>}
 */
function getAktifTilsimlar(userId) {
    const tilsimlar = userDb.bul(`tilsimlar_${userId}`) || [];
    const suan = Date.now();
    const guncel = tilsimlar.filter(t => t.bitis > suan);

    if (guncel.length !== tilsimlar.length) {
        userDb.ayarla(`tilsimlar_${userId}`, guncel);
    }

    return guncel;
}

/**
 * Belirli bir türdeki aktif tılsımı kontrol eder ('sans', 'koruma', 'gelir', 'yansima')
 * @param {string} userId 
 * @param {string} tur 
 * @returns {object|null}
 */
function checkTilsim(userId, tur) {
    const aktifler = getAktifTilsimlar(userId);
    return aktifler.find(t => t.tur === tur) || null;
}

/**
 * Kullanıcıya yeni bir tılsım ekler (aynı tür varsa süresini uzatır veya yeniler)
 * @param {string} userId 
 * @param {object} tilsimVerisi 
 */
function ekleTilsim(userId, tilsimVerisi) {
    let aktifler = getAktifTilsimlar(userId);
    const suan = Date.now();
    const eklenecekSureMs = tilsimVerisi.sureSaat * 60 * 60 * 1000;

    const varOlanIndex = aktifler.findIndex(t => t.id === tilsimVerisi.id);

    if (varOlanIndex !== -1) {
        // Varsa süresinin üstüne ekle
        aktifler[varOlanIndex].bitis = Math.max(suan, aktifler[varOlanIndex].bitis) + eklenecekSureMs;
    } else {
        aktifler.push({
            id: tilsimVerisi.id,
            isim: tilsimVerisi.isim,
            tur: tilsimVerisi.tur,
            emoji: tilsimVerisi.emoji,
            puan: tilsimVerisi.puan || 0,
            bonusYuzde: tilsimVerisi.bonusYuzde || 0,
            baslangic: suan,
            bitis: suan + eklenecekSureMs
        });
    }

    userDb.ayarla(`tilsimlar_${userId}`, aktifler);
}

module.exports = {
    getAktifTilsimlar,
    checkTilsim,
    ekleTilsim
};
