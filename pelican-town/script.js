// ==========================================
// STARDEW VALLEY STYLE CANVAS SCENE ENGINE (EXTENDED CUTSCENE)
// ==========================================
const canvas = document.getElementById('stardewCanvas');
const ctx = canvas.getContext('2d');

const V_WIDTH = 320;
const V_HEIGHT = 180;
canvas.width = V_WIDTH;
canvas.height = V_HEIGHT;
ctx.imageSmoothingEnabled = false;

let frame = 0;

// Yeni Detaylı Sahne Aşamaları:
// 0. IDLE: Başlatılmayı bekliyor
// 1. VAN_DRIVING_IN: Posta arabası gelir, kutunun az gerisinde durur
// 2. POSTMAN_WALK_TO_BOX: Postacı arabadan iner, kutuya doğru yürür
// 3. POSTMAN_DELIVER: Postacı kutuya mektubu koyar, bayrağı kaldırır
// 4. POSTMAN_WALK_BACK: Postacı arabaya geri yürür ve biner
// 5. VAN_DRIVING_OUT: Posta arabası kornayla sağa uzaklaşır
// 6. GIRL_EXITS_HOUSE: Evin kapısı açılır, kız şaşkınlıkla çıkar
// 7. GIRL_WALK_TO_BOX: Kız posta kutusuna doğru yürür
// 8. GIRL_ARRIVED: Kız kutunun başında durur, başında soru/ünlem balonu çıkar
// 9. DIALOG_PHASE: İnteraktif diyalog akışı başlar
let sceneState = 'IDLE';
let stateTimer = 0;

// Posta arabası konumu
let vanX = -80;
const vanY = 124;
const mailboxX = 145;
const mailboxY = 118;

// Postacı konumu
let postmanX = 85;
let postmanY = 125;
let isPostmanVisible = false;
let postmanDir = 1; // 1: sağ, -1: sol

// Karakter ve Ev Konumlandırması:
// Ev tabanı Y = 116'da, Kapı Y = 92 - 116 arasında.
// Kızın ayakları tam kapı eşiğinde (y = 96) başlar, çitin bahçe kapısı boşluğundan (X = 188) yola iner (Y = 120),
// sonra yoldan posta kutusuna (X = 160, Y = 120) doğru yürür!
let girlX = 188;
let girlY = 96;
let isGirlVisible = false;
let girlTargetX = 160;
let girlTargetY = 120;
let girlStepStage = 0; // 0: kapıda, 1: aşağı yola iniyor, 2: posta kutusuna yürüyor
let girlBubble = ''; // '!', '?'

// Kapı Durumu
let isDoorOpen = false;
let doorOpenAngle = 0; // 0: kapalı, 1: tam açık

// Posta Kutusu Durumu
let hasMailboxLetter = false;

// Ağaçlar ve Çiçekler
const trees = [
    { x: 10, y: 55, type: 'pine' },
    { x: 38, y: 62, type: 'oak' },
    { x: 260, y: 50, type: 'oak' },
    { x: 285, y: 58, type: 'pine' }
];

const flowers = [
    { x: 75, y: 138, color: '#ff4d6d' },
    { x: 84, y: 142, color: '#ffe66d' },
    { x: 92, y: 136, color: '#48bfe3' },
    { x: 165, y: 138, color: '#ff758f' },
    { x: 178, y: 144, color: '#fff' },
    { x: 235, y: 140, color: '#ffb703' },
    { x: 248, y: 137, color: '#f72585' }
];

// Bulutlar
const clouds = [
    { x: 20, y: 18, w: 38 },
    { x: 140, y: 26, w: 48 },
    { x: 240, y: 14, w: 34 }
];

function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

// 1. Arka Plan: Gökyüzü, Dağlar, Çiftlik Evi, Yol
function drawEnvironment() {
    // Tatlı gün batımı/sabah pembemsi Stardew gökyüzü
    const sky = ctx.createLinearGradient(0, 0, 0, 95);
    sky.addColorStop(0, '#f9a8b8');
    sky.addColorStop(0.5, '#ffd1dc');
    sky.addColorStop(1, '#ffebf0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, V_WIDTH, 95);

    // Bulutlar
    clouds.forEach(c => {
        c.x += 0.05;
        if (c.x > V_WIDTH + 50) c.x = -60;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(Math.floor(c.x), c.y, c.w, 10);
        ctx.fillRect(Math.floor(c.x + 4), c.y - 4, c.w - 8, 4);
        ctx.fillRect(Math.floor(c.x + 6), c.y + 10, c.w - 12, 3);
    });

    // Uzaktaki Dağlar (Mor/Pastel siluet)
    ctx.fillStyle = '#b38299';
    ctx.beginPath();
    ctx.moveTo(0, 95);
    ctx.lineTo(35, 60);
    ctx.lineTo(80, 95);
    ctx.lineTo(130, 52);
    ctx.lineTo(185, 95);
    ctx.lineTo(240, 58);
    ctx.lineTo(290, 95);
    ctx.lineTo(320, 70);
    ctx.lineTo(320, 95);
    ctx.fill();

    // Çim Tepe / Zemin
    drawPixelRect(0, 95, V_WIDTH, 85, '#5c9446'); // Stardew çimeni yeşili
    drawPixelRect(0, 95, V_WIDTH, 3, '#7ab35f'); // Çim ışığı

    // Çiftlik Evi (Ahşap Stardew kulübesi)
    drawHouse(175, 52);

    // Evden yola inen tatlı taş patika yolu
    drawPixelRect(184, 116, 12, 10, '#c79d6f');
    drawPixelRect(185, 118, 10, 8, '#b88958');
    for (let sy = 117; sy < 125; sy += 3) {
        drawPixelRect(186, sy, 3, 2, '#966d43');
        drawPixelRect(191, sy + 1, 3, 2, '#966d43');
    }

    // Çitler (Bahçe kapısı / yürüyüş yolu için 182-198 arasını açık bırakıyoruz)
    for (let fx = 120; fx < 265; fx += 13) {
        if (fx >= 135 && fx <= 155) continue; // Posta kutusu açıklığı
        if (fx >= 180 && fx <= 198) continue; // Kapıdan çıkan patika açıklığı!
        drawFence(fx, 114);
    }

    // Toprak / Taş Sokak Yolu
    drawPixelRect(0, 126, V_WIDTH, 32, '#a57951'); // Toprak yol
    drawPixelRect(0, 126, V_WIDTH, 2, '#855b38');
    drawPixelRect(0, 158, V_WIDTH, 22, '#558b3e'); // Alt çim sınır

    // Yol üzerindeki minik taş çakıllar
    for (let px = 10; px < V_WIDTH; px += 28) {
        drawPixelRect(px + (px % 5), 132 + (px % 8), 3, 2, '#8c6340');
    }

    // Ağaçlar
    trees.forEach(t => {
        if (t.type === 'oak') drawOakTree(t.x, t.y);
        else drawPineTree(t.x, t.y);
    });

    // Çiçekler
    flowers.forEach(fl => {
        drawPixelRect(fl.x, fl.y, 2, 2, fl.color);
        drawPixelRect(fl.x, fl.y + 2, 1, 2, '#386624');
    });

    // Posta Kutusu
    drawMailbox(mailboxX, mailboxY);
}

// Çit Çizimi
function drawFence(x, y) {
    drawPixelRect(x, y, 3, 14, '#c28b57');
    drawPixelRect(x - 2, y + 3, 8, 2, '#8f5c30');
    drawPixelRect(x - 2, y + 8, 8, 2, '#8f5c30');
}

// Meşe Ağacı
function drawOakTree(x, y) {
    // Gövde
    drawPixelRect(x + 12, y + 26, 6, 22, '#5e371d');
    drawPixelRect(x + 10, y + 44, 10, 4, '#442512');
    // Yapraklar (Katmanlı pikseller)
    drawPixelRect(x + 2, y + 6, 26, 22, '#3e7529');
    drawPixelRect(x + 6, y, 18, 10, '#539637');
    drawPixelRect(x - 2, y + 12, 34, 12, '#336321');
    drawPixelRect(x + 4, y + 4, 6, 4, '#76bf4e'); // Highlight
}

// Çam Ağacı
function drawPineTree(x, y) {
    drawPixelRect(x + 8, y + 30, 4, 18, '#4f2c16');
    // Çam katları
    drawPixelRect(x + 8, y, 4, 8, '#26542a');
    drawPixelRect(x + 4, y + 8, 12, 10, '#2d6332');
    drawPixelRect(x + 1, y + 18, 18, 12, '#204724');
    drawPixelRect(x - 2, y + 28, 24, 8, '#1b3b1e');
}

// Stardew Çiftlik Evi
function drawHouse(x, y) {
    // Ahşap duvarlar
    drawPixelRect(x, y + 20, 68, 44, '#d49b65');
    // Duvar çizgileri
    for (let wy = y + 24; wy < y + 60; wy += 8) {
        drawPixelRect(x, wy, 68, 1, '#b07945');
    }
    // Çatı (Kırmızımsı şık kiremit)
    for (let i = 0; i < 22; i++) {
        drawPixelRect(x - 4 + i, y + 20 - i, 76 - (i * 2), 2, '#a73333');
    }
    drawPixelRect(x + 24, y - 5, 20, 4, '#872323'); // Tepe mahya

    // Kapı Kasası & Giriş Boşluğu (İçi gölge/karanlık oda)
    drawPixelRect(x + 12, y + 40, 14, 24, '#7a3e1d'); // Ahşap pervaz
    drawPixelRect(x + 14, y + 42, 10, 20, '#221118'); // Evin içi (karanlık salon)

    // Kapı Kanadı (Açılma Animasyonu)
    if (!isDoorOpen) {
        // Kapalı kapı
        drawPixelRect(x + 14, y + 42, 10, 20, '#592911');
        drawPixelRect(x + 21, y + 52, 2, 2, '#ffe066'); // Altın tokmak
        drawPixelRect(x + 15, y + 44, 3, 7, '#6b3316'); // Panel detayları
        drawPixelRect(x + 15, y + 53, 3, 7, '#6b3316');
    } else {
        // İçeri doğru ardına kadar açılmış kapı kanadı (perspektif)
        drawPixelRect(x + 14, y + 42, 3, 20, '#592911'); // Açık kapı kanadı profili
        drawPixelRect(x + 15, y + 52, 1, 2, '#ffe066'); // Tokmak yanı
        // Odadan dışarı süzülen sıcak sarı ışık huzmesi
        ctx.fillStyle = 'rgba(255, 230, 150, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x + 14, y + 62);
        ctx.lineTo(x + 24, y + 62);
        ctx.lineTo(x + 28, y + 68);
        ctx.lineTo(x + 12, y + 68);
        ctx.fill();
    }

    // Pencere
    drawPixelRect(x + 38, y + 32, 18, 16, '#395e66');
    drawPixelRect(x + 40, y + 34, 14, 12, '#e0fbfc');
    drawPixelRect(x + 46, y + 34, 2, 12, '#395e66');
    drawPixelRect(x + 40, y + 40, 14, 2, '#395e66');

    // Baca & Duman
    drawPixelRect(x + 50, y - 2, 8, 14, '#6b3e2e');
    const smokeOffset = Math.sin(frame * 0.05) * 3;
    drawPixelRect(x + 52 + smokeOffset, y - 8, 4, 4, 'rgba(255,255,255,0.6)');
    drawPixelRect(x + 55 + smokeOffset * 1.5, y - 14, 5, 5, 'rgba(255,255,255,0.4)');
}

// Posta Kutusu
function drawMailbox(x, y) {
    // Direk
    drawPixelRect(x + 4, y + 8, 4, 16, '#6b4423');
    // Kutu gövdesi
    drawPixelRect(x, y, 12, 10, '#c73e3a');
    drawPixelRect(x + 1, y - 2, 10, 2, '#e0534f'); // Kavisli tavan
    drawPixelRect(x + 10, y + 2, 2, 6, '#8f2320'); // Kapak gölgesi

    // Bayrak (Posta gelince dikilir!)
    if (hasMailboxLetter) {
        drawPixelRect(x - 4, y - 4, 4, 3, '#ffd166'); // Havada sarı bayrak
        drawPixelRect(x - 1, y - 4, 1, 8, '#333');
        // Kutu parıltısı
        if (Math.floor(frame / 15) % 2 === 0) {
            drawPixelRect(x + 5, y - 6, 2, 2, '#fff');
            drawPixelRect(x + 4, y - 7, 4, 1, '#fffae0');
        }
    } else {
        drawPixelRect(x - 4, y + 4, 4, 2, '#ffd166'); // İnmiş bayrak
    }
}

// Postacı Çizimi (Şapkalı, postacı çantalı sevimli piksel karakter)
function drawPostman(x, y, dir, isWalking) {
    const px = Math.floor(x);
    const walkStep = isWalking ? Math.floor((frame / 6) % 4) : 0;
    const legOffset1 = (walkStep === 1) ? 1 : (walkStep === 3 ? -1 : 0);
    const legOffset2 = -legOffset1;

    // Şapka (Koyu lacivert postacı kasketi)
    drawPixelRect(px + 1, y - 2, 7, 3, '#1d3557');
    drawPixelRect(px + (dir === 1 ? 5 : 0), y, 4, 1, '#1d3557'); // Siperlik

    // Yüz
    drawPixelRect(px + 2, y + 1, 5, 4, '#ffdbac');
    drawPixelRect(px + (dir === 1 ? 5 : 2), y + 2, 1, 1, '#222'); // Göz
    drawPixelRect(px + (dir === 1 ? 4 : 2), y + 3, 2, 1, '#b07d62'); // Bıyık

    // Üst Üniforma (Mavi postacı ceketi)
    drawPixelRect(px + 1, y + 5, 7, 7, '#457b9d');
    // Postacı omuz çantası
    drawPixelRect(px + (dir === 1 ? 1 : 6), y + 7, 3, 5, '#8b5a2b');
    drawPixelRect(px + 2, y + 5, 5, 1, '#683f19'); // Çanta askısı

    // Pantolon (Füme)
    drawPixelRect(px + 2, y + 12, 2, 4 + legOffset1, '#2b2d42');
    drawPixelRect(px + 5, y + 12, 2, 4 + legOffset2, '#2b2d42');

    // Botlar
    drawPixelRect(px + 1, y + 16 + legOffset1, 3, 1, '#1a1a24');
    drawPixelRect(px + 5, y + 16 + legOffset2, 3, 1, '#1a1a24');
}

// Kız Karakter Çizimi (Pembe elbiseli, kahverengi saçlı)
function drawWalkingGirl(x, y, isWalking) {
    const gx = Math.floor(x);
    const walkStep = isWalking ? Math.floor((frame / 6) % 4) : 0;
    const legOffset1 = (walkStep === 1) ? 1 : (walkStep === 3 ? -1 : 0);
    const legOffset2 = -legOffset1;

    // Uzun Saç
    drawPixelRect(gx + 1, y - 2, 8, 4, '#7c4328');
    drawPixelRect(gx - 1, y + 2, 3, 11, '#7c4328');
    drawPixelRect(gx + 8, y + 2, 3, 11, '#7c4328');
    // Çiçek toka
    drawPixelRect(gx + 6, y - 1, 2, 2, '#ff4d6d');

    // Yüz
    drawPixelRect(gx + 2, y + 2, 6, 5, '#ffe0bd');
    drawPixelRect(gx + 3, y + 4, 1, 1, '#3b1c11'); // Sol göz
    drawPixelRect(gx + 6, y + 4, 1, 1, '#3b1c11'); // Sağ göz
    drawPixelRect(gx + 2, y + 5, 1, 1, '#ff9ebb'); // Allık
    drawPixelRect(gx + 7, y + 5, 1, 1, '#ff9ebb');

    // Pembe Kazak / Elbise
    drawPixelRect(gx + 1, y + 7, 8, 6, '#ff6584');
    drawPixelRect(gx, y + 13, 10, 4, '#e04368'); // Etek

    // Bacaklar
    drawPixelRect(gx + 2, y + 17, 2, 3 + legOffset1, '#ffe0bd');
    drawPixelRect(gx + 6, y + 17, 2, 3 + legOffset2, '#ffe0bd');

    // Kırmızı Babetler
    drawPixelRect(gx + 1, y + 20 + legOffset1, 3, 1, '#b51739');
    drawPixelRect(gx + 6, y + 20 + legOffset2, 3, 1, '#b51739');

    // Ünlem / Soru İşareti Balonu
    if (girlBubble) {
        drawSpeechBubble(gx + 3, y - 14, girlBubble);
    }
}

// Stardew İkonik Ünlem/Soru Balonu
function drawSpeechBubble(x, y, symbol) {
    const bx = Math.floor(x);
    const by = Math.floor(y + Math.sin(frame * 0.1) * 2);

    // Balon kutusu
    drawPixelRect(bx - 3, by - 4, 11, 10, '#ffffff');
    drawPixelRect(bx - 4, by - 3, 13, 8, '#ffffff');
    drawPixelRect(bx + 1, by + 6, 3, 2, '#ffffff');
    drawPixelRect(bx + 2, by + 8, 1, 1, '#ffffff');

    // Çerçeve
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 4, by - 4, 13, 11);

    // Sembol
    if (symbol === '!') {
        drawPixelRect(bx + 1, by - 2, 2, 5, '#e63946');
        drawPixelRect(bx + 1, by + 4, 2, 2, '#e63946');
    } else if (symbol === '?') {
        drawPixelRect(bx, by - 2, 4, 2, '#457b9d');
        drawPixelRect(bx + 3, by, 2, 2, '#457b9d');
        drawPixelRect(bx + 1, by + 2, 2, 2, '#457b9d');
        drawPixelRect(bx + 1, by + 5, 2, 1, '#457b9d');
    } else if (symbol === '♥') {
        drawPixelRect(bx, by - 1, 5, 4, '#ff3366');
    }
}
function drawDeliveryVan(x, y) {
    const vx = Math.floor(x);
    const vy = Math.floor(y);

    // Kamyon Kabini & Kasası
    drawPixelRect(vx, vy, 44, 18, '#c92a42'); // Gövde
    drawPixelRect(vx + 32, vy + 4, 14, 14, '#c92a42'); // Ön burun
    drawPixelRect(vx + 2, vy - 2, 40, 2, '#e63956'); // Tavan ışığı

    // Ön cam
    drawPixelRect(vx + 32, vy + 3, 9, 8, '#bde0fe');
    drawPixelRect(vx + 34, vy + 4, 2, 6, '#ffffff');

    // Yan Mektup Logosu (Kapıda kalp mühürlü mektup deseni)
    drawPixelRect(vx + 14, vy + 4, 12, 8, '#ffffff');
    drawPixelRect(vx + 18, vy + 7, 4, 3, '#ff3366'); // Minik kalp

    // Farlar
    drawPixelRect(vx + 44, vy + 12, 2, 4, '#ffea00');

    // Tekerlekler (Dönen efekt)
    const wheelFrame = Math.floor(frame / 4) % 2;
    // Arka teker
    drawPixelRect(vx + 6, vy + 15, 8, 8, '#1e1e24');
    drawPixelRect(vx + 8, vy + 17, 4, 4, wheelFrame === 0 ? '#adb5bd' : '#6c757d');
    // Ön teker
    drawPixelRect(vx + 32, vy + 15, 8, 8, '#1e1e24');
    drawPixelRect(vx + 34, vy + 17, 4, 4, wheelFrame === 0 ? '#adb5bd' : '#6c757d');

    // Egzoz dumanı
    if (sceneState === 'VAN_DRIVING_IN' || sceneState === 'VAN_DRIVING_OUT') {
        const puffX = vx - 4 - (frame % 8);
        drawPixelRect(puffX, vy + 16, 3, 3, 'rgba(200,200,200,0.6)');
    }
}

// Uçan/Teslim Edilen Mektup Animasyonu
function drawDeliveringLetter() {
    if (sceneState !== 'DELIVERING') return;

    // Zarf gövdesi
    drawPixelRect(letterFlyX, letterFlyY, 8, 6, '#fffaf0');
    // Zarf kapak çizgisi
    drawPixelRect(letterFlyX + 1, letterFlyY + 1, 6, 1, '#e0c9a6');
    // Kalp mühür
    drawPixelRect(letterFlyX + 3, letterFlyY + 2, 2, 2, '#ff3366');

    // Süzülürken arkasından saçılan pırıltılar
    if (frame % 3 === 0) {
        drawPixelRect(letterFlyX - 2, letterFlyY + 1, 2, 2, '#ffd166');
    }
}

// Sahne Akış Yönetimi (Uzun & Sinematik Cutscene)
function updateScene() {
    frame++;

    if (sceneState === 'IDLE') {
        return;
    }

    // 1. Posta Arabası Gelir
    if (sceneState === 'VAN_DRIVING_IN') {
        vanX += 1.3;
        if (vanX >= 55) {
            sceneState = 'POSTMAN_WALK_TO_BOX';
            stateTimer = 0;
            isPostmanVisible = true;
            postmanX = vanX + 36;
            postmanY = vanY - 2;
            postmanDir = 1;
        }
    }
    // 2. Postacı Arabadan İner, Kutuya Doğru Yürür
    else if (sceneState === 'POSTMAN_WALK_TO_BOX') {
        postmanX += 0.7;
        if (postmanX >= mailboxX - 10) {
            sceneState = 'POSTMAN_DELIVER';
            stateTimer = 0;
        }
    }
    // 3. Postacı Mektubu Kutuya Bırakır ve Bayrağı Kaldırır
    else if (sceneState === 'POSTMAN_DELIVER') {
        stateTimer++;
        if (stateTimer > 35) {
            hasMailboxLetter = true; // Bayrak kalkar!
        }
        if (stateTimer > 70) {
            sceneState = 'POSTMAN_WALK_BACK';
            postmanDir = -1; // Sola döner
        }
    }
    // 4. Postacı Arabaya Geri Yürür
    else if (sceneState === 'POSTMAN_WALK_BACK') {
        postmanX -= 0.7;
        if (postmanX <= vanX + 36) {
            isPostmanVisible = false; // Arabaya bindi
            sceneState = 'VAN_DRIVING_OUT';
            stateTimer = 0;
        }
    }
    // 5. Araba Kornaya Basıp Uzaklaşır
    else if (sceneState === 'VAN_DRIVING_OUT') {
        vanX += 1.6;
        if (vanX > V_WIDTH + 25) {
            // Araba gitti, şimdi kapı açılsın ve kız evden çıksın!
            sceneState = 'DOOR_OPENING';
            stateTimer = 0;
        }
    }
    // 5.5 Kapı Açılıyor
    else if (sceneState === 'DOOR_OPENING') {
        stateTimer++;
        if (stateTimer === 10) {
            isDoorOpen = true; // Kapı içeri doğru açılır!
        }
        if (stateTimer > 25) {
            // Kapı açıldıktan sonra kız kapı eşiğinde belirir
            sceneState = 'GIRL_EXITS_HOUSE';
            stateTimer = 0;
            isGirlVisible = true;
            girlX = 188;
            girlY = 96;
            girlStepStage = 0;
            girlBubble = '!'; // Şaşkınlık
        }
    }
    // 6. Evin Önünde Bir An Durup Posta Kutusunu Fark Eder
    else if (sceneState === 'GIRL_EXITS_HOUSE') {
        stateTimer++;
        if (stateTimer > 45) {
            girlBubble = '?'; // Merak
            sceneState = 'GIRL_WALK_TO_BOX';
            girlStepStage = 1; // 1. Aşama: Kapıdan patika ile aşağı yola in
        }
    }
    // 7. Kız Posta Kutusuna Doğal Şekilde Yürür (Önce yola iner, sonra yoldan kutuya gider)
    else if (sceneState === 'GIRL_WALK_TO_BOX') {
        if (girlStepStage === 1) {
            // Adım 1: Kapı eşiğinden patika boyunca aşağı yola in (Düz aşağı)
            if (girlY < 120) {
                girlY += 0.65;
            } else {
                girlY = 120;
                girlStepStage = 2; // Yola indi, şimdi sola kutuya dön
            }
        } 
        else if (girlStepStage === 2) {
            // Adım 2: Yoldan sola posta kutusuna doğru yürü
            if (girlX > girlTargetX) {
                girlX -= 0.65;
            } else {
                girlX = girlTargetX;
                // Kutuya vardı!
                sceneState = 'GIRL_ARRIVED';
                stateTimer = 0;
                girlBubble = '♥'; // Aşık/kalp balonu
            }
        }
    }
    // 8. Kutunun Başında Durur ve Diyalog Başlar
    else if (sceneState === 'GIRL_ARRIVED') {
        stateTimer++;
        if (stateTimer > 40) {
            sceneState = 'DIALOG_PHASE';
            startDialogFlow();
        }
    }
}

function render() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    drawEnvironment();

    // Araba Çizimi
    if (sceneState !== 'IDLE' && vanX < V_WIDTH + 30) {
        drawDeliveryVan(vanX, vanY);
    }

    // Postacı Çizimi
    if (isPostmanVisible) {
        const isWalking = (sceneState === 'POSTMAN_WALK_TO_BOX' || sceneState === 'POSTMAN_WALK_BACK');
        drawPostman(postmanX, postmanY, postmanDir, isWalking);
    }

    // Kız Karakter Çizimi
    if (isGirlVisible) {
        const isWalking = (sceneState === 'GIRL_WALK_TO_BOX');
        drawWalkingGirl(girlX, girlY, isWalking);
    }

    updateScene();
    requestAnimationFrame(render);
}

// ==========================================
// KUTLAMA EKRANI: TEMSİLİ STARDEW ÇİFTİ ÇİZİMİ
// ==========================================
const coupleCanvas = document.getElementById('coupleCanvas');
const cCtx = coupleCanvas.getContext('2d');
cCtx.imageSmoothingEnabled = false;

let coupleFrame = 0;

function drawPixelChar(ctxRef, x, y, isGirl, frameStep) {
    const bob = Math.sin(frameStep * 0.15) * 1.5;
    const py = Math.floor(y + bob);

    if (!isGirl) {
        // Erkek Karakter
        // Saç (Kestane)
        ctxRef.fillStyle = '#4a2c1b';
        ctxRef.fillRect(x + 2, py, 10, 4);
        ctxRef.fillRect(x, py + 2, 4, 6);
        // Yüz
        ctxRef.fillStyle = '#ffdbac';
        ctxRef.fillRect(x + 3, py + 4, 8, 6);
        // Göz
        ctxRef.fillStyle = '#221612';
        ctxRef.fillRect(x + 8, py + 6, 2, 2);
        // Üst Gömlek (Mavi Stardew tarzı)
        ctxRef.fillStyle = '#2a6f97';
        ctxRef.fillRect(x + 1, py + 10, 12, 12);
        // Pantolon
        ctxRef.fillStyle = '#3f37c9';
        ctxRef.fillRect(x + 3, py + 22, 4, 8);
        ctxRef.fillRect(x + 7, py + 22, 4, 8);
        // Ayakkabı
        ctxRef.fillStyle = '#1e1e24';
        ctxRef.fillRect(x + 2, py + 30, 5, 2);
        ctxRef.fillRect(x + 7, py + 30, 5, 2);
    } else {
        // Kız Karakter
        // Uzun Saç
        ctxRef.fillStyle = '#8b4513';
        ctxRef.fillRect(x + 2, py, 12, 5);
        ctxRef.fillRect(x, py + 3, 4, 16);
        ctxRef.fillRect(x + 10, py + 3, 4, 16);
        // Yüz & Allık
        ctxRef.fillStyle = '#ffe0bd';
        ctxRef.fillRect(x + 3, py + 4, 8, 6);
        ctxRef.fillStyle = '#ff9ebb'; // Allık
        ctxRef.fillRect(x + 7, py + 8, 2, 2);
        // Göz
        ctxRef.fillStyle = '#2b1b17';
        ctxRef.fillRect(x + 5, py + 6, 2, 2);
        // Çiçek toka
        ctxRef.fillStyle = '#ff4d6d';
        ctxRef.fillRect(x + 10, py + 2, 3, 3);
        // Elbise (Tatlı pembe)
        ctxRef.fillStyle = '#ff6b8b';
        ctxRef.fillRect(x + 2, py + 10, 10, 8);
        ctxRef.fillStyle = '#e63964';
        ctxRef.fillRect(x, py + 18, 14, 6);
        // Bacaklar & Ayakkabı
        ctxRef.fillStyle = '#ffe0bd';
        ctxRef.fillRect(x + 3, py + 24, 3, 6);
        ctxRef.fillRect(x + 8, py + 24, 3, 6);
        ctxRef.fillStyle = '#b51739';
        ctxRef.fillRect(x + 2, py + 30, 4, 2);
        ctxRef.fillRect(x + 8, py + 30, 4, 2);
    }
}

function animateCouple() {
    cCtx.clearRect(0, 0, 180, 110);

    // Çiftin arkasındaki zemin ve kalpler
    cCtx.fillStyle = '#5c9446';
    cCtx.fillRect(0, 85, 180, 25);

    // Başlarının üstünde atan büyük parlak kalp
    const heartScale = 1 + Math.sin(coupleFrame * 0.1) * 0.15;
    const hx = 90;
    const hy = 28;
    cCtx.fillStyle = '#ff1493';
    cCtx.beginPath();
    cCtx.arc(hx - 6 * heartScale, hy, 7 * heartScale, 0, Math.PI * 2);
    cCtx.arc(hx + 6 * heartScale, hy, 7 * heartScale, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.beginPath();
    cCtx.moveTo(hx - 12 * heartScale, hy + 3);
    cCtx.lineTo(hx + 12 * heartScale, hy + 3);
    cCtx.lineTo(hx, hy + 16 * heartScale);
    cCtx.fill();

    // El ele tutuşan karakterler
    drawPixelChar(cCtx, 65, 45, false, coupleFrame);
    drawPixelChar(cCtx, 95, 45, true, coupleFrame + 10);

    // El ele tutuşma detayı
    cCtx.fillStyle = '#ffdbac';
    cCtx.fillRect(78, 60, 18, 3);

    coupleFrame++;
    requestAnimationFrame(animateCouple);
}

// ==========================================
// ARAYÜZ VE ÇOK ADIMLI DİYALOG AKIŞI
// ==========================================
const startOverlay = document.getElementById('startOverlay');
const btnStartGame = document.getElementById('btnStartGame');
const interactionBox = document.getElementById('interactionBox');
const dialogSpeaker = document.getElementById('dialogSpeaker');
const dialogBody = document.getElementById('dialogBody');
const dialogIcon = document.getElementById('dialogIcon');
const btnDialogNext = document.getElementById('btnDialogNext');
const btnDialogNextText = document.getElementById('btnDialogNextText');

const letterModal = document.getElementById('letterModal');
const celebrationModal = document.getElementById('celebrationModal');
const btnYes = document.getElementById('btnYes');
const btnNo = document.getElementById('btnNo');
const proposalArena = document.getElementById('proposalArena');

// Başlat Butonuna Basınca Animasyon Başlasın
btnStartGame.addEventListener('click', () => {
    startOverlay.style.opacity = '0';
    setTimeout(() => {
        startOverlay.classList.add('hidden');
        sceneState = 'VAN_DRIVING_IN';
    }, 400);
});

// Aşamalı İnteraktif Diyaloglar
const dialogSteps = [
    {
        speaker: 'Pelican Town Postacısı',
        icon: '👨‍✈️',
        text: 'İyi günler! Çiftliğe çok özel, mühürlü bir teslimat bıraktım. Sahibi için çok önemli görünüyor!',
        btnText: 'Yaklaş ve Bak ▶'
    },
    {
        speaker: 'Sen',
        icon: '🌸',
        text: 'Posta kutusunun sarı bayrağı kalkmış... Üzerinde kalp şeklinde parıldayan kırmızı bir mühür var!',
        btnText: 'Mektubu İncele ▶'
    },
    {
        speaker: 'Gizemli Zarf',
        icon: '💌',
        text: 'Bu mektup sıradan bir fatura ya da tohum kataloğu değil...<br><span class="highlight-q">Zarfı açıp içindeki duyguları okumak ister misin?</span>',
        btnText: '💌 Evet, Zarfı Aç!'
    }
];

let currentDialogIndex = 0;

function startDialogFlow() {
    currentDialogIndex = 0;
    updateDialogContent();
    interactionBox.classList.remove('hidden');
}

function updateDialogContent() {
    const d = dialogSteps[currentDialogIndex];
    dialogSpeaker.innerText = d.speaker;
    dialogIcon.innerText = d.icon;
    dialogBody.innerHTML = d.text;
    btnDialogNextText.innerText = d.btnText;
}

btnDialogNext.addEventListener('click', () => {
    currentDialogIndex++;
    if (currentDialogIndex < dialogSteps.length) {
        updateDialogContent();
    } else {
        // Son adım: Zarfı aç
        interactionBox.classList.add('hidden');
        letterModal.classList.remove('hidden');
    }
});

// 2. Kaçan "Hayır" Butonu Mantığı
let noEscapeCount = 0;
const funnyNoTexts = [
    'Hayır mı? Emin misin? 🥺',
    'Bence yanlış tıkladın! 🙈',
    'I-ıh, yakalayamazsın ki! 🏃‍♂️',
    'Lütfen bir daha düşün... 💕',
    'Kaçtım bileee! 💨',
    'Kalbim kırılır ama... 💔',
    'Hadi ama Evet de! ✨'
];

function moveNoButton() {
    noEscapeCount++;

    // Butonun metnini değiştir
    btnNo.innerText = funnyNoTexts[noEscapeCount % funnyNoTexts.length];

    // Butonu Evet butonunun üstüne binmeyecek şekilde güvenli alanlara kaçır
    // Yön alternatifleri (sağa, sola, yukarı, çapraza)
    const offsets = [
        { x: 130, y: -30 },
        { x: -140, y: 35 },
        { x: 120, y: 40 },
        { x: -150, y: -25 },
        { x: 100, y: -45 },
        { x: -120, y: 45 }
    ];

    const currentOffset = offsets[noEscapeCount % offsets.length];
    
    // Transform ile kaydırarak Evet butonunun üstüne çakışmasını engelliyoruz
    btnNo.style.transform = `translate(${currentOffset.x}px, ${currentOffset.y}px)`;

    // "Evet" butonunu daha cazip ve büyük yap
    const currentScale = 1 + (noEscapeCount * 0.06);
    btnYes.style.transform = `scale(${Math.min(currentScale, 1.45)})`;
}

btnNo.addEventListener('mouseenter', moveNoButton);
btnNo.addEventListener('click', (e) => {
    e.preventDefault();
    moveNoButton();
});
// Dokunmatik cihazlar için
btnNo.addEventListener('touchstart', (e) => {
    e.preventDefault();
    moveNoButton();
});

// 3. "Evet" Butonuna Basıldığında
btnYes.addEventListener('click', () => {
    letterModal.classList.add('hidden');
    celebrationModal.classList.remove('hidden');
    animateCouple();
    spawnCelebrationConfetti();
});

// Konfeti ve kalp yağmuru efekti
function spawnCelebrationConfetti() {
    const container = document.getElementById('heart-container');
    const symbols = ['💖', '🌸', '✨', '♥', '🎉', '💍', '💐'];

    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const drop = document.createElement('div');
            drop.className = 'floating-heart';
            drop.innerText = symbols[Math.floor(Math.random() * symbols.length)];
            drop.style.left = Math.random() * 100 + 'vw';
            drop.style.animationDuration = (3 + Math.random() * 3) + 's';
            drop.style.fontSize = (16 + Math.random() * 16) + 'px';
            container.appendChild(drop);

            setTimeout(() => drop.remove(), 6000);
        }, i * 100);
    }
}

// Arka plan süzülen kalpleri
function initBackgroundHearts() {
    const container = document.getElementById('heart-container');
    const heartIcons = ['♥', '♡', '✦', '🌸'];

    setInterval(() => {
        if (document.hidden) return;
        const heart = document.createElement('div');
        heart.className = 'floating-heart';
        heart.innerText = heartIcons[Math.floor(Math.random() * heartIcons.length)];
        heart.style.left = Math.random() * 100 + 'vw';
        heart.style.animationDuration = (6 + Math.random() * 4) + 's';
        heart.style.fontSize = (12 + Math.random() * 10) + 'px';
        container.appendChild(heart);

        setTimeout(() => heart.remove(), 9000);
    }, 500);
}

// Başlat
initBackgroundHearts();
render();
