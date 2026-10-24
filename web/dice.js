// ======================================================
// 🎲 CLASSIC DICE (ZAR KAYDIRICI) CLIENT ENGINE
// ======================================================

let diceMode = 'over'; // 'over' (üstü) veya 'under' (altı)
let diceTarget = 50.0;
let isDiceRolling = false;
let diceOverlayTimeout = null;

// Modal Aç / Kapa
function openDiceModal() {
    const modal = document.getElementById('diceModal');
    if (modal) {
        modal.classList.add('active');
        updateDiceUI();
    }
}

function closeDiceModal() {
    if (isDiceRolling) {
        alert('Zar atılırken pencereyi kapatamazsınız!');
        return;
    }
    const modal = document.getElementById('diceModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Mod Değiştir (Üstü / Altı)
function setDiceMode(mode) {
    if (isDiceRolling) return;
    diceMode = mode;

    document.querySelectorAll('.dice-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    updateDiceUI();
}

// Slider Değiştiğinde
function onDiceSliderChange() {
    if (isDiceRolling) return;
    const slider = document.getElementById('diceSlider');
    if (!slider) return;

    let val = parseFloat(slider.value);
    // Güvenlik sınırları: 15 ile 85 arası
    if (val < 15) val = 15;
    if (val > 85) val = 85;

    diceTarget = val;
    updateDiceUI();
}

// Arayüzü ve Oranları Hesapla / Güncelle
function updateDiceUI() {
    const slider = document.getElementById('diceSlider');
    const trackFill = document.getElementById('diceTrackFill');
    const thumb = document.getElementById('diceSliderThumb');
    const targetDisplay = document.getElementById('diceTargetVal');
    const winChanceDisplay = document.getElementById('diceWinChance');
    const multiplierDisplay = document.getElementById('diceMultiplier');
    const profitDisplay = document.getElementById('diceProfitVal');

    if (slider) slider.value = diceTarget;

    // Track boyaması ve Thumb konumu (0'dan 100'e tam kenarlara oturur)
    if (trackFill) {
        if (diceMode === 'over') {
            trackFill.className = 'dice-track-fill over';
            trackFill.style.width = `${diceTarget}%`;
        } else {
            trackFill.className = 'dice-track-fill under';
            trackFill.style.width = `${100 - diceTarget}%`;
        }
    }

    if (thumb) {
        thumb.style.left = `${diceTarget}%`;
    }

    // Kazanma Şansı ve Çarpan
    const winChance = diceMode === 'over' ? (100 - diceTarget) : diceTarget;
    const mult = parseFloat((99.0 / winChance).toFixed(4));

    const betInput = document.getElementById('diceBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10) || 100;
    const totalProfit = Math.floor(bet * mult);

    if (targetDisplay) targetDisplay.textContent = diceTarget.toFixed(2);
    if (winChanceDisplay) winChanceDisplay.textContent = `%${winChance.toFixed(2)}`;
    if (multiplierDisplay) multiplierDisplay.textContent = `${mult.toFixed(2)}x`;
    if (profitDisplay) profitDisplay.textContent = `${totalProfit.toLocaleString()} 🪙`;
}

// Bahis Değiştirme
function setDiceBetPreset(action) {
    if (isDiceRolling) return;
    const input = document.getElementById('diceBetInput');
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
    updateDiceUI();
}

function onDiceBetChange() {
    updateDiceUI();
}

// Zarı At
async function handleDiceRoll() {
    if (isDiceRolling) return;

    const betInput = document.getElementById('diceBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10);

    if (isNaN(bet) || bet < 10) {
        showDiceModalNotice('Minimum bahis 10 🪙 olmalıdır!', 'lose');
        return;
    }

    const rollBtn = document.getElementById('btnDiceRoll');
    const displayBox = document.getElementById('diceRollDisplay');
    const valText = document.getElementById('diceRollVal');

    if (rollBtn) rollBtn.disabled = true;
    isDiceRolling = true;

    if (displayBox) displayBox.className = 'dice-roll-display';

    // Zar sayacı dönme animasyonu
    let animCount = 0;
    const animInterval = setInterval(() => {
        if (valText) {
            valText.textContent = (Math.random() * 100).toFixed(2);
        }
        animCount++;
    }, 45);

    try {
        const res = await fetch('/api/dice/roll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bet,
                target: diceTarget,
                mode: diceMode
            })
        });

        const data = await res.json();
        clearInterval(animInterval);

        if (!res.ok || !data.success) {
            showDiceModalNotice(data.error || 'Zar atılamadı!', 'lose');
            if (rollBtn) rollBtn.disabled = false;
            isDiceRolling = false;
            return;
        }

        // Bakiye güncelle
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        // Gerçek sonucu ekrana bas
        if (valText) valText.textContent = data.roll.toFixed(2);

        if (data.isWin) {
            if (displayBox) displayBox.className = 'dice-roll-display win';
            showDiceModalNotice(`Kazandın! Sayı: ${data.roll} &bull; +${data.kazanc.toLocaleString()} 🪙 (${data.multiplier}x)`, 'win');
        } else {
            if (displayBox) displayBox.className = 'dice-roll-display lose';
            showDiceModalNotice(`Kaybettin! Gelen: ${data.roll} (Hedef: ${diceMode === 'over' ? '>' : '<'} ${data.target})`, 'lose');
        }

    } catch (err) {
        clearInterval(animInterval);
        console.error('Dice roll error:', err);
        showDiceModalNotice('Bağlantı hatası oluştu!', 'lose');
    } finally {
        isDiceRolling = false;
        if (rollBtn) rollBtn.disabled = false;
    }
}

// Modal İçi Bildirim Rozeti
function showDiceModalNotice(message, type = 'info') {
    const overlay = document.getElementById('diceResultOverlay');
    if (!overlay) return;

    if (diceOverlayTimeout) clearTimeout(diceOverlayTimeout);

    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'lose') icon = '<i class="fa-solid fa-dice-d6"></i>';
    else if (type === 'win') icon = '<i class="fa-solid fa-trophy"></i>';

    overlay.className = `dice-result-overlay active ${type}`;
    overlay.innerHTML = `${icon} <span>${message}</span>`;

    diceOverlayTimeout = setTimeout(() => {
        overlay.classList.remove('active');
    }, 4000);
}
