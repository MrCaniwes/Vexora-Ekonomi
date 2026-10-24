// ======================================================
// 📈 CANLI BORSA & YATIRIM TERMİNALİ CLIENT ENGINE
// ======================================================

let marketAssetsData = [];
let currentTradeAsset = null;
let currentTradeType = 'buy'; // 'buy' veya 'sell'
let marketCountdownInterval = null;

// Borsa Verilerini Çek ve Tabloyu Render Et
async function fetchMarketData() {
    const area = document.getElementById('marketCardsArea');
    if (!area) return;

    try {
        const res = await fetch('/api/market/data');
        const data = await res.json();

        if (!data.success) {
            area.innerHTML = '<div style="color: #fb7185; text-align: center; padding: 40px;">Piyasa verileri alınamadı!</div>';
            return;
        }

        marketAssetsData = data.assets || [];

        // İstatistikleri Güncelle
        const valPortfoy = document.getElementById('marketTotalPortfoyVal');
        const valCuzdan = document.getElementById('marketTotalCuzdanVal');
        if (valPortfoy) valPortfoy.textContent = `${data.toplamPortfoyDegeri.toLocaleString()} 🪙`;
        if (valCuzdan) valCuzdan.textContent = `${data.cuzdanBakiye.toLocaleString()} 🪙`;

        // Kalan Süre Sayacını Başlat
        startMarketCountdown(data.kalanZaman);

        // Varlık Kartlarını Bas
        renderMarketCards(marketAssetsData);

    } catch (err) {
        console.error('Market fetch error:', err);
        area.innerHTML = '<div style="color: #fb7185; text-align: center; padding: 40px;">Sunucu ile bağlantı kurulamadı!</div>';
    }
}

// Geri Sayım Sayacı
function startMarketCountdown(remainingMs) {
    if (marketCountdownInterval) clearInterval(marketCountdownInterval);

    let sec = Math.max(0, Math.floor(remainingMs / 1000));
    const countdownEl = document.getElementById('marketCountdownVal');

    const updateTimer = () => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        if (countdownEl) {
            countdownEl.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        if (sec <= 0) {
            clearInterval(marketCountdownInterval);
            fetchMarketData(); // Süre dolduğunda yeni fiyatları çek
        }
        sec--;
    };

    updateTimer();
    marketCountdownInterval = setInterval(updateTimer, 1000);
}

// Varlık Kartlarını Oluştur
function renderMarketCards(assets) {
    const area = document.getElementById('marketCardsArea');
    if (!area) return;

    area.innerHTML = '';

    assets.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'market-asset-card';

        let badgeClass = 'stable';
        let badgeIcon = 'fa-minus';
        let sign = '';

        if (asset.durum === 'up') {
            badgeClass = 'up';
            badgeIcon = 'fa-arrow-trend-up';
            sign = '+%';
        } else if (asset.durum === 'down') {
            badgeClass = 'down';
            badgeIcon = 'fa-arrow-trend-down';
            sign = '-%';
        }

        const changeStr = asset.degisimYuzdesi !== 0 ? `${sign}${Math.abs(asset.degisimYuzdesi)}` : '%0.00';

        card.innerHTML = `
            <div>
                <div class="asset-card-top">
                    <div class="asset-name-wrap">
                        <h3>${asset.name}</h3>
                    </div>
                    <span class="asset-change-badge ${badgeClass}">
                        <i class="fa-solid ${badgeIcon}"></i>
                        <span>${changeStr}</span>
                    </span>
                </div>

                <div class="asset-price-box">
                    <div class="asset-price-row">
                        <span style="color: var(--text-muted);">Birim Fiyat</span>
                        <span class="asset-price-val">${asset.fiyat.toLocaleString()} 🪙</span>
                    </div>
                    <div class="asset-price-row" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                        <span style="color: var(--text-muted);">Cüzdanınızdaki:</span>
                        <span class="asset-user-holding">${asset.adet.toLocaleString()} adet (${asset.toplamDeger.toLocaleString()} 🪙)</span>
                    </div>
                </div>
            </div>

            <div class="asset-actions-grid">
                <button class="btn-asset-trade buy" onclick="openTradeModal('${asset.id}', 'buy')">
                    <i class="fa-solid fa-cart-shopping"></i> Satın Al
                </button>
                <button class="btn-asset-trade sell" onclick="openTradeModal('${asset.id}', 'sell')" ${asset.adet <= 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
                    <i class="fa-solid fa-money-bill-transfer"></i> Sat
                </button>
            </div>
        `;

        area.appendChild(card);
    });
}

// Alım / Satım Modalını Aç
function openTradeModal(assetId, type) {
    const asset = marketAssetsData.find(a => a.id === assetId);
    if (!asset) return;

    currentTradeAsset = asset;
    currentTradeType = type;

    const modal = document.getElementById('tradeModal');
    const title = document.getElementById('tradeModalTitle');
    const unitPriceEl = document.getElementById('tradeModalUnitPrice');
    const userMaxEl = document.getElementById('tradeModalMaxNotice');
    const input = document.getElementById('tradeAmountInput');
    const confirmBtn = document.getElementById('btnTradeConfirm');

    if (input) input.value = '1';

    if (title) {
        title.innerHTML = type === 'buy' 
            ? `<i class="fa-solid fa-cart-plus" style="color: #34d399;"></i> ${asset.name} Satın Al`
            : `<i class="fa-solid fa-hand-holding-dollar" style="color: #fb7185;"></i> ${asset.name} Sat`;
    }

    if (unitPriceEl) unitPriceEl.textContent = `${asset.fiyat.toLocaleString()} 🪙`;

    if (confirmBtn) {
        confirmBtn.className = `trade-btn-confirm ${type}`;
        confirmBtn.innerHTML = type === 'buy'
            ? `<i class="fa-solid fa-check"></i> Satın Alımı Onayla`
            : `<i class="fa-solid fa-arrow-right-arrow-left"></i> Satışı Onayla`;
    }

    updateTradeCalculation();

    if (modal) modal.classList.add('active');
}

function closeTradeModal() {
    const modal = document.getElementById('tradeModal');
    if (modal) modal.classList.remove('active');
}

// Hızlı Adet Seçimi
function setTradeAmountPreset(preset) {
    const input = document.getElementById('tradeAmountInput');
    if (!input || !currentTradeAsset) return;

    let val = 1;

    if (preset === '1') val = 1;
    else if (preset === '10') val = 10;
    else if (preset === '100') val = 100;
    else if (preset === 'max') {
        if (currentTradeType === 'sell') {
            val = currentTradeAsset.adet || 1;
        } else {
            // Cüzdan nakitiyle alınabilecek maksimum adet
            const bakiyeStr = document.getElementById('marketTotalCuzdanVal');
            const rawBakiye = parseInt(bakiyeStr ? bakiyeStr.textContent.replace(/[^0-9]/g, '') : 0, 10);
            val = Math.max(1, Math.floor(rawBakiye / currentTradeAsset.fiyat));
        }
    }

    input.value = val;
    updateTradeCalculation();
}

// Hesaplamaları Güncelle
function updateTradeCalculation() {
    if (!currentTradeAsset) return;

    const input = document.getElementById('tradeAmountInput');
    const totalCostEl = document.getElementById('tradeModalTotalCost');
    const adet = parseInt(input ? input.value : 1, 10) || 1;

    const total = adet * currentTradeAsset.fiyat;
    if (totalCostEl) totalCostEl.textContent = `${total.toLocaleString()} 🪙`;
}

// İşlemi Onayla (API İsteği)
async function handleTradeConfirm() {
    if (!currentTradeAsset) return;

    const input = document.getElementById('tradeAmountInput');
    const adet = parseInt(input ? input.value : 1, 10);

    if (isNaN(adet) || adet <= 0) {
        showToast('Lütfen geçerli bir miktar girin!', 'error');
        return;
    }

    const confirmBtn = document.getElementById('btnTradeConfirm');
    if (confirmBtn) confirmBtn.disabled = true;

    const endpoint = currentTradeType === 'buy' ? '/api/market/buy' : '/api/market/sell';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assetId: currentTradeAsset.id,
                amount: adet
            })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.error || 'İşlem başarısız oldu!', 'error');
            if (confirmBtn) confirmBtn.disabled = false;
            return;
        }

        // Bakiye güncelle
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        closeTradeModal();
        showToast(data.message, 'success');

        // Borsa verilerini yeniden yükle
        fetchMarketData();

    } catch (err) {
        console.error('Trade error:', err);
        showToast('Bağlantı hatası!', 'error');
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
    }
}
