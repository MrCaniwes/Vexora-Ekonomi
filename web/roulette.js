// ======================================================
// 🔴 EUROPEAN ROULETTE (0 - 36 AVRUPA RULET MOTORU)
// ======================================================

const ROULETTE_NUMBERS_ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const ROULETTE_RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

let rouletteCanvas, rouletteCtx;
let currentRouletteRotation = 0;
let isRouletteSpinning = false;
let selectedChip = 100;

// Masadaki Aktif Bahisler
let activeRouletteBets = {
    red: 0, black: 0,
    odd: 0, even: 0,
    low: 0, high: 0,
    doz1: 0, doz2: 0, doz3: 0,
    numbers: {} // { '17': 100 }
};

function openRouletteModal() {
    const modal = document.getElementById('rouletteModal');
    if (modal) {
        modal.classList.add('active');
        initRouletteCanvas();
        renderRouletteBoard();
        fetchRouletteHistory();
        updateBoardDisplay();
    }
}

function closeRouletteModal() {
    if (isRouletteSpinning) {
        alert('Rulet dönerken pencereyi kapatamazsınız!');
        return;
    }
    const modal = document.getElementById('rouletteModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function selectChip(val) {
    selectedChip = val;
    document.querySelectorAll('.chip-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.chip) === val);
    });
}

function placeRouletteBet(type, target) {
    if (isRouletteSpinning) return;

    if (type === 'outside') {
        activeRouletteBets[target] = (activeRouletteBets[target] || 0) + selectedChip;
    } else if (type === 'number') {
        activeRouletteBets.numbers[target] = (activeRouletteBets.numbers[target] || 0) + selectedChip;
    }

    updateBoardDisplay();
}

function clearRouletteBets() {
    if (isRouletteSpinning) return;
    activeRouletteBets = {
        red: 0, black: 0,
        odd: 0, even: 0,
        low: 0, high: 0,
        doz1: 0, doz2: 0, doz3: 0,
        numbers: {}
    };
    updateBoardDisplay();
}

function updateBoardDisplay() {
    // Dış Bahis Fişleri
    ['red', 'black', 'odd', 'even', 'low', 'high', 'doz1', 'doz2', 'doz3'].forEach(k => {
        const el = document.getElementById(`rBet_${k}`);
        if (el) {
            const badge = el.querySelector('.tile-chip-badge');
            const amt = activeRouletteBets[k] || 0;
            if (amt > 0) {
                if (badge) badge.innerText = amt;
                else el.insertAdjacentHTML('beforeend', `<span class="tile-chip-badge">${amt}</span>`);
            } else if (badge) {
                badge.remove();
            }
        }
    });

    // Sayı Bahis Fişleri (0 - 36)
    for (let i = 0; i <= 36; i++) {
        const el = document.getElementById(`rNum_${i}`);
        if (el) {
            const badge = el.querySelector('.tile-chip-badge');
            const amt = activeRouletteBets.numbers[i] || 0;
            if (amt > 0) {
                if (badge) badge.innerText = amt;
                else el.insertAdjacentHTML('beforeend', `<span class="tile-chip-badge">${amt}</span>`);
            } else if (badge) {
                badge.remove();
            }
        }
    }

    // Toplam Bahis Göstergesi
    let total = 0;
    ['red', 'black', 'odd', 'even', 'low', 'high', 'doz1', 'doz2', 'doz3'].forEach(k => total += (activeRouletteBets[k] || 0));
    for (const n in activeRouletteBets.numbers) total += activeRouletteBets.numbers[n];

    const spinBtn = document.getElementById('btnRouletteSpin');
    if (spinBtn && !isRouletteSpinning) {
        spinBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>ÇEVİR (${total > 0 ? total.toLocaleString() + ' 🪙' : 'Bahis Yok'})</span>`;
    }
}

// 0-36 Sayı Masasını Oluştur
function renderRouletteBoard() {
    const grid = document.getElementById('rouletteNumbersGrid');
    if (!grid || grid.children.length > 0) return;

    // Rulet tablosu klasik 3 satır 12 sütundur
    // 1. satır: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
    // 2. satır: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
    // 3. satır: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
    const rows = [
        [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
        [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
        [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
    ];

    let html = '';
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 12; c++) {
            const num = rows[r][c];
            const isRed = ROULETTE_RED_SET.has(num);
            html += `
                <div class="board-tile ${isRed ? 'red' : 'black'}" id="rNum_${num}" onclick="placeRouletteBet('number', ${num})">
                    <span>${num}</span>
                </div>
            `;
        }
    }
    grid.innerHTML = html;
}

// Canvas Çizimi
function initRouletteCanvas() {
    rouletteCanvas = document.getElementById('rouletteCanvas');
    if (!rouletteCanvas) return;
    rouletteCtx = rouletteCanvas.getContext('2d');

    const size = 310;
    rouletteCanvas.width = size;
    rouletteCanvas.height = size;

    drawRouletteWheel();
}

function drawRouletteWheel() {
    if (!rouletteCtx || !rouletteCanvas) return;
    const w = rouletteCanvas.width;
    const h = rouletteCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 6;

    rouletteCtx.clearRect(0, 0, w, h);

    const count = ROULETTE_NUMBERS_ORDER.length; // 37
    const anglePerSeg = (2 * Math.PI) / count;

    for (let i = 0; i < count; i++) {
        const num = ROULETTE_NUMBERS_ORDER[i];
        const startAngle = i * anglePerSeg - Math.PI / 2;
        const endAngle = startAngle + anglePerSeg;

        rouletteCtx.beginPath();
        rouletteCtx.moveTo(cx, cy);
        rouletteCtx.arc(cx, cy, radius, startAngle, endAngle);
        rouletteCtx.closePath();

        if (num === 0) {
            rouletteCtx.fillStyle = '#10b981';
        } else if (ROULETTE_RED_SET.has(num)) {
            rouletteCtx.fillStyle = '#e11d48';
        } else {
            rouletteCtx.fillStyle = '#1e293b';
        }
        rouletteCtx.fill();

        rouletteCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        rouletteCtx.lineWidth = 1;
        rouletteCtx.stroke();

        // Sayı Metni
        rouletteCtx.save();
        rouletteCtx.translate(cx, cy);
        rouletteCtx.rotate(startAngle + anglePerSeg / 2);
        rouletteCtx.textAlign = 'right';
        rouletteCtx.fillStyle = '#fff';
        rouletteCtx.font = 'bold 9px Outfit, sans-serif';
        rouletteCtx.fillText(num.toString(), radius - 8, 3);
        rouletteCtx.restore();
    }

    // Altın Dış & İç Halka
    rouletteCtx.beginPath();
    rouletteCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
    rouletteCtx.strokeStyle = '#d97706';
    rouletteCtx.lineWidth = 4;
    rouletteCtx.stroke();
}

// Çevirme API İstek
async function handleRouletteSpin() {
    if (isRouletteSpinning) return;

    let total = 0;
    ['red', 'black', 'odd', 'even', 'low', 'high', 'doz1', 'doz2', 'doz3'].forEach(k => total += (activeRouletteBets[k] || 0));
    for (const n in activeRouletteBets.numbers) total += activeRouletteBets.numbers[n];

    if (total < 10) {
        alert('Lütfen masaya en az 10 🪙 değerinde fiş koyun!');
        return;
    }

    const spinBtn = document.getElementById('btnRouletteSpin');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<span>TOP DÖNÜYOR...</span>';
    isRouletteSpinning = true;

    try {
        const res = await fetch('/api/roulette/spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bets: activeRouletteBets })
        });

        const data = await res.json();
        if (!data.success) {
            alert(data.error || 'Bahis yapılamadı!');
            spinBtn.disabled = false;
            isRouletteSpinning = false;
            updateBoardDisplay();
            return;
        }

        // Bahis anında bakiyeden düş
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye - data.totalWin);
        }

        // Çark Rotasyon Açısını Merkezle
        const count = ROULETTE_NUMBERS_ORDER.length; // 37
        const segAngle = 360 / count; // ~9.7297°

        // Hedef sayının tam ortasını ibreye (0° tepeye) getiren açı
        const targetStopAngle = (360 - (data.wheelIndex * segAngle + segAngle / 2)) % 360;
        const currentMod = currentRouletteRotation % 360;
        let deltaAngle = targetStopAngle - currentMod;
        if (deltaAngle < 0) deltaAngle += 360;

        const totalSpinDelta = 360 * 7 + deltaAngle; // 7 tam tur
        currentRouletteRotation += totalSpinDelta;

        rouletteCanvas.style.transform = `rotate(${currentRouletteRotation}deg)`;

        // 5 saniye sonra bilye oturur
        setTimeout(() => {
            isRouletteSpinning = false;
            spinBtn.disabled = false;

            // Ortadaki hub göstergesini güncelle
            const hubText = document.getElementById('rouletteHubNumber');
            if (hubText) {
                hubText.innerText = data.winningNumber;
                hubText.style.color = data.winningColor === 'green' ? '#10b981' : (data.winningColor === 'red' ? '#fb7185' : '#cbd5e1');
            }

            // Nihai bakiyeyi güncelle
            if (typeof updateGlobalBalance === 'function') {
                updateGlobalBalance(data.yeniBakiye);
            }

            // Geçmişe ekle
            addRouletteHistoryPill(data.winningNumber, data.winningColor);

            // Şık sonuç rozeti
            showRouletteResult(data.winningNumber, data.winningColor, data.totalWin);

            updateBoardDisplay();

        }, 5100);

    } catch (e) {
        console.error('Roulette error:', e);
        isRouletteSpinning = false;
        spinBtn.disabled = false;
        updateBoardDisplay();
    }
}

function showRouletteResult(num, color, totalWin) {
    const overlay = document.getElementById('rouletteResultOverlay');
    if (!overlay) return;

    const colorTr = color === 'green' ? 'YEŞİL' : (color === 'red' ? 'KIRMIZI' : 'SİYAH');

    if (totalWin > 0) {
        overlay.className = 'wheel-result-overlay active win';
        overlay.innerHTML = `<span>🎉</span> <span>KAZANDIN! Sayı: ${num} (${colorTr}) &bull; <b>+${totalWin.toLocaleString()} 🪙</b></span>`;
    } else {
        overlay.className = 'wheel-result-overlay active lose';
        overlay.innerHTML = `<span>💥</span> <span>Sayı: ${num} (${colorTr}) &bull; Kazanç Yok</span>`;
    }

    setTimeout(() => {
        overlay.classList.remove('active');
    }, 4500);
}

function addRouletteHistoryPill(num, color) {
    const bar = document.getElementById('rouletteHistoryBar');
    if (!bar) return;
    const pill = document.createElement('span');
    pill.className = `roulette-history-pill ${color}`;
    pill.innerText = num;
    bar.prepend(pill);
    if (bar.children.length > 8) bar.removeChild(bar.lastChild);
}

async function fetchRouletteHistory() {
    try {
        const res = await fetch('/api/roulette/history');
        const data = await res.json();
        if (data && data.history) {
            const bar = document.getElementById('rouletteHistoryBar');
            if (!bar) return;
            bar.innerHTML = '';
            data.history.slice(0, 8).forEach(item => {
                const pill = document.createElement('span');
                pill.className = `roulette-history-pill ${item.color}`;
                pill.innerText = item.num;
                bar.appendChild(pill);
            });
        }
    } catch (e) {}
}
