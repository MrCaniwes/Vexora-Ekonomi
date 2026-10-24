// ======================================================
// 🎱 KENO (ALTIN PİYANGO) CLIENT ENGINE
// ======================================================

const KENO_PAYOUTS_CLIENT = {
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

let kenoSelectedNumbers = [];
let isKenoDrawing = false;
let hasKenoDrawnOnce = false; // Çekiliş yapıldı mı takibi
let kenoOverlayTimeout = null;

// Modal Aç / Kapa
function openKenoModal() {
    const modal = document.getElementById('kenoModal');
    if (modal) {
        modal.classList.add('active');
        initKenoGrid();
        updateKenoUI();
    }
}

function closeKenoModal() {
    if (isKenoDrawing) {
        alert('Toplar çekilirken pencereyi kapatamazsınız!');
        return;
    }
    const modal = document.getElementById('kenoModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 1-40 Gridini Oluştur
function initKenoGrid() {
    const grid = document.getElementById('kenoGrid');
    if (!grid || grid.children.length === 40) return; // Zaten çizilmişse tekrar çizme
    grid.innerHTML = '';

    for (let num = 1; num <= 40; num++) {
        const cell = document.createElement('button');
        cell.className = 'keno-cell';
        cell.id = `kenoCell_${num}`;
        cell.textContent = num;
        cell.onclick = () => toggleKenoNumber(num);
        grid.appendChild(cell);
    }
}

// Numara Seç / Çıkar
function toggleKenoNumber(num) {
    if (isKenoDrawing) return;

    // Eğer çekiliş bittiyse ve kullanıcı yeni bir sayıya tıklıyorsa, eski kasanın çekim izlerini otomatik sıfırla
    if (hasKenoDrawnOnce) {
        resetKenoVisualEffects();
        hasKenoDrawnOnce = false;
    }

    const idx = kenoSelectedNumbers.indexOf(num);
    const cell = document.getElementById(`kenoCell_${num}`);

    if (idx !== -1) {
        // Zaten seçili, kaldır
        kenoSelectedNumbers.splice(idx, 1);
        if (cell) {
            cell.className = 'keno-cell';
            cell.textContent = num;
        }
    } else {
        // Yeni seçim (En fazla 10)
        if (kenoSelectedNumbers.length >= 10) {
            showKenoModalNotice('En fazla 10 sayı seçebilirsiniz!', 'lose');
            return;
        }
        kenoSelectedNumbers.push(num);
        if (cell) {
            cell.className = 'keno-cell selected';
            cell.textContent = num;
        }
    }

    updateKenoUI();
}

// Çekiliş efektlerini ve kasanın açtığı kutuları temizle, seçilenleri koru
function resetKenoVisualEffects() {
    for (let i = 1; i <= 40; i++) {
        const cell = document.getElementById(`kenoCell_${i}`);
        if (cell) {
            cell.className = 'keno-cell';
            cell.textContent = i;
            if (kenoSelectedNumbers.includes(i)) {
                cell.classList.add('selected');
            }
        }
    }
    document.querySelectorAll('.keno-payout-step').forEach(s => s.classList.remove('active-hit'));
}

// Rastgele 10 Sayı Seç (Auto Pick)
function kenoAutoPick() {
    if (isKenoDrawing) return;
    clearKenoSelection();

    const pool = Array.from({ length: 40 }, (_, i) => i + 1);
    const chosen = [];
    for (let i = 0; i < 10; i++) {
        const r = Math.floor(Math.random() * pool.length);
        chosen.push(pool.splice(r, 1)[0]);
    }

    kenoSelectedNumbers = chosen;
    chosen.forEach(n => {
        const cell = document.getElementById(`kenoCell_${n}`);
        if (cell) cell.classList.add('selected');
    });

    updateKenoUI();
}

// Seçimi Temizle
function clearKenoSelection() {
    if (isKenoDrawing) return;
    kenoSelectedNumbers = [];
    for (let i = 1; i <= 40; i++) {
        const cell = document.getElementById(`kenoCell_${i}`);
        if (cell) {
            cell.className = 'keno-cell';
            cell.textContent = i; // İçindeki elmas ikonunu da temizle ve sadece sayıyı yaz
        }
    }
    updateKenoUI();
}

// Arayüzü ve Çarpan Şeridini Güncelle
function updateKenoUI() {
    const countEl = document.getElementById('kenoSelectCount');
    const maxWinEl = document.getElementById('kenoMaxWinVal');
    const ribbon = document.getElementById('kenoPayoutRibbon');
    const count = kenoSelectedNumbers.length;

    if (countEl) countEl.textContent = `${count} / 10`;

    const betInput = document.getElementById('kenoBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10) || 100;

    const table = KENO_PAYOUTS_CLIENT[count];
    if (table) {
        // En yüksek çarpan
        const highestMult = table[count] || 0;
        if (maxWinEl) maxWinEl.textContent = `${highestMult.toFixed(1)}x (${Math.floor(bet * highestMult).toLocaleString()} 🪙)`;
    } else {
        if (maxWinEl) maxWinEl.textContent = '-';
    }

    // Çarpan cetvelini doldur
    if (ribbon) {
        ribbon.innerHTML = '';
        if (count > 0 && table) {
            for (let h = 0; h <= count; h++) {
                const mult = table[h] || 0;
                if (mult > 0 || h === 0) {
                    const step = document.createElement('div');
                    step.className = 'keno-payout-step';
                    step.id = `kenoStep_${h}`;
                    step.innerHTML = `
                        <span class="step-hits">${h} İsabet</span>
                        <span class="step-mult">${mult > 0 ? mult.toFixed(1) + 'x' : '-'}</span>
                    `;
                    ribbon.appendChild(step);
                }
            }
        } else {
            ribbon.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); margin: auto;">Oynamak için tablodan en az 1 sayı seçin</span>';
        }
    }
}

// Bahis Ayarlama
function setKenoBetPreset(action) {
    if (isKenoDrawing) return;
    const input = document.getElementById('kenoBetInput');
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
    updateKenoUI();
}

function onKenoBetChange() {
    updateKenoUI();
}

// Çekilişi Başlat
async function handleKenoPlay() {
    if (isKenoDrawing) return;

    if (kenoSelectedNumbers.length === 0) {
        showKenoModalNotice('Lütfen en az 1 sayı seçin!', 'lose');
        return;
    }

    const betInput = document.getElementById('kenoBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10);

    if (isNaN(bet) || bet < 10) {
        showKenoModalNotice('Minimum bahis 10 🪙 olmalıdır!', 'lose');
        return;
    }

    const playBtn = document.getElementById('btnKenoPlay');
    if (playBtn) playBtn.disabled = true;
    isKenoDrawing = true;

    // Önceki çekiliş izlerini temizle ama seçilenleri koru
    for (let i = 1; i <= 40; i++) {
        const cell = document.getElementById(`kenoCell_${i}`);
        if (cell) {
            cell.className = 'keno-cell';
            cell.textContent = i; // Önceki elmasları sıfırla
            if (kenoSelectedNumbers.includes(i)) cell.classList.add('selected');
        }
    }

    document.querySelectorAll('.keno-payout-step').forEach(s => s.classList.remove('active-hit'));

    try {
        const res = await fetch('/api/keno/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bet,
                numbers: kenoSelectedNumbers
            })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showKenoModalNotice(data.error || 'Oyun başlatılamadı!', 'lose');
            if (playBtn) playBtn.disabled = false;
            isKenoDrawing = false;
            return;
        }

        // Bakiye güncelle (Bahis düşüşü)
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye - data.kazanc);
        }

        // 10 topu sırayla fırlat / aç (Animasyonlu düşüş efekti)
        const drawn = data.drawnNumbers;
        let hitsSoFar = 0;

        for (let i = 0; i < drawn.length; i++) {
            await new Promise(r => setTimeout(r, 160)); // Her top 160ms arayla düşer

            const num = drawn[i];
            const cell = document.getElementById(`kenoCell_${num}`);
            const isHit = kenoSelectedNumbers.includes(num);

            if (cell) {
                if (isHit) {
                    hitsSoFar++;
                    cell.className = 'keno-cell hit';
                    cell.innerHTML = `${num} <i class="fa-solid fa-gem" style="position: absolute; font-size: 10px; top: 3px; right: 3px;"></i>`;
                    
                    // Cetveli güncelle
                    document.querySelectorAll('.keno-payout-step').forEach(s => s.classList.remove('active-hit'));
                    const curStep = document.getElementById(`kenoStep_${hitsSoFar}`);
                    if (curStep) curStep.classList.add('active-hit');
                } else {
                    cell.className = 'keno-cell drawn-miss';
                }
            }
        }

        // Çekiliş bitti, nihai bakiye ve sonuç
        await new Promise(r => setTimeout(r, 300));
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        if (data.kazanc > 0) {
            showKenoModalNotice(`Tebrikler! ${data.hitCount} isabet: +${data.kazanc.toLocaleString()} 🪙 (${data.multiplier}x)`, 'win');
        } else {
            showKenoModalNotice(`${data.hitCount} isabet sağlandı. Kazanç yok.`, 'lose');
        }

    } catch (err) {
        console.error('Keno error:', err);
        showKenoModalNotice('Bağlantı hatası oluştu!', 'lose');
    } finally {
        isKenoDrawing = false;
        hasKenoDrawnOnce = true; // Çekiliş bitti, bir dahaki seçimde veya oyunda otomatik temizleyecek
        if (playBtn) playBtn.disabled = false;
    }
}

// Modal İçi Bildirim Rozeti
function showKenoModalNotice(message, type = 'info') {
    const overlay = document.getElementById('kenoResultOverlay');
    if (!overlay) return;

    if (kenoOverlayTimeout) clearTimeout(kenoOverlayTimeout);

    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'lose') icon = '<i class="fa-solid fa-circle-xmark"></i>';
    else if (type === 'win') icon = '<i class="fa-solid fa-trophy"></i>';

    overlay.className = `keno-result-overlay active ${type}`;
    overlay.innerHTML = `${icon} <span>${message}</span>`;

    kenoOverlayTimeout = setTimeout(() => {
        overlay.classList.remove('active');
    }, 4500);
}
