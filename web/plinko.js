// ======================================================
// 🟢 PLINKO FİZİK MOTORU & CANVAS İSTEMCİSİ
// ======================================================

const PLINKO_CONFIG = {
    rows: 12,
    pinRadius: 3.5,
    ballRadius: 6,
    multipliers: {
        low:    [10, 3, 1.6, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.6, 3, 10],
        medium: [25, 8, 3.2, 1.6, 1.1, 0.6, 0.4, 0.6, 1.1, 1.6, 3.2, 8, 25],
        high:   [110, 42, 10, 4, 1.4, 0.2, 0.2, 0.2, 1.4, 4, 10, 42, 110]
    }
};

let currentPlinkoRisk = 'medium';
let plinkoCanvas, plinkoCtx;
let plinkoPins = [];
let plinkoBalls = [];
let plinkoAnimFrame = null;
let plinkoActiveDrops = 0;

function openPlinkoModal() {
    const modal = document.getElementById('plinkoModal');
    if (modal) {
        modal.classList.add('active');
        initPlinkoCanvas();
        renderBuckets();
    }
}

function closePlinkoModal() {
    const modal = document.getElementById('plinkoModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function setPlinkoRisk(risk) {
    currentPlinkoRisk = risk;
    document.querySelectorAll('.btn-risk').forEach(b => {
        b.classList.toggle('active', b.dataset.risk === risk);
    });
    renderBuckets();
}

function setPlinkoQuickBet(val) {
    const input = document.getElementById('plinkoBetInput');
    if (!input) return;
    if (val === '2x') {
        input.value = Math.max(10, parseInt(input.value || 100) * 2);
    } else if (val === '1/2') {
        input.value = Math.max(10, Math.floor(parseInt(input.value || 100) / 2));
    } else {
        input.value = val;
    }
}

function getBucketColor(mult) {
    if (mult >= 25) return '#f43f5e';
    if (mult >= 5)  return '#fb923c';
    if (mult >= 2)  return '#fbbf24';
    if (mult >= 1)  return '#a3e635';
    return '#38bdf8';
}

function renderBuckets() {
    const container = document.getElementById('plinkoBucketsRow');
    if (!container) return;

    const list = PLINKO_CONFIG.multipliers[currentPlinkoRisk];
    container.innerHTML = list.map((m, idx) => {
        const bg = getBucketColor(m);
        return `<div class="plinko-bucket" id="pBucket_${idx}" style="background: ${bg};" data-mult="${m}">${m}x</div>`;
    }).join('');
}

// Canvas & Pin Piramidi Hesaplamaları
function initPlinkoCanvas() {
    plinkoCanvas = document.getElementById('plinkoCanvas');
    if (!plinkoCanvas) return;
    plinkoCtx = plinkoCanvas.getContext('2d');

    const containerWidth = plinkoCanvas.parentElement.clientWidth || 360;
    const isMobile = window.innerWidth <= 840;
    const width = Math.min(560, Math.max(300, containerWidth - 20));
    const height = isMobile ? 260 : 420;

    plinkoCanvas.width = width;
    plinkoCanvas.height = height;

    calculatePins(width, height);
    if (!plinkoAnimFrame) {
        plinkoAnimFrame = requestAnimationFrame(runPlinkoLoop);
    }
}

// Bilye Bırakma API Çağrısı
async function handlePlinkoDrop() {
    const input = document.getElementById('plinkoBetInput');
    const bet = parseInt(input.value) || 100;
    const dropBtn = document.getElementById('btnPlinkoDrop');

    try {
        const res = await fetch('/api/plinko/drop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet, risk: currentPlinkoRisk })
        });
        
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseErr) {
            console.error('Sunucu yanıtı:', text);
            alert('Sunucu hatası! Lütfen sayfayı yenileyin veya botu kontrol edin.');
            return;
        }

        if (!data.success) {
            alert(data.error || 'Bilye bırakılamadı!');
            return;
        }

        // Bahis anında sadece yatırılan bahis kadar düşür (Kovaya düşene kadar kazancı ekleme!)
        const temporaryBalance = data.yeniBakiye - data.kazanc;
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(temporaryBalance);
        } else {
            const navBal = document.getElementById('navBalance');
            if (navBal) navBal.innerText = temporaryBalance.toLocaleString();
        }

        // Bilye simülasyonunu canvas'a ekle (Bilye hedefine varınca asıl yeni bakiye yansıtılacak)
        spawnPlinkoBall(data.path, data.bucketIndex, data.multiplier, data.kazanc, data.yeniBakiye);

    } catch (e) {
        console.error('Plinko drop hatası:', e);
    }
}

// Canvas Bilye Yolu Hesaplama ve Hareket
function spawnPlinkoBall(path, targetBucket, multiplier, winAmount, finalBalance) {
    if (!plinkoPins.length) return;

    const rows = PLINKO_CONFIG.rows;
    const targetPins = [];
    let curCol = 1;

    for (let r = 0; r < rows; r++) {
        const rowPins = plinkoPins.filter(p => p.rowIndex === r);
        const chosenPin = rowPins[curCol] || rowPins[rowPins.length - 1];
        if (chosenPin) targetPins.push(chosenPin);

        if (path[r] === 1) {
            curCol++;
        }
    }

    const startX = plinkoCanvas.width / 2;
    const startY = 10;

    plinkoBalls.push({
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        targetPins,
        currentStep: 0,
        targetBucket,
        multiplier,
        winAmount,
        finalBalance,
        color: '#10b981'
    });
}

function calculatePins(w, h) {
    plinkoPins = [];
    const rows = PLINKO_CONFIG.rows;
    const startY = 40;
    const endY = h - 30;
    const ySpacing = (endY - startY) / (rows - 1);

    for (let r = 0; r < rows; r++) {
        const pinsInRow = r + 3;
        const rowWidth = (pinsInRow - 1) * (w / (rows + 3));
        const startX = (w - rowWidth) / 2;
        const xSpacing = rowWidth / (pinsInRow - 1);

        for (let c = 0; c < pinsInRow; c++) {
            plinkoPins.push({
                x: startX + c * xSpacing,
                y: startY + r * ySpacing,
                r: PLINKO_CONFIG.pinRadius,
                rowIndex: r,
                colIndex: c,
                hitAlpha: 0
            });
        }
    }
}

// Canlı Animasyon Döngüsü
function runPlinkoLoop() {
    if (!plinkoCtx || !plinkoCanvas) return;

    const w = plinkoCanvas.width;
    const h = plinkoCanvas.height;
    plinkoCtx.clearRect(0, 0, w, h);

    // Çarpışma Kontrolü: Herhangi bir bilye herhangi bir pine yeterince yakınsa parlat
    plinkoPins.forEach(pin => {
        // Bilyelerin bu pine olan mesafesi
        for (let j = 0; j < plinkoBalls.length; j++) {
            const b = plinkoBalls[j];
            const dist = Math.hypot(pin.x - b.x, pin.y - b.y);
            if (dist < (pin.r + PLINKO_CONFIG.ballRadius + 5)) {
                pin.hitAlpha = 1.0;
            }
        }

        plinkoCtx.save();
        plinkoCtx.beginPath();
        plinkoCtx.arc(pin.x, pin.y, pin.r, 0, Math.PI * 2);
        
        if (pin.hitAlpha > 0) {
            plinkoCtx.fillStyle = '#34d399';
            plinkoCtx.shadowBlur = 14;
            plinkoCtx.shadowColor = '#10b981';
            pin.hitAlpha -= 0.05;
        } else {
            plinkoCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            plinkoCtx.shadowBlur = 0;
        }
        
        plinkoCtx.fill();
        plinkoCtx.restore();
    });

    // Bilyeleri Güncelle ve Çiz
    for (let i = plinkoBalls.length - 1; i >= 0; i--) {
        const b = plinkoBalls[i];

        if (b.currentStep < b.targetPins.length) {
            const target = b.targetPins[b.currentStep];
            const dx = target.x - b.x;
            const dy = target.y - b.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 10) {
                target.hitAlpha = 1.0;
                b.currentStep++;
                // Çarpma efekti (hafif sekme)
                b.x += (Math.random() - 0.5) * 4;
            } else {
                b.x += dx * 0.18;
                b.y += Math.max(3.5, dy * 0.18);
            }
        } else {
            // Kovaya doğru düşüş
            b.y += 6.5;
            if (b.y >= h - 10) {
                // Kovaya tam girdiği an kazancı bakiyeye ekle ve parlat!
                highlightBucket(b.targetBucket, b.multiplier, b.winAmount);
                if (typeof updateGlobalBalance === 'function' && b.finalBalance !== undefined) {
                    updateGlobalBalance(b.finalBalance);
                }
                plinkoBalls.splice(i, 1);
                continue;
            }
        }

        // Bilyeyi Çiz (Parlak Neon Glow)
        plinkoCtx.save();
        plinkoCtx.beginPath();
        plinkoCtx.arc(b.x, b.y, PLINKO_CONFIG.ballRadius, 0, Math.PI * 2);
        plinkoCtx.fillStyle = '#34d399';
        plinkoCtx.shadowBlur = 15;
        plinkoCtx.shadowColor = 'rgba(52, 211, 153, 0.95)';
        plinkoCtx.fill();
        plinkoCtx.restore();
    }

    plinkoAnimFrame = requestAnimationFrame(runPlinkoLoop);
}

// Kovaya Giriş Parlama & Rozet Ekleme
function highlightBucket(bucketIdx, mult, winAmount) {
    const el = document.getElementById(`pBucket_${bucketIdx}`);
    if (el) {
        el.classList.add('hit');
        setTimeout(() => el.classList.remove('hit'), 400);
    }

    const recentArea = document.getElementById('plinkoRecentWins');
    if (recentArea) {
        const badge = document.createElement('span');
        const color = getBucketColor(mult);
        badge.className = 'plinko-win-badge';
        badge.style.color = color;
        badge.style.borderColor = color;
        badge.innerText = `${mult}x`;
        recentArea.prepend(badge);
        if (recentArea.children.length > 8) {
            recentArea.removeChild(recentArea.lastChild);
        }
    }
}
