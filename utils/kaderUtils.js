const { ecoDb } = require('./db');
const { checkTilsim } = require('./tilsimUtils');

// Maksimum ve minimum sınır değerleri
const MAX_KADER_PUANI = 10;   // En fazla +10 Dua
const MIN_KADER_PUANI = -10;  // En fazla -10 Lanet

// Her 1 puanın başarı şansına etkisi: %2 (0.02)
const PUAN_BASINA_SANS = 0.02;

/**
 * Kullanıcının kümülatif kader puanını getirir (aktif yonca tılsımı varsa geçici puanı da ekler).
 * @param {string} userId 
 * @returns {number} Negatif ise lanetli, pozitif ise dualı, 0 ise nötr
 */
function getKaderPuani(userId) {
    let puan = ecoDb.bul(`kader_puani_${userId}`);
    if (typeof puan !== 'number') puan = 0;

    // Aktif Yonca Tılsımı kontrolü (+3 puan)
    const yonca = checkTilsim(userId, 'sans');
    if (yonca && yonca.puan) {
        puan += yonca.puan;
    }

    return puan;
}

/**
 * Kullanıcıya kader puanı ekler veya çıkarır.
 * @param {string} userId 
 * @param {number} delta (+1 veya -1 vb.)
 * @returns {number} Yeni puan
 */
function degistirKaderPuani(userId, delta) {
    let mevcut = getKaderPuani(userId);
    let yeniPuan = mevcut + delta;
    if (yeniPuan > MAX_KADER_PUANI) yeniPuan = MAX_KADER_PUANI;
    if (yeniPuan < MIN_KADER_PUANI) yeniPuan = MIN_KADER_PUANI;
    ecoDb.ayarla(`kader_puani_${userId}`, yeniPuan);
    return yeniPuan;
}

/**
 * Kader puanının şansa net katkısını döner (+0.04, -0.06 vb.)
 * @param {string} userId 
 * @returns {number}
 */
function getKaderSansEtkisi(userId) {
    const puan = getKaderPuani(userId);
    return puan * PUAN_BASINA_SANS;
}

/**
 * Verilen temel başarı olasılığına kullanıcının kader puanını uygular.
 * @param {string} userId 
 * @param {number} baseProb 
 * @returns {{ basarili: boolean, kaderPuani: number, etkiOrani: number, yeniProb: number }}
 */
function sansZariAt(userId, baseProb = 0.50) {
    const puan = getKaderPuani(userId);
    const etki = puan * PUAN_BASINA_SANS;
    // Olasılık asla 0.05'in altına inmesin, 0.95'in üstüne çıkmasın
    const modifeProb = Math.min(0.95, Math.max(0.05, baseProb + etki));

    const roll = Math.random();
    return {
        basarili: roll < modifeProb,
        kaderPuani: puan,
        etkiOrani: etki,
        yeniProb: modifeProb
    };
}

module.exports = {
    MAX_KADER_PUANI,
    MIN_KADER_PUANI,
    PUAN_BASINA_SANS,
    getKaderPuani,
    degistirKaderPuani,
    getKaderSansEtkisi,
    sansZariAt
};
