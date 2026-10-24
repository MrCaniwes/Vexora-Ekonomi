// ======================================================
// 🏰 TOWERS (KULE TIRMANIŞI) CLIENT ENGINE
// ======================================================

const TOWER_PRESETS = {
    easy: {
        cols: 4,
        multipliers: [1.28, 1.65, 2.15, 2.85, 3.80, 5.10, 6.90, 9.40]
    },
    medium: {
        cols: 3,
        multipliers: [1.44, 2.12, 3.15, 4.70, 7.10, 10.80, 16.50, 25.50]
    },
    hard: {
        cols: 2,
        multipliers: [1.92, 3.75, 7.30, 14.30, 28.00, 55.00, 108.00, 215.00]
    }
};

let currentTowerDifficulty = 'medium';
let isTowerGameActive = false;
let currentTowerFloor = 0;
let currentTowerBet = 100;
let towerMultipliers = TOWER_PRESETS.medium.multipliers;
let towerCols = TOWER_PRESETS.medium.cols;
let towersOverlayTimeout = null;

// Modal İçi Sonuç Bildirimi (Rulet & Çark gibi modalın merkezinde şık rozet)
function showTowerModalNotice(message, type = 'info') {
    const overlay = document.getElementById('towersResultOverlay');
    if (!overlay) return;

    if (towersOverlayTimeout) clearTimeout(towersOverlayTimeout);

    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'lose') icon = '<i class="fa-solid fa-bomb"></i>';
    else if (type === 'win') icon = '<i class="fa-solid fa-trophy"></i>';

    overlay.className = `towers-result-overlay active ${type}`;
    overlay.innerHTML = `${icon} <span>${message}</span>`;

    towersOverlayTimeout = setTimeout(() => {
        overlay.classList.remove('active');
    }, 4000);
}

// Modal Aç / Kapa
function openTowersModal() {
    const modal = document.getElementById('towersModal');
    if (modal) {
        modal.classList.add('active');
        if (!isTowerGameActive) {
            renderTowerBoard();
            updateTowersDisplay();
        }
    }
}

function closeTowersModal() {
    if (isTowerGameActive) {
        if (!confirm('Oyundan çıkarsanız mevcut kule bahsiniz kaybolur. Çıkmak istiyor musunuz?')) {
            return;
        }
    }
    const modal = document.getElementById('towersModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Zorluk Değiştir
function setTowerDifficulty(diff) {
    if (isTowerGameActive) return;
    currentTowerDifficulty = diff;

    document.querySelectorAll('.towers-diff-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-diff') === diff);
    });

    towerCols = TOWER_PRESETS[diff].cols;
    towerMultipliers = TOWER_PRESETS[diff].multipliers;

    renderTowerBoard();
    updateTowersDisplay();
}

// Bahis Değiştir
function setTowerBetPreset(action) {
    if (isTowerGameActive) return;
    const input = document.getElementById('towerBetInput');
    if (!input) return;

    let val = parseInt(input.value, 10) || 100;

    if (action === 'half') val = Math.max(10, Math.floor(val / 2));
    else if (action === 'double') val = val * 2;
    else if (action === 'max') {
        const balanceEl = document.getElementById('userBalance');
        if (balanceEl) {
            const raw = parseInt(balanceEl.textContent.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(raw) && raw > 0) val = raw;
        }
    }

    input.value = val;
    updateTowersDisplay();
}

function onTowerBetChange() {
    updateTowersDisplay();
}

// Ekran Bilgilerini Güncelle
function updateTowersDisplay() {
    const betInput = document.getElementById('towerBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10) || 100;
    currentTowerBet = bet;

    const curMultEl = document.getElementById('towerCurrentMult');
    const nextMultEl = document.getElementById('towerNextMult');
    const cashoutValEl = document.getElementById('towerCashoutValue');
    const btnCashout = document.getElementById('btnTowerCashout');
    const btnStart = document.getElementById('btnTowerStart');

    if (!isTowerGameActive) {
        if (curMultEl) curMultEl.textContent = '1.00x';
        if (nextMultEl) nextMultEl.textContent = towerMultipliers[0].toFixed(2) + 'x';
        if (cashoutValEl) cashoutValEl.textContent = '0 🪙';
        if (btnCashout) {
            btnCashout.style.display = 'none';
        }
        if (btnStart) {
            btnStart.style.display = 'flex';
            btnStart.disabled = false;
        }
    } else {
        const curMult = currentTowerFloor > 0 ? towerMultipliers[currentTowerFloor - 1] : 1.00;
        const nextMult = currentTowerFloor < 8 ? towerMultipliers[currentTowerFloor] : towerMultipliers[7];
        const cashoutVal = Math.floor(bet * curMult);

        if (curMultEl) curMultEl.textContent = curMult.toFixed(2) + 'x';
        if (nextMultEl) nextMultEl.textContent = currentTowerFloor < 8 ? nextMult.toFixed(2) + 'x' : 'ZİRVE';
        if (cashoutValEl) cashoutValEl.textContent = cashoutVal.toLocaleString('tr-TR') + ' 🪙';

        if (btnStart) btnStart.style.display = 'none';
        if (btnCashout) {
            btnCashout.style.display = 'flex';
            btnCashout.disabled = currentTowerFloor === 0;
            btnCashout.innerHTML = `<i class="fa-solid fa-hand-holding-dollar"></i> <span>ÇEK: ${cashoutVal.toLocaleString('tr-TR')} 🪙</span>`;
        }
    }
}

// Tahtayı Render Et (8 Kat - 0. Kat En Altta)
function renderTowerBoard() {
    const board = document.getElementById('towerGameBoard');
    if (!board) return;
    board.innerHTML = '';

    // Katları yukarıdan aşağıya (Kat 7'den Kat 0'a) çiziyoruz ki Zirve üstte kalsın
    for (let floor = 7; floor >= 0; floor--) {
        const row = document.createElement('div');
        row.className = 'tower-floor-row';
        row.id = `towerFloor_${floor}`;

        if (isTowerGameActive) {
            if (floor === currentTowerFloor) row.classList.add('active');
            else if (floor < currentTowerFloor) row.classList.add('cleared');
        }

        const mult = document.createElement('div');
        mult.className = 'tower-floor-mult';
        mult.textContent = towerMultipliers[floor].toFixed(2) + 'x';
        row.appendChild(mult);

        const tilesContainer = document.createElement('div');
        tilesContainer.className = `tower-tiles-container cols-${towerCols}`;

        for (let t = 0; t < towerCols; t++) {
            const tile = document.createElement('button');
            tile.className = 'tower-tile';
            tile.id = `towerTile_${floor}_${t}`;
            tile.innerHTML = '<i class="fa-solid fa-lock"></i>';
            tile.onclick = () => handleTowerTileClick(floor, t);
            tilesContainer.appendChild(tile);
        }

        row.appendChild(tilesContainer);
        board.appendChild(row);
    }
}

// Oyunu Başlat
async function handleTowerStart() {
    const betInput = document.getElementById('towerBetInput');
    const bet = parseInt(betInput ? betInput.value : 100, 10);

    if (isNaN(bet) || bet < 10) {
        showTowerModalNotice('Minimum bahis 10 🪙 olmalıdır!', 'lose');
        return;
    }

    const btnStart = document.getElementById('btnTowerStart');
    if (btnStart) btnStart.disabled = true;

    try {
        const res = await fetch('/api/towers/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bet,
                difficulty: currentTowerDifficulty
            })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showTowerModalNotice(data.error || 'Oyun başlatılamadı!', 'lose');
            if (btnStart) btnStart.disabled = false;
            return;
        }

        // Bakiye güncelle
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        isTowerGameActive = true;
        currentTowerFloor = 0;
        currentTowerBet = bet;
        towerCols = data.tilesPerRow;
        towerMultipliers = data.multipliers;

        renderTowerBoard();
        updateTowersDisplay();

        // Aktif kattaki kilit ikonlarını soru işaretine çevir
        updateFloorTileIcons(0);

    } catch (err) {
        console.error('Tower start error:', err);
        showToast('Sunucu ile bağlantı kurulamadı!', 'error');
        if (btnStart) btnStart.disabled = false;
    }
}

// Kutuya Tıklandığında
async function handleTowerTileClick(floor, tileIndex) {
    if (!isTowerGameActive) return;
    if (floor !== currentTowerFloor) return; // Sadece o anki kata basılabilir

    // Tüm kutuları bu kata özel geçici tık engelle
    const currentFloorRow = document.getElementById(`towerFloor_${floor}`);
    if (currentFloorRow) {
        currentFloorRow.style.pointerEvents = 'none';
    }

    try {
        const res = await fetch('/api/towers/climb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tileIndex })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.error || 'Adım atılamadı!', 'error');
            if (currentFloorRow) currentFloorRow.style.pointerEvents = 'auto';
            return;
        }

        const clickedTile = document.getElementById(`towerTile_${floor}_${tileIndex}`);

        if (data.hitMine) {
            // 💥 BOMBA PATLADI!
            isTowerGameActive = false;
            if (clickedTile) {
                clickedTile.className = 'tower-tile mine';
                clickedTile.innerHTML = '<i class="fa-solid fa-bomb"></i>';
            }

            // Kalan mayınları ifşa et
            if (data.revealedMines) {
                revealAllMines(data.revealedMines, floor, tileIndex);
            }

            if (typeof updateGlobalBalance === 'function') {
                updateGlobalBalance(data.yeniBakiye);
            }

            updateTowersDisplay();
            showTowerModalNotice('Mayına bastınız! Kule çöktü.', 'lose');
            return;
        }

        // 💎 GÜVENLİ KUTU!
        if (clickedTile) {
            clickedTile.className = 'tower-tile safe';
            clickedTile.innerHTML = '<i class="fa-solid fa-gem"></i>';
        }

        if (data.isPeak) {
            // 🏆 ZİRVE KAZANCI!
            isTowerGameActive = false;
            if (typeof updateGlobalBalance === 'function') {
                updateGlobalBalance(data.yeniBakiye);
            }
            if (data.revealedMines) {
                revealAllMines(data.revealedMines, floor, tileIndex);
            }
            updateTowersDisplay();
            showTowerModalNotice(`TEBRİKLER! Zirveye ulaştınız: +${data.kazanc.toLocaleString('tr-TR')} 🪙`, 'win');
            return;
        }

        // Bir sonraki kata geç
        currentTowerFloor = data.currentFloor;
        renderTowerBoardState();
        updateFloorTileIcons(currentTowerFloor);
        updateTowersDisplay();

    } catch (err) {
        console.error('Tower climb error:', err);
        showToast('Bağlantı hatası oluştu!', 'error');
        if (currentFloorRow) currentFloorRow.style.pointerEvents = 'auto';
    }
}

// Nakit Çek (Cashout)
async function handleTowerCashout() {
    if (!isTowerGameActive || currentTowerFloor === 0) return;

    const btnCashout = document.getElementById('btnTowerCashout');
    if (btnCashout) btnCashout.disabled = true;

    try {
        const res = await fetch('/api/towers/cashout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.error || 'Çekim başarısız!', 'error');
            if (btnCashout) btnCashout.disabled = false;
            return;
        }

        isTowerGameActive = false;
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        if (data.revealedMines) {
            revealAllMines(data.revealedMines);
        }

        updateTowersDisplay();
        showTowerModalNotice(`Kazanç Çekildi: +${data.kazanc.toLocaleString('tr-TR')} 🪙 (${data.multiplier.toFixed(2)}x)`, 'win');

    } catch (err) {
        console.error('Tower cashout error:', err);
        showTowerModalNotice('Bağlantı hatası!', 'lose');
        if (btnCashout) btnCashout.disabled = false;
    }
}

// Katların durumunu (active/cleared) güncelle
function renderTowerBoardState() {
    for (let f = 0; f < 8; f++) {
        const row = document.getElementById(`towerFloor_${f}`);
        if (!row) continue;
        row.style.pointerEvents = 'auto';
        row.classList.remove('active', 'cleared');

        if (f === currentTowerFloor) {
            row.classList.add('active');
        } else if (f < currentTowerFloor) {
            row.classList.add('cleared');
        }
    }
}

// Aktif kattaki kilit simgelerini tırmanmaya hazır hale getir
function updateFloorTileIcons(activeFloor) {
    const row = document.getElementById(`towerFloor_${activeFloor}`);
    if (!row) return;

    const tiles = row.querySelectorAll('.tower-tile');
    tiles.forEach(tile => {
        if (!tile.classList.contains('safe') && !tile.classList.contains('mine')) {
            tile.innerHTML = '<i class="fa-solid fa-question"></i>';
        }
    });
}

// Tüm mayınları göster
function revealAllMines(minesArray, currentHitFloor, currentHitIndex) {
    minesArray.forEach((mineIndex, floor) => {
        for (let t = 0; t < towerCols; t++) {
            const tile = document.getElementById(`towerTile_${floor}_${t}`);
            if (!tile) continue;

            if (t === mineIndex) {
                if (floor === currentHitFloor && t === currentHitIndex) {
                    // Zaten patlatılmış mayın
                    tile.className = 'tower-tile mine';
                    tile.innerHTML = '<i class="fa-solid fa-bomb"></i>';
                } else {
                    tile.className = 'tower-tile mine-revealed';
                    tile.innerHTML = '<i class="fa-solid fa-bomb"></i>';
                }
            } else if (!tile.classList.contains('safe')) {
                tile.innerHTML = '<i class="fa-solid fa-gem" style="opacity: 0.3;"></i>';
            }
        }
    });
}
