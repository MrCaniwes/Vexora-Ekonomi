// CRASH OYUNU İSTEMCİ YÖNETİCİSİ (CANVAS & API)
let crashState = {
    running: false,
    startTime: 0,
    targetCrashPoint: 0,
    currentMultiplier: 1.00,
    animationFrameId: null,
    betAmount: 100
};

function openCrashModal() {
    const modal = document.getElementById('crashModal');
    if (modal) {
        modal.classList.add('active');
        initCrashCanvas();
        fetchCrashHistory();
    }
}

function closeCrashModal() {
    if (crashState.running) {
        if (!confirm('Devam eden bir oyununuz var! Çıkarsanız bahsiniz yanabilir. Kapatmak istiyor musunuz?')) {
            return;
        }
    }
    const modal = document.getElementById('crashModal');
    if (modal) {
        modal.classList.remove('active');
        resetCrashGame();
    }
}

function setQuickBet(val) {
    const input = document.getElementById('crashBetInput');
    if (!input) return;
    if (val === '2x') {
        input.value = Math.max(10, parseInt(input.value || 100) * 2);
    } else if (val === '1/2') {
        input.value = Math.max(10, Math.floor(parseInt(input.value || 100) / 2));
    } else {
        input.value = val;
    }
}

// Canvas & Çizim Motoru
let canvas, ctx;
function initCrashCanvas() {
    canvas = document.getElementById('crashCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    drawCrashScene(1.00, false);
}

function drawCrashScene(multiplier, crashed) {
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Eksen Çizgileri ve Izgara
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = 0; y < h; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    if (!crashState.running && !crashed) {
        return;
    }

    // Roket Yükselme Eğrisi (Daha dik ve dinamik)
    const progress = Math.min(1, (multiplier - 1) / 7); 
    const startX = 50;
    const startY = h - 50;
    const endX = startX + (w - 120) * Math.min(1, (multiplier - 1) / 4);
    const endY = startY - (h - 120) * progress;

    // Neon Çizgi & Glow Efekti
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = crashed ? 'rgba(244, 63, 94, 0.8)' : 'rgba(16, 185, 129, 0.8)';

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo((startX + endX) / 2, startY, endX, endY);
    ctx.strokeStyle = crashed ? '#f43f5e' : '#10b981';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Eğrinin altını degrade ile doldur
    const fillGrad = ctx.createLinearGradient(0, endY, 0, startY);
    fillGrad.addColorStop(0, crashed ? 'rgba(244, 63, 94, 0.18)' : 'rgba(16, 185, 129, 0.2)');
    fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.lineTo(endX, startY);
    ctx.lineTo(startX, startY);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Roket / Patlama İkonu
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (crashed) {
        ctx.fillText('💥', endX, endY);
    } else {
        ctx.fillText('🚀', endX, endY);
    }
}

// Oyunu Başlat veya Nakit Çek
async function handleCrashAction() {
    const btn = document.getElementById('btnCrashAction');
    const input = document.getElementById('crashBetInput');
    const multDisplay = document.getElementById('crashMultiplierText');
    const statusText = document.getElementById('crashStatusText');

    if (!crashState.running) {
        // Bahis Yap & Başlat
        const bahis = parseInt(input.value);
        if (!bahis || isNaN(bahis) || bahis <= 0) {
            alert('Lütfen geçerli bir bahis tutarı girin!');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span>BAŞLATILIYOR...</span>';

        try {
            const res = await fetch('/api/crash/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bahis })
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Oyun başlatılamadı!');
                resetCrashGame();
                return;
            }

            // Oyun Başladı
            crashState.running = true;
            crashState.startTime = Date.now();
            crashState.betAmount = bahis;
            crashState.targetCrashPoint = data.crashPoint;
            crashState.currentMultiplier = 1.00;

            if (data.yeniBakiye !== undefined) {
                if (typeof updateGlobalBalance === 'function') {
                    updateGlobalBalance(data.yeniBakiye);
                } else {
                    const navBal = document.getElementById('navBalance');
                    if (navBal) navBal.innerText = data.yeniBakiye.toLocaleString();
                }
            }

            input.disabled = true;
            multDisplay.classList.remove('crashed');
            statusText.innerText = 'Roket Yükseliyor...';

            btn.disabled = false;
            btn.className = 'btn-crash-main cashout';
            btn.innerHTML = `<span>NAKİT ÇEK</span><span style="font-size: 13px; font-weight: 700; opacity: 0.9;" id="cashoutAmountText">${bahis.toLocaleString()} 🪙</span>`;

            runCrashLoop();

        } catch (e) {
            console.error(e);
            alert('Sunucuyla bağlantı kurulamadı.');
            resetCrashGame();
        }

    } else {
        // Nakit Çek (Cashout) - Butona tıklandığı an oyun durdurulur (Race condition engeli)
        crashState.running = false;
        cancelAnimationFrame(crashState.animationFrameId);
        btn.disabled = true;

        try {
            const res = await fetch('/api/crash/cashout', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                // Kesin Kazandı
                multDisplay.innerText = `x${data.multiplier.toFixed(2)}`;
                multDisplay.classList.remove('crashed');
                statusText.innerHTML = `<span style="color: #34d399; font-weight: 800;">🎉 KAZANDIN! (+${data.kazanc.toLocaleString()} 🪙)</span>`;
                
                const navBal = document.getElementById('navBalance');
                if (navBal) navBal.innerText = data.yeniBakiye.toLocaleString();
                if (typeof updateGlobalBalance === 'function') {
                    updateGlobalBalance(data.yeniBakiye);
                }

                btn.className = 'btn-crash-main start';
                btn.innerHTML = '<span>KAZANDIN!</span>';

                drawCrashScene(data.multiplier, false);
                addCrashHistoryPill(data.multiplier, true);

                setTimeout(resetCrashGame, 3000);
            } else {
                // Sunucuya göre milisaniye farkıyla roket önce patlamış
                handleCrashExplosion(data.crashPoint || crashState.targetCrashPoint);
            }
        } catch (err) {
            console.error(err);
            resetCrashGame();
        }
    }
}

// Canlı Tırmanış Animasyon Döngüsü
function runCrashLoop() {
    if (!crashState.running) return;

    const elapsedSec = (Date.now() - crashState.startTime) / 1000;
    
    // Dengeli tırmanış
    const currentMult = Math.max(1.00, parseFloat((1 + 0.12 * Math.pow(elapsedSec, 1.2)).toFixed(2)));
    crashState.currentMultiplier = currentMult;

    // Hedef patlama noktasına ulaştı mı?
    if (currentMult >= crashState.targetCrashPoint) {
        handleCrashExplosion(crashState.targetCrashPoint);
        return;
    }

    const multDisplay = document.getElementById('crashMultiplierText');
    const cashoutText = document.getElementById('cashoutAmountText');
    if (multDisplay) multDisplay.innerText = `x${currentMult.toFixed(2)}`;
    if (cashoutText) {
        const potentialWin = Math.floor(crashState.betAmount * currentMult);
        cashoutText.innerText = `${potentialWin.toLocaleString()} 🪙`;
    }

    drawCrashScene(currentMult, false);

    crashState.animationFrameId = requestAnimationFrame(runCrashLoop);
}

// Patlama Anı
async function handleCrashExplosion(crashPoint) {
    crashState.running = false;
    cancelAnimationFrame(crashState.animationFrameId);

    const multDisplay = document.getElementById('crashMultiplierText');
    const statusText = document.getElementById('crashStatusText');
    const btn = document.getElementById('btnCrashAction');

    multDisplay.innerText = `x${crashPoint.toFixed(2)}`;
    multDisplay.classList.add('crashed');
    statusText.innerHTML = `<span style="color: #f43f5e; font-weight: 800;">💥 İNFİLAK ETTİ! (-${crashState.betAmount.toLocaleString()} 🪙)</span>`;

    btn.disabled = true;
    btn.className = 'btn-crash-main start';
    btn.innerHTML = '<span>PATLADI!</span>';

    drawCrashScene(crashPoint, true);
    addCrashHistoryPill(crashPoint, false);

    fetch('/api/crash/check', { method: 'POST' }).catch(() => {});

    setTimeout(resetCrashGame, 3000);
}

// Üstteki Geçmiş Çarpan Ticker'ına Hap Ekle
function addCrashHistoryPill(mult, won) {
    const bar = document.getElementById('crashHistoryBar');
    if (!bar) return;
    const pill = document.createElement('span');
    pill.className = `history-pill ${mult >= 10 ? 'gold' : (mult >= 2 ? 'green' : 'red')}`;
    pill.innerText = `${mult.toFixed(2)}x`;
    bar.prepend(pill);
    if (bar.children.length > 8) {
        bar.removeChild(bar.lastChild);
    }
}

// Sunucudan Gerçek Crash Geçmişini Çek ve Doldur
async function fetchCrashHistory() {
    try {
        const res = await fetch('/api/crash/history');
        const data = await res.json();
        if (data && data.history) {
            const bar = document.getElementById('crashHistoryBar');
            if (!bar) return;
            bar.innerHTML = '';
            // En güncel olanlar başta olacak şekilde son 8 veriyi göster
            data.history.slice(0, 8).forEach(item => {
                const mult = typeof item === 'object' ? item.mult : item;
                const pill = document.createElement('span');
                pill.className = `history-pill ${mult >= 10 ? 'gold' : (mult >= 2 ? 'green' : 'red')}`;
                pill.innerText = `${parseFloat(mult).toFixed(2)}x`;
                bar.appendChild(pill);
            });
        }
    } catch (e) {
        console.warn('Geçmiş yüklenemedi:', e);
    }
}

// Sayfa ilk yüklendiğinde geçmişi getir ve canlı polling başlat
let crashHistoryInterval = null;

function startHistoryPolling() {
    if (crashHistoryInterval) clearInterval(crashHistoryInterval);
    fetchCrashHistory();
    // Eğer oyun o an koşmuyorsa her 5 saniyede bir diğer oyuncuların turlarını da çekip tazele
    crashHistoryInterval = setInterval(() => {
        if (!crashState.running) {
            fetchCrashHistory();
        }
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    startHistoryPolling();
});

function resetCrashGame() {
    crashState.running = false;
    cancelAnimationFrame(crashState.animationFrameId);

    const btn = document.getElementById('btnCrashAction');
    const input = document.getElementById('crashBetInput');
    const multDisplay = document.getElementById('crashMultiplierText');
    const statusText = document.getElementById('crashStatusText');

    if (btn) {
        btn.disabled = false;
        btn.className = 'btn-crash-main start';
        btn.innerHTML = '<span>BAHİS YAP VE BAŞLAT</span>';
    }
    if (input) input.disabled = false;
    if (multDisplay) {
        multDisplay.innerText = '1.00x';
        multDisplay.classList.remove('crashed');
    }
    if (statusText) statusText.innerText = 'Bahsinizi yapın ve roket tırmanışını başlatın';

    drawCrashScene(1.00, false);
}
