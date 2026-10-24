// ======================================================
// 🛍️ DİSCORD MAĞAZA (SHOP) WEB CLIENT ENGINE
// ======================================================

let fullShopData = null;
let currentShopCategory = 'meslekler';
let userInventory = [];
let userActiveCharms = [];

const CATEGORY_META = {
    meslekler: { name: 'Meslek Rolleri', icon: 'fa-briefcase', color: '#38bdf8' },
    yatirimlar: { name: 'İşletme & Yatırımlar', icon: 'fa-building', color: '#f59e0b' },
    tilsimlar: { name: 'Büyülü Tılsımlar', icon: 'fa-wand-magic-sparkles', color: '#c084fc' },
    roller: { name: 'Sunucu Rolleri', icon: 'fa-masks-theater', color: '#ec4899' },
    yuzukler: { name: 'Evlilik Yüzükleri', icon: 'fa-gem', color: '#f43f5e' }
};

// Mağazayı Sunucudan Çek ve İlk Kategoriyi Render Et
async function fetchShopData() {
    const grid = document.getElementById('shopItemsGrid');
    if (!grid) return;

    try {
        const res = await fetch('/api/shop/items');
        const data = await res.json();

        if (!data.success) {
            grid.innerHTML = '<div style="color: #fb7185; text-align: center; padding: 40px;">Mağaza verileri alınamadı!</div>';
            return;
        }

        fullShopData = data.shop;
        userInventory = data.envanter || [];
        userActiveCharms = data.aktifTilsimlar || [];

        renderShopCategory(currentShopCategory);

    } catch (err) {
        console.error('Shop fetch error:', err);
        grid.innerHTML = '<div style="color: #fb7185; text-align: center; padding: 40px;">Sunucu ile bağlantı kurulamadı!</div>';
    }
}

// Kategori Değiştir
function switchShopCategory(catKey) {
    currentShopCategory = catKey;

    document.querySelectorAll('.shop-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-cat') === catKey);
    });

    renderShopCategory(catKey);
}

// Seçili Kategorideki Ürünleri Bas
function renderShopCategory(catKey) {
    const grid = document.getElementById('shopItemsGrid');
    if (!grid || !fullShopData) return;

    const items = fullShopData[catKey] || [];
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px; grid-column: 1 / -1;">Bu kategoride henüz ürün bulunmuyor.</div>';
        return;
    }

    const meta = CATEGORY_META[catKey] || { icon: 'fa-box', color: '#6366f1' };

    items.forEach(item => {
        const isOwned = userInventory.some(e => e.id === item.id);
        const card = document.createElement('div');
        card.className = 'shop-item-card';

        // Rozet Özellik Bilgisi
        let perkHtml = '';
        if (item.bonusYuzdesi) {
            perkHtml = `<div class="shop-perk-badge bonus"><i class="fa-solid fa-arrow-trend-up"></i> Maaşa +%${item.bonusYuzdesi} Bonus</div>`;
        } else if (item.saatlikGelir) {
            perkHtml = `<div class="shop-perk-badge income"><i class="fa-solid fa-coins"></i> +${item.saatlikGelir.toLocaleString()} 🪙 / Saat</div>`;
        } else if (catKey === 'tilsimlar') {
            perkHtml = `<div class="shop-perk-badge charm"><i class="fa-solid fa-hourglass-half"></i> Süre: ${item.sureSaat} Saat</div>`;
        }

        // Buton Durumu
        let btnHtml = '';
        if (isOwned && catKey !== 'tilsimlar') {
            btnHtml = `<button class="btn-shop-buy owned" disabled><i class="fa-solid fa-check"></i> Sahipsin</button>`;
        } else {
            btnHtml = `<button class="btn-shop-buy" onclick="handleBuyShopItem('${item.id}', '${catKey}')"><i class="fa-solid fa-bag-shopping"></i> Satın Al</button>`;
        }

        card.innerHTML = `
            <div>
                <div class="shop-item-top">
                    <div class="shop-item-icon" style="background: ${meta.color}22; color: ${meta.color}; border: 1px solid ${meta.color}44;">
                        <i class="fa-solid ${meta.icon}"></i>
                    </div>
                </div>

                <h3 class="shop-item-title">${item.isim}</h3>
                <p class="shop-item-desc">${item.aciklama || 'Açıklama bulunmuyor.'}</p>
                ${perkHtml}
            </div>

            <div class="shop-item-bottom">
                <div class="shop-item-price">
                    <span>${item.fiyat.toLocaleString()}</span>
                    <span>🪙</span>
                </div>
                ${btnHtml}
            </div>
        `;

        grid.appendChild(card);
    });
}

// Satın Alma İsteği Gönder
async function handleBuyShopItem(itemId, categoryId) {
    if (!fullShopData) return;
    const catItems = fullShopData[categoryId] || [];
    const item = catItems.find(i => i.id === itemId);
    const itemName = item ? item.isim : 'Bu ürünü';
    const itemPrice = item ? item.fiyat.toLocaleString() : '';

    if (!confirm(`"${itemName}" ürününü ${itemPrice} 🪙 karşılığında satın almak istiyor musunuz?`)) {
        return;
    }

    try {
        const res = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, categoryId })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.error || 'Satın alma başarısız!', 'error');
            return;
        }

        // Bakiye güncelle
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        showToast(data.message, 'success');

        // Mağaza ve envanteri yeniden çek
        fetchShopData();

    } catch (err) {
        console.error('Shop buy error:', err);
        showToast('Bağlantı hatası oluştu!', 'error');
    }
}
