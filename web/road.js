// ======================================================
// 🐔 CHICKEN ROAD / OTOYOL CLIENT ENGINE
// ======================================================

const ROAD_PRESETS_CLIENT = {
    easy: {
        multipliers: [1.15, 1.35, 1.62, 1.95, 2.38, 2.95, 3.75, 4.90]
    },
    medium: {
        multipliers: [1.28, 1.70, 2.28, 3.10, 4.25, 6.00, 8.80, 13.50]
    },
    hard: {
        multipliers: [1.55, 2.50, 4.10, 6.80, 11.50, 20.00, 36.00, 68.00]
    }
};

let currentRoadDifficulty = 'medium';
let isRoadGameActive = false;
let currentRoadStep = 0; // 0 = başlangıç kaldırımı, 1-8 = şeritler
let currentRoadBet = 100;
let roadMultipliers = ROAD_PRESETS_CLIENT.medium.multipliers;
let roadOverlayTimeout = null;

// Modal Aç / Kapa
function openRoadModal() {
    const modal = document.getElementById('roadModal');
    if (modal) {
        modal.classList.add('active');
        if (!isRoadGameActive) {
            renderHighwayBoard();
            updateRoadUI();
        }
    }
}

function closeRoadModal() {
    if (isRoadGameActive) {
        if (!confirm('Oyundan çıkarsanız mevcut yol bahsiniz kaybolur. Çıkmak istiyor musunuz?')) {
            return;
        }
    }
    const modal = document.getElementById('roadModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Zorluk Değiştir
function setRoadDifficulty(diff) {
    if (isRoadGameActive) return;
    currentRoadDifficulty = diff;

    document.querySelectorAll('.road-diff-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-diff') === diff);
    });

    roadMultipliers = ROAD_PRESETS_CLIENT[diff].multipliers;
    renderHighwayBoard();
    updateRoadUI();
}

// Bahis Preseti
function setRoadBetPreset(action) {
    if (isRoadGameActive) return;
    const input = document.getElementById('roadBetInput');
    if (!input) return;

    let val = parseInt(input.value, 10) || 100;

    if (action === 'half') val = Math.max(10, Math.floor(val / 2));
    else if (action === 'double') val = val * 2;
    else if (action === 'max') {
        const balanceEl = document.querySelector('.modal-live-balance');
        if (balanceEl) {
            const raw = parseInt(balanceEl.textContent.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(raw) && raw > 0) val = raw;
        }
    }

    input.value = val;
    updateRoadUI();
}

// Arayüz & Çarpanları Güncelle
function updateRoadUI() {
    const curMultEl = document.getElementById('roadCurrentMult');
    const nextMultEl = document.getElementById('roadNextMult');
    const cashoutValEl = document.getElementById('roadCashoutValue');
    const btnStart = document.getElementById('btnRoadStart');
    const btnStep = document.getElementById('btnRoadStep');
    const btnCashout = document.getElementById('btnRoadCashout');

    const betInput = document.getElementById('roadBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10) || 100;
    currentRoadBet = bet;

    if (!isRoadGameActive) {
        if (curMultEl) curMultEl.textContent = '1.00x';
        if (nextMultEl) nextMultEl.textContent = `${roadMultipliers[0].toFixed(2)}x`;
        if (cashoutValEl) cashoutValEl.textContent = '0 🪙';

        if (btnStart) {
            btnStart.style.display = 'flex';
            btnStart.disabled = false;
        }
        if (btnStep) btnStep.style.display = 'none';
        if (btnCashout) btnCashout.style.display = 'none';
    } else {
        const curMult = currentRoadStep > 0 ? roadMultipliers[currentRoadStep - 1] : 1.00;
        const nextMult = currentRoadStep < 8 ? roadMultipliers[currentRoadStep] : roadMultipliers[7];
        const cashoutVal = Math.floor(bet * curMult);

        if (curMultEl) curMultEl.textContent = `${curMult.toFixed(2)}x`;
        if (nextMultEl) nextMultEl.textContent = currentRoadStep < 8 ? `${nextMult.toFixed(2)}x` : 'BİTİŞ';
        if (cashoutValEl) cashoutValEl.textContent = `${cashoutVal.toLocaleString()} 🪙`;

        if (btnStart) btnStart.style.display = 'none';
        if (btnStep) {
            btnStep.style.display = 'flex';
            btnStep.disabled = false;
        }
        if (btnCashout) {
            btnCashout.style.display = 'flex';
            btnCashout.disabled = currentRoadStep === 0;
            btnCashout.innerHTML = `<i class="fa-solid fa-hand-holding-dollar"></i> <span>ÇEK: ${cashoutVal.toLocaleString()} 🪙</span>`;
        }
    }
}

// Otoyol Tahtasını Render Et (8 Şerit)
function renderHighwayBoard() {
    const lanesContainer = document.getElementById('highwayLanes');
    if (!lanesContainer) return;
    lanesContainer.innerHTML = '';

    for (let l = 0; l < 8; l++) {
        const lane = document.createElement('div');
        lane.className = 'highway-lane';
        lane.id = `roadLane_${l}`;

        if (isRoadGameActive) {
            if (l === currentRoadStep) lane.classList.add('active-lane');
            else if (l < currentRoadStep) lane.classList.add('cleared-lane');
        }

        // Üst Çarpan Rozeti
        const multBadge = document.createElement('div');
        multBadge.className = 'lane-mult-badge';
        multBadge.textContent = `${roadMultipliers[l].toFixed(2)}x`;
        lane.appendChild(multBadge);

        // Orta Hedef Rögarı
        const target = document.createElement('div');
        target.className = 'lane-step-target';
        target.innerHTML = `<i class="fa-solid fa-shoe-prints"></i>`;
        lane.appendChild(target);

        // Alt Boşluk
        const spacer = document.createElement('div');
        spacer.style.height = '16px';
        lane.appendChild(spacer);

        lanesContainer.appendChild(lane);
    }

    // Karakteri Başlangıç Kaldırımına Konumlandır
    positionChickenActor(currentRoadStep);
}

// Karakterin Konumunu Ayarla
function positionChickenActor(step) {
    const chicken = document.getElementById('chickenActor');
    if (!chicken) return;

    chicken.className = 'chicken-actor';

    if (step === 0) {
        chicken.style.left = '8px'; // Sol kaldırım
    } else {
        const targetLane = document.getElementById(`roadLane_${step - 1}`);
        if (targetLane) {
            const laneRect = targetLane.getBoundingClientRect();
            const wrapperRect = document.getElementById('highwayWrapper').getBoundingClientRect();
            const centerLeft = (laneRect.left - wrapperRect.left) + (laneRect.width / 2) - 22;
            chicken.style.left = `${centerLeft}px`;
        }
    }
}

// Oyunu Başlat
async function handleRoadStart() {
    const betInput = document.getElementById('roadBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10);

    if (isNaN(bet) || bet < 10) {
        showRoadModalNotice('Minimum bahis 10 🪙 olmalıdır!', 'lose');
        return;
    }

    const btnStart = document.getElementById('btnRoadStart');
    if (btnStart) btnStart.disabled = true;

    try {
        const res = await fetch('/api/road/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bet,
                difficulty: currentRoadDifficulty
            })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showRoadModalNotice(data.error || 'Oyun başlatılamadı!', 'lose');
            if (btnStart) btnStart.disabled = false;
            return;
        }

        // Bakiye güncelle
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        isRoadGameActive = true;
        currentRoadStep = 0;
        currentRoadBet = bet;
        roadMultipliers = data.multipliers;

        renderHighwayBoard();
        updateRoadUI();
        showRoadModalNotice('Yola adım atın! Arabalara dikkat edin.', 'info');

    } catch (err) {
        console.error('Road start error:', err);
        showRoadModalNotice('Sunucu ile bağlantı kurulamadı!', 'lose');
        if (btnStart) btnStart.disabled = false;
    }
}

// Şeritte İlerle (Zıpla)
async function handleRoadStep() {
    if (!isRoadGameActive) return;

    const btnStep = document.getElementById('btnRoadStep');
    if (btnStep) btnStep.disabled = true;

    const chicken = document.getElementById('chickenActor');
    if (chicken) chicken.classList.add('hop');

    try {
        const res = await fetch('/api/road/step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showRoadModalNotice(data.error || 'İlerleme başarısız!', 'lose');
            if (btnStep) btnStep.disabled = false;
            if (chicken) chicken.classList.remove('hop');
            return;
        }

        const targetLaneIndex = currentRoadStep; // Hedeflenen şerit

        if (data.crashed) {
            // 💥 ARABA ÇARPTI!
            isRoadGameActive = false;
            positionChickenActor(targetLaneIndex + 1);

            // Kaza animasyonu
            setTimeout(() => {
                spawnCrashingCar(targetLaneIndex);
                if (chicken) chicken.className = 'chicken-actor splat';
            }, 100);

            if (typeof updateGlobalBalance === 'function') {
                updateGlobalBalance(data.yeniBakiye);
            }

            updateRoadUI();
            setTimeout(() => {
                showRoadModalNotice('💥 Kaza yaptınız! Araç çarptı.', 'lose');
            }, 450);
            return;
        }

        // 🟢 GÜVENLİ ZILAYIŞ!
        currentRoadStep = data.currentStep;
        positionChickenActor(currentRoadStep);

        const currentLaneEl = document.getElementById(`roadLane_${targetLaneIndex}`);
        if (currentLaneEl) {
            currentLaneEl.classList.remove('active-lane');
            currentLaneEl.classList.add('cleared-lane');
        }

        const nextLaneEl = document.getElementById(`roadLane_${currentRoadStep}`);
        if (nextLaneEl) {
            nextLaneEl.classList.add('active-lane');
        }

        if (data.isFinished) {
            // 🏆 KARŞI KALDIRIMA ULAŞTI!
            isRoadGameActive = false;
            if (typeof updateGlobalBalance === 'function') {
                updateGlobalBalance(data.yeniBakiye);
            }
            updateRoadUI();
            showRoadModalNotice(`🏆 TEBRİKLER! Karşı kaldırıma geçtiniz: +${data.kazanc.toLocaleString()} 🪙`, 'win');
            return;
        }

        updateRoadUI();

    } catch (err) {
        console.error('Road step error:', err);
        showRoadModalNotice('Bağlantı hatası oluştu!', 'lose');
    } finally {
        if (btnStep && isRoadGameActive) btnStep.disabled = false;
    }
}

// Parayı Çek (Cashout)
async function handleRoadCashout() {
    if (!isRoadGameActive || currentRoadStep === 0) return;

    const btnCashout = document.getElementById('btnRoadCashout');
    if (btnCashout) btnCashout.disabled = true;

    try {
        const res = await fetch('/api/road/cashout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showRoadModalNotice(data.error || 'Çekim başarısız!', 'lose');
            if (btnCashout) btnCashout.disabled = false;
            return;
        }

        isRoadGameActive = false;
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        updateRoadUI();
        showRoadModalNotice(`💰 Kazanç Çekildi: +${data.kazanc.toLocaleString()} 🪙 (${data.multiplier.toFixed(2)}x)`, 'win');

    } catch (err) {
        console.error('Road cashout error:', err);
        showRoadModalNotice('Bağlantı hatası!', 'lose');
        if (btnCashout) btnCashout.disabled = false;
    }
}

// Çarpan Arabayı Yarat & Kaza Efekti Patlat
function spawnCrashingCar(laneIndex) {
    const lane = document.getElementById(`roadLane_${laneIndex}`);
    const wrapper = document.getElementById('highwayWrapper');
    if (!lane) return;

    lane.classList.add('crashed-lane');

    // Tüm otoyolu sars
    if (wrapper) {
        wrapper.classList.add('shake');
        setTimeout(() => wrapper.classList.remove('shake'), 450);
    }

    // Yukarıdan hızla inen kırmızı kamyon
    const car = document.createElement('div');
    car.className = 'car-obstacle hit-car';
    car.innerHTML = '<i class="fa-solid fa-truck-moving"></i>';
    lane.appendChild(car);

    // Patlama & Kıvılcım Duman Dairesi
    const burst = document.createElement('div');
    burst.className = 'crash-burst-fx';
    lane.appendChild(burst);
}

// Modal İçi Bildirim Rozeti
function showRoadModalNotice(message, type = 'info') {
    const overlay = document.getElementById('roadResultOverlay');
    if (!overlay) return;

    if (roadOverlayTimeout) clearTimeout(roadOverlayTimeout);

    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'lose') icon = '<i class="fa-solid fa-car-burst"></i>';
    else if (type === 'win') icon = '<i class="fa-solid fa-trophy"></i>';

    overlay.className = `road-result-overlay active ${type}`;
    overlay.innerHTML = `${icon} <span>${message}</span>`;

    roadOverlayTimeout = setTimeout(() => {
        overlay.classList.remove('active');
    }, 4000);
}
