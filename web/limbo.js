// ======================================================
// 🚀 LIMBO (HEDEF ÇARPAN AVCISI) CLIENT ENGINE
// ======================================================

let isLimboRolling = false;
let limboOverlayTimeout = null;

// Modal Aç / Kapa
function openLimboModal() {
    const modal = document.getElementById('limboModal');
    if (modal) {
        modal.classList.add('active');
        updateLimboUI();
    }
}

function closeLimboModal() {
    if (isLimboRolling) {
        alert('Hedef çarpan belirlenirken pencereyi kapatamazsınız!');
        return;
    }
    const modal = document.getElementById('limboModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Hedef Çarpan Preseti Seçme
function setLimboTargetPreset(target) {
    if (isLimboRolling) return;
    const targetInput = document.getElementById('limboTargetInput');
    if (targetInput) {
        targetInput.value = parseFloat(target).toFixed(2);
        updateLimboUI();
    }
}

// Bahis Preseti Seçme
function setLimboBetPreset(action) {
    if (isLimboRolling) return;
    const input = document.getElementById('limboBetInput');
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
    updateLimboUI();
}

// Arayüzü & Oranları Güncelle
function updateLimboUI() {
    const targetInput = document.getElementById('limboTargetInput');
    const targetVal = parseFloat(targetInput ? targetInput.value : 2.00) || 2.00;

    const betInput = document.getElementById('limboBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10) || 100;

    // Matematiksel Kazanma Olasılığı: (96 / Hedef) %
    const winChance = Math.min(95.0, Math.max(0.01, 96.0 / targetVal));
    const profit = Math.floor(bet * targetVal);

    const winChanceEl = document.getElementById('limboWinChance');
    const profitEl = document.getElementById('limboProfitVal');
    const targetBadgeVal = document.getElementById('limboTargetBadgeVal');

    if (winChanceEl) winChanceEl.textContent = `%${winChance.toFixed(2)}`;
    if (profitEl) profitEl.textContent = `${profit.toLocaleString()} 🪙`;
    if (targetBadgeVal) targetBadgeVal.textContent = `${targetVal.toFixed(2)}x`;
}

// Limbo Oyna (Ateşle)
async function handleLimboPlay() {
    if (isLimboRolling) return;

    const betInput = document.getElementById('limboBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10);

    const targetInput = document.getElementById('limboTargetInput');
    const target = parseFloat(targetInput ? targetInput.value : 2.00);

    if (isNaN(bet) || bet < 10) {
        showLimboModalNotice('Minimum bahis 10 🪙 olmalıdır!', 'lose');
        return;
    }

    if (isNaN(target) || target < 1.05 || target > 1000.00) {
        showLimboModalNotice('Hedef çarpan 1.05x ile 1000.00x arasında olmalıdır!', 'lose');
        return;
    }

    const playBtn = document.getElementById('btnLimboPlay');
    const displayBox = document.getElementById('limboMultiplierDisplay');
    const valText = document.getElementById('limboMultiplierVal');

    if (playBtn) playBtn.disabled = true;
    isLimboRolling = true;

    if (displayBox) displayBox.className = 'limbo-multiplier-display';

    // Hızlı tırmanış / roket animasyonu
    let animCount = 0;
    const animInterval = setInterval(() => {
        if (valText) {
            valText.textContent = (1.00 + Math.random() * (target * 1.5)).toFixed(2) + 'x';
        }
        animCount++;
    }, 40);

    try {
        const res = await fetch('/api/limbo/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bet,
                target
            })
        });

        const data = await res.json();
        clearInterval(animInterval);

        if (!res.ok || !data.success) {
            showLimboModalNotice(data.error || 'Oyun başlatılamadı!', 'lose');
            if (playBtn) playBtn.disabled = false;
            isLimboRolling = false;
            return;
        }

        // Bakiye güncelle
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        // Gerçek sonucu ekrana bas
        if (valText) valText.textContent = `${data.resultMultiplier.toFixed(2)}x`;

        if (data.isWin) {
            if (displayBox) displayBox.className = 'limbo-multiplier-display win';
            showLimboModalNotice(`Hedef Vuruldu! +${data.kazanc.toLocaleString()} 🪙 (${data.targetMultiplier}x)`, 'win');
        } else {
            if (displayBox) displayBox.className = 'limbo-multiplier-display lose';
            showLimboModalNotice(`Hedef Kaçtı! Çıkan: ${data.resultMultiplier.toFixed(2)}x`, 'lose');
        }

    } catch (err) {
        clearInterval(animInterval);
        console.error('Limbo error:', err);
        showLimboModalNotice('Bağlantı hatası oluştu!', 'lose');
    } finally {
        isLimboRolling = false;
        if (playBtn) playBtn.disabled = false;
    }
}

// Modal İçi Bildirim Rozeti
function showLimboModalNotice(message, type = 'info') {
    const overlay = document.getElementById('limboResultOverlay');
    if (!overlay) return;

    if (limboOverlayTimeout) clearTimeout(limboOverlayTimeout);

    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'lose') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    else if (type === 'win') icon = '<i class="fa-solid fa-trophy"></i>';

    overlay.className = `limbo-result-overlay active ${type}`;
    overlay.innerHTML = `${icon} <span>${message}</span>`;

    limboOverlayTimeout = setTimeout(() => {
        overlay.classList.remove('active');
    }, 4000);
}
