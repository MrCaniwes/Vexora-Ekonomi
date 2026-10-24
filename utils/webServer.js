const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
const { ecoDb, userDb } = require('../utils/db');
const { getKaderPuani, PUAN_BASINA_SANS } = require('../utils/kaderUtils');
const { getAktifTilsimlar } = require('../utils/tilsimUtils');
const { VARLIKLAR, piyasayiGetir } = require('../utils/borsaSistemi');
const { ekleTilsim } = require('../utils/tilsimUtils');
const { canliDurumBildir, canliDurumIflasBildir } = require('../utils/canliDurum');
const fs = require('fs');

// Aktif Crash Oyunları Hafızası (In-Memory)
const activeCrashGames = new Map();
// Aktif Kule (Towers) Oyunları Hafızası (In-Memory)
const activeTowerGames = new Map();
// Aktif Karşıdan Karşıya (Crossy Road) Oyunları Hafızası
const activeRoadGames = new Map();
// Gerçek Crash Geçmişi (Veritabanında kalıcı tutulur, son 15 oyun)
let crashHistory = ecoDb.bul('web_crash_history') || [2.45, 1.34, 1.82, 3.12, 1.15, 5.40, 1.92, 1.05];

/**
 * Matematiksel Dengeli Casino Crash Algoritması
 * Kasa Avantajı (House Edge): %4.0
 * 2x'e ulaşma oranı ~%48 civarına çekilerek "2x'te çekip kaçma" taktiği dengelenmiştir.
 */
function generateCrashMultiplier() {
    const rand = Math.random();

    // %3.5 olasılıkla anlık kalkışta patlama (1.00x)
    if (rand < 0.035) {
        return 1.00;
    }

    // Dengeli Dağılım:
    // %24 -> 1.05 - 1.55 (Erken patlama - açgözlüleri avlar)
    // %28 -> 1.55 - 1.98 (Tam 2x'in kapısında patlatıp terleten aralık!)
    // %28 -> 2.05 - 4.50 (Orta seviye kazançlar)
    // %15 -> 4.50 - 12.00 (Yüksek kazançlar)
    // %5  -> 12.00 - 150.00 (Devasa uçuşlar)
    let finalMult = 1.10;
    const subRand = Math.random();

    if (rand < 0.275) { // %24
        finalMult = 1.05 + (subRand * 0.50);
    } else if (rand < 0.555) { // %28 (1.55 - 1.98 arası)
        finalMult = 1.55 + (subRand * 0.43);
    } else if (rand < 0.835) { // %28
        finalMult = 2.05 + (subRand * 2.45);
    } else if (rand < 0.985) { // %15
        finalMult = 4.50 + (subRand * 7.50);
    } else { // %1.5
        finalMult = 12.00 + (subRand * 120.00);
    }

    return parseFloat(finalMult.toFixed(2));
}

function startWebServer(client) {
    const app = express();
    const PORT = process.env.PORT || 3162;
    const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;
    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const REDIRECT_URI = `${DOMAIN}/auth/discord/callback`;

    app.use(cookieParser('vexora_secret_session_key'));
    app.use(express.json());

    // Statik web klasörünü dışa aç
    app.use(express.static(path.join(__dirname, '..', 'web')));

    // Helper: Oturumdaki kullanıcıyı doğrula
    const getAuthUser = (req) => {
        const cookie = req.cookies.vex_user;
        if (!cookie) return null;
        try {
            return typeof cookie === 'string' ? JSON.parse(cookie) : cookie;
        } catch {
            return null;
        }
    };

    // --- 1. OAUTH2 DİSCORD GİRİŞ YÖNLENDİRMESİ ---
    app.get('/auth/login', (req, res) => {
        const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
        res.redirect(url);
    });

    // --- 2. OAUTH2 CALLBACK ---
    app.get('/auth/discord/callback', async (req, res) => {
        const { code } = req.query;
        if (!code) return res.redirect('/?error=no_code');

        try {
            const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                scope: 'identify',
            }).toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token } = tokenResponse.data;

            const userResponse = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            const user = userResponse.data;
            const isAnimated = user.avatar && user.avatar.startsWith('a_');
            const avatarExt = isAnimated ? 'gif' : 'webp';
            const avatarUrl = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${avatarExt}?size=128` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            res.cookie('vex_user', JSON.stringify({
                id: user.id,
                username: user.username,
                global_name: user.global_name || user.username,
                avatar: avatarUrl
            }), { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false });

            res.redirect('/');
        } catch (err) {
            console.error('Discord Auth Hatası:', err.response?.data || err.message);
            res.redirect('/?error=auth_failed');
        }
    });

    // --- 3. ÇIKIŞ YAP ---
    app.get('/auth/logout', (req, res) => {
        res.clearCookie('vex_user');
        res.redirect('/');
    });

    // --- 4. GÜNCEL KULLANICI PROFİLİ VE BAKİYESİ ---
    app.get('/api/me', async (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ loggedIn: false });

        const userId = sessionUser.id;
        let avatarUrl = sessionUser.avatar;

        if (client && client.users) {
            try {
                const discordUser = client.users.cache.get(userId) || await client.users.fetch(userId);
                if (discordUser) {
                    avatarUrl = discordUser.displayAvatarURL({ dynamic: true, size: 128 });
                }
            } catch {}
        }

        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        const envanter = userDb.bul(`envanter_${userId}`) || [];
        const portfoy = userDb.bul(`portfoy_${userId}`) || {};
        const piyasa = ecoDb.bul('borsa_piyasa') || {};

        const meslek = envanter.find(e => e.kategori === 'meslekler');
        let mevcutXp = userDb.bul(`xp_${userId}`) || 0;
        let mevcutLevel = Math.floor(Math.sqrt(mevcutXp / 350)) + 1;
        if (mevcutLevel > 5) mevcutLevel = 5;

        let borsaDegeri = 0;
        for (const key in portfoy) {
            let veri = portfoy[key];
            if (!veri) continue;
            let adet = typeof veri === 'number' ? veri : veri.adet;
            if (adet > 0 && piyasa[key]) {
                borsaDegeri += adet * piyasa[key].fiyat;
            }
        }

        const evlilikVerisi = userDb.bul(`evlilik_${userId}`);
        let medeniDurum = 'Bekar 💔';
        if (evlilikVerisi) {
            medeniDurum = `${evlilikVerisi.partnerIsim || 'Eşi'} ile Evli (${evlilikVerisi.yuzuk.emoji} ${evlilikVerisi.yuzuk.isim})`;
        }

        const kaderPuani = getKaderPuani(userId);
        let kaderMetni = '⚖️ Nötr (0 Puan)';
        if (kaderPuani > 0) {
            kaderMetni = `✨ Kutsanmış (+${kaderPuani} Dua) | Şans: +%${(kaderPuani * PUAN_BASINA_SANS * 100).toFixed(0)}`;
        } else if (kaderPuani < 0) {
            kaderMetni = `💀 Lanetli (${kaderPuani} Lanet) | Şans: %${(kaderPuani * PUAN_BASINA_SANS * 100).toFixed(0)}`;
        }

        const aktifTilsimlar = getAktifTilsimlar(userId);

        res.json({
            loggedIn: true,
            user: {
                id: userId,
                name: sessionUser.global_name || sessionUser.username,
                avatar: avatarUrl,
                bakiye,
                borsaDegeri: Math.floor(borsaDegeri),
                toplamServet: Math.floor(bakiye + borsaDegeri),
                meslek: meslek ? { isim: meslek.isim, bonus: meslek.bonusYuzdesi } : null,
                seviye: mevcutLevel,
                xp: mevcutXp,
                medeniDurum,
                kaderMetni,
                tilsimlar: aktifTilsimlar,
                yatirimlar: envanter.filter(e => e.kategori === 'yatirimlar'),
                yuzukler: envanter.filter(e => e.kategori === 'yuzukler')
            }
        });
    });

    // ==========================================
    // 🟢 PLINKO OYUNU API ENDPOINTLERİ
    // ==========================================
    // 12 Satırlık Standart Piramit Çarpan Tabloları
    const PLINKO_MULTIPLIERS = {
        low:    [10, 3, 1.6, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.6, 3, 10],
        medium: [25, 8, 3.2, 1.6, 1.1, 0.6, 0.4, 0.6, 1.1, 1.6, 3.2, 8, 25],
        high:   [110, 42, 10, 4, 1.4, 0.2, 0.2, 0.2, 1.4, 4, 10, 42, 110]
    };

    app.post('/api/plinko/drop', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Lütfen önce Discord ile giriş yapın!' });

        const userId = sessionUser.id;
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        const bahis = parseInt(req.body.bet) || 100;
        const risk = ['low', 'medium', 'high'].includes(req.body.risk) ? req.body.risk : 'medium';

        if (bahis < 10) {
            return res.status(400).json({ error: 'Minimum bahis 10 🪙 olmalıdır!' });
        }
        if (bakiye < bahis) {
            return res.status(400).json({ error: `Yetersiz bakiye! Cüzdanınızda ${bakiye.toLocaleString()} 🪙 var.` });
        }

        // Bahsi düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        // 12 satırlık Plinko bilye yolu simülasyonu (0: Sol, 1: Sağ)
        // Tamamen eşit ve tarafsız olasılık (%50 sol, %50 sağ)
        const rows = 12;
        const path = [];
        let rightTurns = 0;

        for (let i = 0; i < rows; i++) {
            const turn = Math.random() < 0.5 ? 0 : 1;
            path.push(turn);
            if (turn === 1) rightTurns++;
        }

        const bucketIndex = rightTurns; // 0 ile 12 arasında
        const multiplierList = PLINKO_MULTIPLIERS[risk];
        const multiplier = multiplierList[bucketIndex] || 1;

        const kazanc = Math.floor(bahis * multiplier);
        if (kazanc > 0) {
            ecoDb.ekle(`cuzdan_${userId}`, kazanc);
            canliDurumBildir({ userId, oyunAdi: 'Plinko', bahis, kazanc, carpan: multiplier, kaynak: 'web' });
        }

        // 1. PLINKO
        const plinkoBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (plinkoBakiye === 0 && kazanc === 0) {
            canliDurumIflasBildir({ userId, oyunAdi: 'Plinko', kaybedilenBahis: bahis, kaynak: 'web' });
        }

        res.json({
            success: true,
            path,
            bucketIndex,
            multiplier,
            kazanc,
            bahis,
            risk,
            yeniBakiye: plinkoBakiye
        });
    });

    // ==========================================
    // 🎡 AVRUPA RULETİ (EUROPEAN ROULETTE 0 - 36)
    // ==========================================
    // Gerçek Avrupa Ruleti Çark Sıralaması (37 Sayı):
    const ROULETTE_WHEEL_NUMBERS = [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
        5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];

    const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const rouletteHistory = [
        { num: 14, color: 'red' },
        { num: 0, color: 'green' },
        { num: 28, color: 'black' },
        { num: 7, color: 'red' },
        { num: 33, color: 'black' },
        { num: 19, color: 'red' }
    ];

    app.get('/api/roulette/history', (req, res) => {
        res.json({ history: rouletteHistory });
    });

    app.post('/api/roulette/spin', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Lütfen önce Discord ile giriş yapın!' });

        const userId = sessionUser.id;
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;

        // Gelen bahisler: { red: 50, black: 0, odd: 100, even: 0, low: 0, high: 0, doz1: 0, doz2: 0, doz3: 0, numbers: { '0': 20, '17': 50 } }
        const bets = req.body.bets || {};
        let totalBet = 0;

        // Dış bahisler
        ['red', 'black', 'odd', 'even', 'low', 'high', 'doz1', 'doz2', 'doz3'].forEach(k => {
            const val = parseInt(bets[k]) || 0;
            if (val > 0) totalBet += val;
        });

        // Sayı bahisleri (0 - 36)
        if (bets.numbers && typeof bets.numbers === 'object') {
            for (const n in bets.numbers) {
                const val = parseInt(bets.numbers[n]) || 0;
                if (val > 0) totalBet += val;
            }
        }

        if (totalBet < 10) {
            return res.status(400).json({ error: 'Toplam bahis en az 10 🪙 olmalıdır!' });
        }
        if (bakiye < totalBet) {
            return res.status(400).json({ error: `Yetersiz bakiye! Cüzdanınızda ${bakiye.toLocaleString()} 🪙 var.` });
        }

        // Bahsi hesaptan düş
        ecoDb.cikar(`cuzdan_${userId}`, totalBet);

        // 37 sayıdan birini %100 saf rastgelelikle seç
        const wheelIndex = Math.floor(Math.random() * ROULETTE_WHEEL_NUMBERS.length);
        const winningNumber = ROULETTE_WHEEL_NUMBERS[wheelIndex];

        let winningColor = 'green';
        if (winningNumber !== 0) {
            winningColor = ROULETTE_RED_NUMBERS.has(winningNumber) ? 'red' : 'black';
        }

        // Kazanç Hesaplama (Klasik Casino Ödemeleri)
        let totalWin = 0;

        if (winningNumber !== 0) {
            // Kırmızı / Siyah (1:1 -> 2x)
            if (winningColor === 'red' && bets.red) totalWin += (parseInt(bets.red) || 0) * 2;
            if (winningColor === 'black' && bets.black) totalWin += (parseInt(bets.black) || 0) * 2;

            // Tek / Çift (1:1 -> 2x)
            if (winningNumber % 2 === 1 && bets.odd) totalWin += (parseInt(bets.odd) || 0) * 2;
            if (winningNumber % 2 === 0 && bets.even) totalWin += (parseInt(bets.even) || 0) * 2;

            // 1-18 (Low) / 19-36 (High) (1:1 -> 2x)
            if (winningNumber >= 1 && winningNumber <= 18 && bets.low) totalWin += (parseInt(bets.low) || 0) * 2;
            if (winningNumber >= 19 && winningNumber <= 36 && bets.high) totalWin += (parseInt(bets.high) || 0) * 2;

            // Düzineler (2:1 -> 3x)
            if (winningNumber >= 1 && winningNumber <= 12 && bets.doz1) totalWin += (parseInt(bets.doz1) || 0) * 3;
            if (winningNumber >= 13 && winningNumber <= 24 && bets.doz2) totalWin += (parseInt(bets.doz2) || 0) * 3;
            if (winningNumber >= 25 && winningNumber <= 36 && bets.doz3) totalWin += (parseInt(bets.doz3) || 0) * 3;
        }

        // Sayı Bahsi (Direkt Sayı İsabeti: 35:1 -> 36x)
        if (bets.numbers && bets.numbers[winningNumber]) {
            const numBet = parseInt(bets.numbers[winningNumber]) || 0;
            totalWin += numBet * 36;
        }

        if (totalWin > 0) {
            ecoDb.ekle(`cuzdan_${userId}`, totalWin);
            canliDurumBildir({ userId, oyunAdi: 'Avrupa Ruleti', bahis: totalBet, kazanc: totalWin, carpan: totalBet > 0 ? (totalWin / totalBet) : 1, kaynak: 'web' });
        }

        // Geçmişe ekle
        rouletteHistory.unshift({ num: winningNumber, color: winningColor });
        if (rouletteHistory.length > 15) rouletteHistory.pop();

        // 🎡 Rulet
        const rouletteBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (rouletteBakiye === 0 && totalWin === 0) {
            canliDurumIflasBildir({ userId, oyunAdi: 'Avrupa Ruleti', kaybedilenBahis: totalBet, kaynak: 'web' });
        }

        res.json({
            success: true,
            wheelIndex,
            winningNumber,
            winningColor,
            totalBet,
            totalWin,
            yeniBakiye: rouletteBakiye,
            slotAngle: 360 / ROULETTE_WHEEL_NUMBERS.length
        });
    });

    // ==========================================
    // 🎡 KLASİK ÇARK (WHEEL: KIRMIZI 2X / SİYAH 2X / YEŞİL 20X)
    // ==========================================
    const WHEEL_SEGMENTS = [
        'green',
        'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
        'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
        'black', 'red', 'black', 'red', 'black', 'red',
        'green',
        'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
        'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
        'black', 'red', 'black', 'red', 'black', 'red'
    ];

    const wheelHistory = ['red', 'black', 'black', 'red', 'green', 'red', 'black', 'red'];

    app.get('/api/wheel/history', (req, res) => {
        res.json({ history: wheelHistory });
    });

    app.post('/api/wheel/spin', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Lütfen önce Discord ile giriş yapın!' });

        const userId = sessionUser.id;
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;

        const bets = req.body.bets || {};
        const redBet = parseInt(bets.red) || 0;
        const blackBet = parseInt(bets.black) || 0;
        const greenBet = parseInt(bets.green) || 0;
        const totalBet = redBet + blackBet + greenBet;

        if (totalBet < 10) {
            return res.status(400).json({ error: 'Toplam bahis en az 10 🪙 olmalıdır!' });
        }
        if (bakiye < totalBet) {
            return res.status(400).json({ error: `Yetersiz bakiye! Cüzdanınızda ${bakiye.toLocaleString()} 🪙 var.` });
        }

        ecoDb.cikar(`cuzdan_${userId}`, totalBet);

        const winningIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
        const winningColor = WHEEL_SEGMENTS[winningIndex];

        let totalWin = 0;
        if (winningColor === 'red') totalWin += redBet * 2;
        else if (winningColor === 'black') totalWin += blackBet * 2;
        else if (winningColor === 'green') totalWin += greenBet * 20;

        if (totalWin > 0) {
            ecoDb.ekle(`cuzdan_${userId}`, totalWin);
            canliDurumBildir({ userId, oyunAdi: 'Klasik Çark', bahis: totalBet, kazanc: totalWin, carpan: totalBet > 0 ? (totalWin / totalBet) : 1, kaynak: 'web' });
        }

        wheelHistory.unshift(winningColor);
        if (wheelHistory.length > 15) wheelHistory.pop();

        // 🎡 Klasik Çark
        const wheelBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (wheelBakiye === 0 && totalWin === 0) {
            canliDurumIflasBildir({ userId, oyunAdi: 'Klasik Çark', kaybedilenBahis: totalBet, kaynak: 'web' });
        }

        res.json({
            success: true,
            winningIndex,
            winningColor,
            totalBet,
            totalWin,
            yeniBakiye: wheelBakiye,
            segmentAngle: 360 / WHEEL_SEGMENTS.length
        });
    });

    // Crash Bahis Başlat
    app.post('/api/crash/start', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Lütfen önce Discord ile giriş yapın!' });

        const userId = sessionUser.id;
        const bahis = parseInt(req.body.bahis);

        if (!bahis || isNaN(bahis) || bahis <= 0) {
            return res.status(400).json({ error: 'Geçersiz bahis miktarı!' });
        }

        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (bakiye < bahis) {
            return res.status(400).json({ error: 'Yetersiz bakiye!' });
        }

        // Eğer eski bir oyun takılı kaldıysa (örneğin sekme yenilendi veya patlama kontrolü kaçtıysa), eskiyi temizle
        if (activeCrashGames.has(userId)) {
            const oldGame = activeCrashGames.get(userId);
            const now = Date.now();
            const elapsed = (now - oldGame.startTime) / 1000;
            // 2 dakikadan uzun sürmüşse kesinlikle takılmıştır, sıfırla
            if (elapsed > 120 || oldGame.cashedOut) {
                activeCrashGames.delete(userId);
            } else {
                // Halen patlama süresi içindeyse bile yeni oyuna izin vermek için eskisini sonlandırıp devam et
                activeCrashGames.delete(userId);
            }
        }

        // Bahsi cüzdandan düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        // Patlama çarpanını belirle
        const crashPoint = generateCrashMultiplier(userId);
        const startTime = Date.now();
        const gameId = crypto.randomUUID();

        activeCrashGames.set(userId, {
            gameId,
            bahis,
            crashPoint,
            startTime,
            cashedOut: false
        });

        // Geçmişe ekle (En fazla 15 kayıt tut ve DB'ye yaz)
        crashHistory.unshift(crashPoint);
        if (crashHistory.length > 15) crashHistory.pop();
        ecoDb.ayarla('web_crash_history', crashHistory);

        res.json({
            success: true,
            gameId,
            bahis,
            crashPoint, // İstemciye patlama noktasını veriyoruz (Animasyonu senkron uçurması için)
            startTime,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // Crash Nakit Çek (Cashout)
    app.post('/api/crash/cashout', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı!' });

        const userId = sessionUser.id;
        const game = activeCrashGames.get(userId);

        if (!game || game.cashedOut) {
            return res.status(400).json({ error: 'Aktif bir oyun bulunamadı!' });
        }

        const now = Date.now();
        const elapsedSec = (now - game.startTime) / 1000;
        
        // Tarayıcıdaki formül ile birebir aynı: 1 + 0.12 * Math.pow(t, 1.2)
        const currentMultiplier = Math.max(1.00, parseFloat((1 + 0.12 * Math.pow(elapsedSec, 1.2)).toFixed(2)));

        // Eğer roket çoktan patladıysa
        if (currentMultiplier >= game.crashPoint) {
            activeCrashGames.delete(userId);
            const crashRemBal = ecoDb.bul(`cuzdan_${userId}`) || 0;
            if (crashRemBal === 0) {
                canliDurumIflasBildir({ userId, oyunAdi: 'Crash Arena', kaybedilenBahis: game.bahis, kaynak: 'web' });
            }
            return res.json({
                success: false,
                crashed: true,
                crashPoint: game.crashPoint,
                message: `💥 Roket ${game.crashPoint}x çarpanında infilak etti! Bahsi kaybettiniz.`
            });
        }

        // Başarılı Nakit Çekim
        game.cashedOut = true;
        const kazanc = Math.floor(game.bahis * currentMultiplier);
        ecoDb.ekle(`cuzdan_${userId}`, kazanc);
        canliDurumBildir({ userId, oyunAdi: 'Crash Arena', bahis: game.bahis, kazanc, carpan: currentMultiplier, kaynak: 'web' });

        activeCrashGames.delete(userId);

        res.json({
            success: true,
            crashed: false,
            multiplier: currentMultiplier,
            kazanc,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // Crash Patlama Kontrolü (Oyun Bittiğinde Tarayıcı Çağırır)
    app.post('/api/crash/check', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum yok' });

        const userId = sessionUser.id;
        const game = activeCrashGames.get(userId);

        if (!game) {
            return res.json({ active: false });
        }

        // Oyunun patlama noktasını gönder
        const crashPoint = game.crashPoint;
        activeCrashGames.delete(userId);

        res.json({
            active: true,
            crashed: true,
            crashPoint
        });
    });

    // Crash Geçmişini Getir (API)
    app.get('/api/crash/history', (req, res) => {
        res.json({ history: crashHistory });
    });

    // ==========================================
    // 🗼 KULE TIRMANIŞI (TOWERS CASINO) OYUNU
    // ==========================================
    // Kat başına çarpanlar (8 Kat)
    const TOWER_CONFIGS = {
        easy: {
            tilesPerRow: 4,
            minesPerRow: 1, // 3 güvenli, 1 bomba (%75 başarı ihtimali)
            multipliers: [1.28, 1.65, 2.15, 2.85, 3.80, 5.10, 6.90, 9.40]
        },
        medium: {
            tilesPerRow: 3,
            minesPerRow: 1, // 2 güvenli, 1 bomba (%66.6 başarı ihtimali)
            multipliers: [1.44, 2.12, 3.15, 4.70, 7.10, 10.80, 16.50, 25.50]
        },
        hard: {
            tilesPerRow: 2,
            minesPerRow: 1, // 1 güvenli, 1 bomba (%50 başarı ihtimali)
            multipliers: [1.92, 3.75, 7.30, 14.30, 28.00, 55.00, 108.00, 215.00]
        }
    };

    // 1. Kule Oyunu Başlat
    app.post('/api/towers/start', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı! Lütfen Discord ile giriş yapın.' });

        const userId = sessionUser.id;
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        const bahis = parseInt(req.body.bet, 10);
        const difficulty = req.body.difficulty || 'medium';

        if (isNaN(bahis) || bahis < 10) {
            return res.status(400).json({ error: 'Geçersiz bahis miktarı! (Minimum 10 🪙)' });
        }

        if (bahis > bakiye) {
            return res.status(400).json({ error: 'Yetersiz bakiye!' });
        }

        const config = TOWER_CONFIGS[difficulty];
        if (!config) {
            return res.status(400).json({ error: 'Geçersiz zorluk derecesi!' });
        }

        // Eğer bitmemiş aktif bir oyun varsa önce onu sonlandır
        if (activeTowerGames.has(userId)) {
            activeTowerGames.delete(userId);
        }

        // Bakiyeden düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        // 8 kat için mayın konumlarını önceden rastgele üret (0 ile tilesPerRow-1 arası)
        const floorsMines = [];
        for (let i = 0; i < 8; i++) {
            const mineIndex = Math.floor(Math.random() * config.tilesPerRow);
            floorsMines.push(mineIndex);
        }

        const gameSession = {
            userId,
            bet: bahis,
            difficulty,
            currentFloor: 0, // 0 = henüz zemin katta (hiç seçim yapılmadı)
            floorsMines, // Gizli mayın indeksleri
            multipliers: config.multipliers,
            tilesPerRow: config.tilesPerRow,
            active: true
        };

        activeTowerGames.set(userId, gameSession);

        res.json({
            success: true,
            bet: bahis,
            difficulty,
            tilesPerRow: config.tilesPerRow,
            multipliers: config.multipliers,
            currentFloor: 0,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // 2. Kule Basamağı Seç (Tırman)
    app.post('/api/towers/climb', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı!' });

        const userId = sessionUser.id;
        const game = activeTowerGames.get(userId);

        if (!game || !game.active) {
            return res.status(400).json({ error: 'Aktif bir kule oyunu bulunamadı!' });
        }

        const tileIndex = parseInt(req.body.tileIndex, 10);
        if (isNaN(tileIndex) || tileIndex < 0 || tileIndex >= game.tilesPerRow) {
            return res.status(400).json({ error: 'Geçersiz kutu seçimi!' });
        }

        const targetFloor = game.currentFloor; // 0'dan 7'ye kadar katlar
        const mineInFloor = game.floorsMines[targetFloor];

        // MAYIN PATLADI MI?
        if (tileIndex === mineInFloor) {
            // Patladı! Oyun bitti, para gitti.
            game.active = false;
            activeTowerGames.delete(userId);

            const towerRemBal = ecoDb.bul(`cuzdan_${userId}`) || 0;
            if (towerRemBal === 0) {
                canliDurumIflasBildir({ userId, oyunAdi: 'Kule Tırmanışı', kaybedilenBahis: game.bet, kaynak: 'web' });
            }

            return res.json({
                success: true,
                hitMine: true,
                revealedMines: game.floorsMines,
                failedFloor: targetFloor,
                yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
            });
        }

        // GÜVENLİ KUTU!
        game.currentFloor++;
        const nextFloor = game.currentFloor;
        const currentMultiplier = game.multipliers[targetFloor];
        const isPeak = nextFloor >= 8; // En tepe kata ulaşıldı mı?

        if (isPeak) {
            // 8. kata (Zirveye) ulaştı! Otomatik Cashout
            game.active = false;
            activeTowerGames.delete(userId);

            const kazanc = Math.floor(game.bet * currentMultiplier);
            ecoDb.ekle(`cuzdan_${userId}`, kazanc);
            canliDurumBildir({ userId, oyunAdi: 'Kule Tırmanışı', bahis: game.bet, kazanc, carpan: currentMultiplier, kaynak: 'web' });

            return res.json({
                success: true,
                hitMine: false,
                currentFloor: nextFloor,
                multiplier: currentMultiplier,
                isPeak: true,
                kazanc,
                revealedMines: game.floorsMines,
                yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
            });
        }

        res.json({
            success: true,
            hitMine: false,
            currentFloor: nextFloor,
            multiplier: currentMultiplier,
            isPeak: false,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // 3. Kule Nakit Çek (Cashout)
    app.post('/api/towers/cashout', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı!' });

        const userId = sessionUser.id;
        const game = activeTowerGames.get(userId);

        if (!game || !game.active || game.currentFloor === 0) {
            return res.status(400).json({ error: 'Çekilebilecek aktif bir kazanç yok!' });
        }

        const wonMultiplier = game.multipliers[game.currentFloor - 1];
        const kazanc = Math.floor(game.bet * wonMultiplier);
        ecoDb.ekle(`cuzdan_${userId}`, kazanc);
        canliDurumBildir({ userId, oyunAdi: 'Kule Tırmanışı', bahis: game.bet, kazanc, carpan: wonMultiplier, kaynak: 'web' });

        const allMines = [...game.floorsMines];
        game.active = false;
        activeTowerGames.delete(userId);

        res.json({
            success: true,
            kazanc,
            multiplier: wonMultiplier,
            revealedMines: allMines,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // ==========================================
    // 🎱 KENO (ALTIN PİYANGO) OYUNU
    // ==========================================
    // 1-40 arası sayılar, oyuncu 1 ila 10 sayı seçer, kasa 10 rastgele altın top çeker
    const KENO_PAYOUT_TABLE = {
        1: { 0: 0, 1: 3.8 },
        2: { 0: 0, 1: 1.7, 2: 5.2 },
        3: { 0: 0, 1: 1.0, 2: 2.7, 3: 25.0 },
        4: { 0: 0, 1: 0, 2: 1.6, 3: 4.5, 4: 75.0 },
        5: { 0: 0, 1: 0, 2: 1.2, 3: 3.5, 4: 15.0, 5: 300.0 },
        6: { 0: 0, 1: 0, 2: 1.0, 3: 2.2, 4: 7.0, 5: 60.0, 6: 600.0 },
        7: { 0: 0, 1: 0, 2: 0, 3: 1.8, 4: 4.5, 5: 18.0, 6: 120.0, 7: 850.0 },
        8: { 0: 0, 1: 0, 2: 0, 3: 1.5, 4: 3.0, 5: 10.0, 6: 45.0, 7: 250.0, 8: 1000.0 },
        9: { 0: 0, 1: 0, 2: 0, 3: 1.2, 4: 2.2, 5: 6.0, 6: 22.0, 7: 100.0, 8: 450.0, 9: 1000.0 },
        10: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1.8, 5: 4.5, 6: 15.0, 7: 60.0, 8: 200.0, 9: 600.0, 10: 1000.0 }
    };

    app.post('/api/keno/play', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı! Lütfen Discord ile giriş yapın.' });

        const userId = sessionUser.id;
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        const bahis = parseInt(req.body.bet, 10);
        let selectedNumbers = req.body.numbers;

        if (isNaN(bahis) || bahis < 10) {
            return res.status(400).json({ error: 'Geçersiz bahis miktarı! (Minimum 10 🪙)' });
        }

        if (bahis > bakiye) {
            return res.status(400).json({ error: 'Yetersiz bakiye!' });
        }

        if (!Array.isArray(selectedNumbers) || selectedNumbers.length < 1 || selectedNumbers.length > 10) {
            return res.status(400).json({ error: 'Lütfen 1 ile 10 arasında sayı seçin!' });
        }

        // Sayıların 1-40 arasında ve benzersiz olduğunu doğrula
        selectedNumbers = [...new Set(selectedNumbers.map(n => parseInt(n, 10)))].filter(n => !isNaN(n) && n >= 1 && n <= 40);
        if (selectedNumbers.length < 1 || selectedNumbers.length > 10) {
            return res.status(400).json({ error: 'Geçersiz sayılar seçildi!' });
        }

        // Bakiyeden düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        // Kasa 1-40 arasından 10 benzersiz altın top çeker
        const pool = Array.from({ length: 40 }, (_, i) => i + 1);
        const drawnNumbers = [];
        for (let i = 0; i < 10; i++) {
            const randIdx = Math.floor(Math.random() * pool.length);
            drawnNumbers.push(pool.splice(randIdx, 1)[0]);
        }

        // İsabet eden sayıları hesapla
        const hits = selectedNumbers.filter(n => drawnNumbers.includes(n));
        const hitCount = hits.length;
        const selectCount = selectedNumbers.length;

        const table = KENO_PAYOUT_TABLE[selectCount] || {};
        const multiplier = table[hitCount] || 0;
        const kazanc = Math.floor(bahis * multiplier);

        if (kazanc > 0) {
            ecoDb.ekle(`cuzdan_${userId}`, kazanc);
            canliDurumBildir({ userId, oyunAdi: 'Altın Keno', bahis, kazanc, carpan: multiplier, kaynak: 'web' });
        }

        const kenoRemBal = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (kenoRemBal === 0 && kazanc === 0) {
            canliDurumIflasBildir({ userId, oyunAdi: 'Altın Keno', kaybedilenBahis: bahis, kaynak: 'web' });
        }

        res.json({
            success: true,
            bet: bahis,
            selectedNumbers,
            drawnNumbers,
            hits,
            hitCount,
            multiplier,
            kazanc,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // ==========================================
    // 🚀 LIMBO (HEDEF ÇARPAN AVCISI) OYUNU
    // ==========================================
    // Standart Casino Limbo Algoritması:
    // Kasa Avantajı (House Edge): %4.0
    // Üretilen Çarpan Formülü: Math.floor((96 / (100 * (1 - r))) * 100) / 100
    // Minimum Hedef: 1.05x, Maksimum Hedef: 1000.00x
    app.post('/api/limbo/play', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı! Lütfen Discord ile giriş yapın.' });

        const userId = sessionUser.id;
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        const bahis = parseInt(req.body.bet, 10);
        const targetMultiplier = parseFloat(req.body.target);

        if (isNaN(bahis) || bahis < 10) {
            return res.status(400).json({ error: 'Geçersiz bahis miktarı! (Minimum 10 🪙)' });
        }

        if (bahis > bakiye) {
            return res.status(400).json({ error: 'Yetersiz bakiye!' });
        }

        if (isNaN(targetMultiplier) || targetMultiplier < 1.05 || targetMultiplier > 1000.00) {
            return res.status(400).json({ error: 'Hedef çarpan 1.05x ile 1000.00x arasında olmalıdır!' });
        }

        // Bakiyeden düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        // Adil Casino Limbo Çarpanı Üretimi:
        // %4 Kasa avantajı
        const r = Math.random();
        let resultMultiplier = 1.00;

        // %4 ihtimalle anlık 1.00x'te patlar (Erken patlama koruması)
        if (r < 0.04) {
            resultMultiplier = 1.00;
        } else {
            // (1 - houseEdge) / (1 - r) formülü
            const raw = 0.96 / (1 - r);
            resultMultiplier = parseFloat(Math.min(1000.00, Math.max(1.01, raw)).toFixed(2));
        }

        // Kazanma Durumu: Gelen çarpan >= Oyuncunun Hedefi
        const isWin = resultMultiplier >= targetMultiplier;
        let kazanc = 0;

        if (isWin) {
            kazanc = Math.floor(bahis * targetMultiplier);
            ecoDb.ekle(`cuzdan_${userId}`, kazanc);
            canliDurumBildir({ userId, oyunAdi: 'Limbo Rocket', bahis, kazanc, carpan: targetMultiplier, kaynak: 'web' });
        }

        const limboRemBal = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (limboRemBal === 0 && !isWin) {
            canliDurumIflasBildir({ userId, oyunAdi: 'Limbo Rocket', kaybedilenBahis: bahis, kaynak: 'web' });
        }

        res.json({
            success: true,
            bet: bahis,
            targetMultiplier,
            resultMultiplier,
            isWin,
            kazanc,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // ==========================================
    // 🐔 CHICKEN ROAD / TRAFİK (KARŞIDAN KARŞIYA GEÇİŞ)
    // ==========================================
    // 8 Şeritli Otoyol
    const ROAD_CONFIGS = {
        easy: {
            // Kolay: Her şeritte çarpma ihtimali %16
            multipliers: [1.15, 1.35, 1.62, 1.95, 2.38, 2.95, 3.75, 4.90],
            crashProbability: 0.16
        },
        medium: {
            // Orta: Her şeritte çarpma ihtimali %25
            multipliers: [1.28, 1.70, 2.28, 3.10, 4.25, 6.00, 8.80, 13.50],
            crashProbability: 0.25
        },
        hard: {
            // Zor: Her şeritte çarpma ihtimali %38
            multipliers: [1.55, 2.50, 4.10, 6.80, 11.50, 20.00, 36.00, 68.00],
            crashProbability: 0.38
        }
    };

    // 1. Oyunu Başlat
    app.post('/api/road/start', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı! Lütfen Discord ile giriş yapın.' });

        const userId = sessionUser.id;
        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        const bahis = parseInt(req.body.bet, 10);
        const difficulty = req.body.difficulty || 'medium';

        if (isNaN(bahis) || bahis < 10) {
            return res.status(400).json({ error: 'Geçersiz bahis miktarı! (Minimum 10 🪙)' });
        }

        if (bahis > bakiye) {
            return res.status(400).json({ error: 'Yetersiz bakiye!' });
        }

        const config = ROAD_CONFIGS[difficulty];
        if (!config) {
            return res.status(400).json({ error: 'Geçersiz zorluk derecesi!' });
        }

        // Önceki yarım kalan oyunu sıfırla
        if (activeRoadGames.has(userId)) {
            activeRoadGames.delete(userId);
        }

        // Bakiyeden düş
        ecoDb.cikar(`cuzdan_${userId}`, bahis);

        // 8 şeritte araba çarpma durumlarını önceden üret
        // En az 1 şeritte çarpma garantidir (sonsuz tırmanışı önler)
        const laneCrashes = [];
        for (let i = 0; i < 8; i++) {
            laneCrashes.push(Math.random() < config.crashProbability);
        }
        // Eğer hiçbirinde çarpma çıkmadıysa son şeride kesin çarpma koy (kasa güvenliği)
        if (!laneCrashes.some(c => c)) {
            laneCrashes[7] = true;
        }

        const gameSession = {
            userId,
            bet: bahis,
            difficulty,
            currentStep: 0, // 0 = kaldırımda (henüz yola inmedi)
            laneCrashes,
            multipliers: config.multipliers,
            active: true
        };

        activeRoadGames.set(userId, gameSession);

        res.json({
            success: true,
            bet: bahis,
            difficulty,
            multipliers: config.multipliers,
            currentStep: 0,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // 2. Bir Sonraki Şeride İlerle (Zıpla / Step)
    app.post('/api/road/step', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı!' });

        const userId = sessionUser.id;
        const game = activeRoadGames.get(userId);

        if (!game || !game.active) {
            return res.status(400).json({ error: 'Aktif bir yol oyunu bulunamadı!' });
        }

        const targetLane = game.currentStep; // 0'dan 7'ye kadar şeritler
        const isCrashed = game.laneCrashes[targetLane];

        if (isCrashed) {
            // 💥 ARABA ÇARPTI! Oyun bitti.
            game.active = false;
            activeRoadGames.delete(userId);

            const roadRemBal = ecoDb.bul(`cuzdan_${userId}`) || 0;
            if (roadRemBal === 0) {
                canliDurumIflasBildir({ userId, oyunAdi: 'Chicken Road', kaybedilenBahis: game.bet, kaynak: 'web' });
            }

            return res.json({
                success: true,
                crashed: true,
                crashedLane: targetLane,
                allCrashes: game.laneCrashes,
                yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
            });
        }

        // 🟢 ŞERİT GÜVENLİ!
        game.currentStep++;
        const nextStep = game.currentStep;
        const currentMultiplier = game.multipliers[targetLane];
        const isFinished = nextStep >= 8; // Karşı kaldırıma ulaştı mı?

        if (isFinished) {
            // Karşı kaldırıma ulaştı! Otomatik Cashout
            game.active = false;
            activeRoadGames.delete(userId);

            const kazanc = Math.floor(game.bet * currentMultiplier);
            ecoDb.ekle(`cuzdan_${userId}`, kazanc);
            canliDurumBildir({ userId, oyunAdi: 'Chicken Road', bahis: game.bet, kazanc, carpan: currentMultiplier, kaynak: 'web' });

            return res.json({
                success: true,
                crashed: false,
                currentStep: nextStep,
                multiplier: currentMultiplier,
                isFinished: true,
                kazanc,
                allCrashes: game.laneCrashes,
                yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
            });
        }

        res.json({
            success: true,
            crashed: false,
            currentStep: nextStep,
            multiplier: currentMultiplier,
            isFinished: false,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // 3. Parayı Çek (Cashout)
    app.post('/api/road/cashout', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı!' });

        const userId = sessionUser.id;
        const game = activeRoadGames.get(userId);

        if (!game || !game.active || game.currentStep === 0) {
            return res.status(400).json({ error: 'Çekilebilecek aktif bir kazanç yok!' });
        }

        const wonMultiplier = game.multipliers[game.currentStep - 1];
        const kazanc = Math.floor(game.bet * wonMultiplier);
        ecoDb.ekle(`cuzdan_${userId}`, kazanc);
        canliDurumBildir({ userId, oyunAdi: 'Chicken Road', bahis: game.bet, kazanc, carpan: wonMultiplier, kaynak: 'web' });

        const allCrashes = [...game.laneCrashes];
        game.active = false;
        activeRoadGames.delete(userId);

        res.json({
            success: true,
            kazanc,
            multiplier: wonMultiplier,
            allCrashes,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // ==========================================
    // 📈 CANLI BORSA & YATIRIM TERMİNALİ API
    // ==========================================
    
    // 1. Canlı Piyasa & Portföy Bilgisi Getir
    app.get('/api/market/data', (req, res) => {
        try {
            const { piyasa, kalanZaman } = piyasayiGetir();
            const sessionUser = getAuthUser(req);
            
            let userPortfoy = {};
            let cuzdanBakiye = 0;

            if (sessionUser) {
                const userId = sessionUser.id;
                userPortfoy = userDb.bul(`portfoy_${userId}`) || {};
                cuzdanBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
            }

            const assets = [];
            let toplamPortfoyDegeri = 0;

            for (const key in VARLIKLAR) {
                const v = VARLIKLAR[key];
                const p = piyasa[key];
                const fiyat = p ? p.fiyat : Math.floor((v.min + v.max) / 2);
                const eskiFiyat = p ? p.eskiFiyat : fiyat;
                
                // Değişim yüzdesi
                const diff = eskiFiyat > 0 ? (((fiyat - eskiFiyat) / eskiFiyat) * 100) : 0;
                
                // Kullanıcının sahip olduğu adet
                const rawAdet = userPortfoy[key];
                const adet = typeof rawAdet === 'number' ? rawAdet : (rawAdet ? rawAdet.adet || 0 : 0);
                const varlikToplamDeger = adet * fiyat;
                toplamPortfoyDegeri += varlikToplamDeger;

                assets.push({
                    id: key,
                    name: v.isim,
                    fiyat,
                    eskiFiyat,
                    degisimYuzdesi: parseFloat(diff.toFixed(2)),
                    durum: diff > 0 ? 'up' : (diff < 0 ? 'down' : 'stable'),
                    adet,
                    toplamDeger: varlikToplamDeger
                });
            }

            res.json({
                success: true,
                kalanZaman,
                cuzdanBakiye,
                toplamPortfoyDegeri,
                assets
            });
        } catch (err) {
            console.error('Market data error:', err);
            res.status(500).json({ error: 'Piyasa verileri yüklenemedi' });
        }
    });

    // 2. Borsa Varlık Alımı (Buy)
    app.post('/api/market/buy', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı! Lütfen Discord ile giriş yapın.' });

        const userId = sessionUser.id;
        const assetId = req.body.assetId;
        const adet = parseInt(req.body.amount, 10);

        if (!VARLIKLAR[assetId]) {
            return res.status(400).json({ error: 'Geçersiz varlık seçimi!' });
        }

        if (isNaN(adet) || adet <= 0) {
            return res.status(400).json({ error: 'Lütfen geçerli bir adet girin!' });
        }

        const { piyasa } = piyasayiGetir();
        const birimFiyat = piyasa[assetId] ? piyasa[assetId].fiyat : VARLIKLAR[assetId].min;
        const toplamMaliyet = adet * birimFiyat;

        const bakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (toplamMaliyet > bakiye) {
            return res.status(400).json({ error: `Yetersiz bakiye! Gerekli: ${toplamMaliyet.toLocaleString()} 🪙, Bakiyeniz: ${bakiye.toLocaleString()} 🪙` });
        }

        // Bakiyeden düş
        ecoDb.cikar(`cuzdan_${userId}`, toplamMaliyet);

        // Portföye ekle
        let portfoy = userDb.bul(`portfoy_${userId}`) || {};
        let mevcutAdet = 0;
        if (typeof portfoy[assetId] === 'number') {
            mevcutAdet = portfoy[assetId];
        } else if (portfoy[assetId] && typeof portfoy[assetId].adet === 'number') {
            mevcutAdet = portfoy[assetId].adet;
        }

        portfoy[assetId] = mevcutAdet + adet;
        userDb.ayarla(`portfoy_${userId}`, portfoy);

        res.json({
            success: true,
            message: `${adet.toLocaleString()} adet ${VARLIKLAR[assetId].isim} başarıyla satın alındı!`,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0,
            yeniAdet: portfoy[assetId]
        });
    });

    // 3. Borsa Varlık Satışı (Sell)
    app.post('/api/market/sell', (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı! Lütfen Discord ile giriş yapın.' });

        const userId = sessionUser.id;
        const assetId = req.body.assetId;
        const adet = parseInt(req.body.amount, 10);

        if (!VARLIKLAR[assetId]) {
            return res.status(400).json({ error: 'Geçersiz varlık seçimi!' });
        }

        if (isNaN(adet) || adet <= 0) {
            return res.status(400).json({ error: 'Lütfen geçerli bir adet girin!' });
        }

        let portfoy = userDb.bul(`portfoy_${userId}`) || {};
        let mevcutAdet = 0;
        if (typeof portfoy[assetId] === 'number') {
            mevcutAdet = portfoy[assetId];
        } else if (portfoy[assetId] && typeof portfoy[assetId].adet === 'number') {
            mevcutAdet = portfoy[assetId].adet;
        }

        if (adet > mevcutAdet) {
            return res.status(400).json({ error: `Portföyünüzde yeterli ${VARLIKLAR[assetId].isim} bulunmuyor! (Mevcut: ${mevcutAdet.toLocaleString()})` });
        }

        const { piyasa } = piyasayiGetir();
        const birimFiyat = piyasa[assetId] ? piyasa[assetId].fiyat : VARLIKLAR[assetId].min;
        const toplamKazanc = adet * birimFiyat;

        // Portföyden düş
        portfoy[assetId] = mevcutAdet - adet;
        if (portfoy[assetId] <= 0) {
            delete portfoy[assetId];
        }
        userDb.ayarla(`portfoy_${userId}`, portfoy);

        // Nakit hesaba ekle
        ecoDb.ekle(`cuzdan_${userId}`, toplamKazanc);

        res.json({
            success: true,
            message: `${adet.toLocaleString()} adet ${VARLIKLAR[assetId].isim} satıldı ve ${toplamKazanc.toLocaleString()} 🪙 nakit kazandınız!`,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0,
            yeniAdet: portfoy[assetId] || 0
        });
    });

    // ==========================================
    // 🛍️ DİSCORD MAĞAZA (SHOP) WEB API
    // ==========================================
    
    // 1. Mağaza Ürünlerini & Kullanıcı Envanterini Getir
    app.get('/api/shop/items', (req, res) => {
        try {
            const shopPath = path.join(__dirname, '..', 'config', 'shop.json');
            const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));
            const sessionUser = getAuthUser(req);

            let envanter = [];
            let aktifTilsimlar = [];
            let cuzdanBakiye = 0;

            if (sessionUser) {
                const userId = sessionUser.id;
                envanter = userDb.bul(`envanter_${userId}`) || [];
                aktifTilsimlar = userDb.bul(`tilsimlar_${userId}`) || [];
                cuzdanBakiye = ecoDb.bul(`cuzdan_${userId}`) || 0;
            }

            res.json({
                success: true,
                shop: shopData,
                envanter,
                aktifTilsimlar,
                cuzdanBakiye
            });
        } catch (err) {
            console.error('Shop fetch error:', err);
            res.status(500).json({ error: 'Mağaza verileri yüklenemedi' });
        }
    });

    // 2. Webden Mağaza Ürünü Satın Al
    app.post('/api/shop/buy', async (req, res) => {
        const sessionUser = getAuthUser(req);
        if (!sessionUser) return res.status(401).json({ error: 'Oturum bulunamadı! Lütfen Discord ile giriş yapın.' });

        const userId = sessionUser.id;
        const { itemId, categoryId } = req.body;

        const shopPath = path.join(__dirname, '..', 'config', 'shop.json');
        const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

        const kategoriVerisi = shopData[categoryId];
        if (!kategoriVerisi) return res.status(400).json({ error: 'Geçersiz kategori!' });

        const urun = kategoriVerisi.find(u => u.id === itemId);
        if (!urun) return res.status(400).json({ error: 'Ürün bulunamadı!' });

        const cuzdanParasi = ecoDb.bul(`cuzdan_${userId}`) || 0;
        if (cuzdanParasi < urun.fiyat) {
            return res.status(400).json({ error: `Yetersiz bakiye! Bu ürünü almak için ${urun.fiyat.toLocaleString()} 🪙 gerekiyor.` });
        }

        let envanter = userDb.bul(`envanter_${userId}`) || [];

        // Tılsımlar için özel mantık
        if (categoryId === 'tilsimlar') {
            ecoDb.cikar(`cuzdan_${userId}`, urun.fiyat);
            ekleTilsim(userId, urun);
            return res.json({
                success: true,
                message: `${urun.emoji || '🧿'} ${urun.isim} başarıyla aktifleşti! (${urun.sureSaat} saat geçerli)`,
                yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
            });
        }

        // Zaten sahip mi?
        if (envanter.some(e => e.id === urun.id)) {
            return res.status(400).json({ error: `Zaten "${urun.isim}" ürününe sahipsiniz!` });
        }

        // Meslekler için sırasıyla terfi kontrolü
        if (categoryId === 'meslekler') {
            const hedefIndex = kategoriVerisi.findIndex(u => u.id === itemId);
            const mevcutMeslek = envanter.find(e => e.kategori === 'meslekler');

            // Eğer zaten bu mesleğe sahipse
            if (mevcutMeslek && mevcutMeslek.id === itemId) {
                return res.status(400).json({ error: `Zaten "${urun.isim}" mesleğindesiniz!` });
            }

            // Eğer oyuncunun zaten bir mesleği varsa ve daha alt seviye bir meslek almaya çalışıyorsa engelle
            if (mevcutMeslek) {
                const mevcutIndex = kategoriVerisi.findIndex(u => u.id === mevcutMeslek.id);
                if (hedefIndex < mevcutIndex) {
                    return res.status(400).json({ 
                        error: `Şu anki mesleğiniz (${mevcutMeslek.isim}), almak istediğiniz meslekten (${urun.isim}) daha üst seviyede! Rütbe düşüremezsiniz.` 
                    });
                }
            }

            // Bir sonraki mesleğe geçiş kontrolü (Örn: Köylü -> Torbacı -> Garson...)
            if (hedefIndex > 0) {
                const gerekenMeslek = kategoriVerisi[hedefIndex - 1];
                if (!mevcutMeslek || mevcutMeslek.id !== gerekenMeslek.id) {
                    return res.status(400).json({ error: `Bu mesleğe geçmek için önce "${gerekenMeslek.isim}" olarak çalışmalısın!` });
                }
            }
        }

        // Bakiyeden düş
        ecoDb.cikar(`cuzdan_${userId}`, urun.fiyat);

        let ekstraMesaj = '';
        if (categoryId === 'meslekler') {
            const eskiMeslek = envanter.find(e => e.kategori === 'meslekler');
            if (eskiMeslek) {
                envanter = envanter.filter(e => e.kategori !== 'meslekler');
                ekstraMesaj = ` (Eski mesleğiniz ${eskiMeslek.isim} bırakıldı ve terfi ettiniz!)`;
            }
            userDb.ayarla(`xp_${userId}`, 0); // XP sıfırla
        }

        envanter.push({
            id: urun.id,
            isim: urun.isim,
            kategori: categoryId,
            bonusYuzdesi: urun.bonusYuzdesi,
            seviye: categoryId === 'yatirimlar' ? 1 : undefined
        });
        userDb.ayarla(`envanter_${userId}`, envanter);

        // Sunucu Rolü İse Rolü Discord Üzerinden Ver
        if (categoryId === 'roller' && urun.roleId && client) {
            try {
                // Botun olduğu sunucuları tara ve üyeye rolü ver
                for (const guild of client.guilds.cache.values()) {
                    try {
                        const member = await guild.members.fetch(userId);
                        if (member && guild.roles.cache.has(urun.roleId)) {
                            await member.roles.add(urun.roleId);
                            break;
                        }
                    } catch {}
                }
            } catch (err) {
                console.error('Role add error from web:', err);
            }
        }

        res.json({
            success: true,
            message: `Tebrikler! ${urun.fiyat.toLocaleString()} 🪙 ödeyerek "${urun.isim}" satın aldınız!${ekstraMesaj}`,
            yeniBakiye: ecoDb.bul(`cuzdan_${userId}`) || 0
        });
    });

    // --- 5. LİDERLİK TABLOSU (TOP 10 ZENGİNLER) ---
    app.get('/api/leaderboard', async (req, res) => {
        try {
            const economyData = ecoDb.readDB() || {};
            const userData = userDb.readDB() || {};
            const piyasa = economyData['borsa_piyasa'] || {};

            const oyuncular = [];

            for (const key in economyData) {
                if (key.startsWith('cuzdan_')) {
                    const userId = key.split('_')[1];
                    const bakiye = economyData[key] || 0;

                    let borsaDegeri = 0;
                    const portfoy = userData[`portfoy_${userId}`];
                    if (portfoy) {
                        for (const varlikId in portfoy) {
                            let veri = portfoy[varlikId];
                            if (!veri) continue;
                            let adet = typeof veri === 'number' ? veri : veri.adet;
                            if (adet > 0 && piyasa[varlikId]) {
                                borsaDegeri += adet * piyasa[varlikId].fiyat;
                            }
                        }
                    }

                    const toplamServet = bakiye + borsaDegeri;
                    if (toplamServet > 0) {
                        oyuncular.push({
                            userId,
                            bakiye,
                            borsa: Math.floor(borsaDegeri),
                            servet: Math.floor(toplamServet)
                        });
                    }
                }
            }

            oyuncular.sort((a, b) => b.servet - a.servet);
            const top10 = oyuncular.slice(0, 10);

            // Kullanıcı bilgilerini Discord Client üzerinden çek
            const results = await Promise.all(top10.map(async (p, idx) => {
                let username = 'Bilinmeyen Kullanıcı';
                let avatar = 'https://cdn.discordapp.com/embed/avatars/0.png';

                if (client && client.users) {
                    try {
                        const u = await client.users.fetch(p.userId);
                        if (u) {
                            username = u.globalName || u.username;
                            avatar = u.displayAvatarURL({ dynamic: true, size: 64 });
                        }
                    } catch {}
                }

                return {
                    rank: idx + 1,
                    userId: p.userId,
                    username,
                    avatar,
                    bakiye: p.bakiye,
                    borsa: p.borsa,
                    servet: p.servet
                };
            }));

            res.json({ success: true, leaderboard: results });
        } catch (err) {
            console.error('Leaderboard error:', err);
            res.status(500).json({ error: 'Liderlik tablosu yüklenemedi' });
        }
    });

    app.listen(PORT, () => {
        console.log(`🌐 [VEXORA] Web sunucusu aktif: ${DOMAIN} (Port: ${PORT})`);
    });
}

module.exports = { startWebServer };
