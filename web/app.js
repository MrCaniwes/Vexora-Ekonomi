// Sayfayı oyunlara kaydırma
function scrollToGames() {
    const el = document.getElementById('gamesArea');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Sağ profil çekmecesini açıp kapatma
function toggleProfileDrawer() {
    const drawer = document.getElementById('profileDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    if (!drawer || !backdrop) return;

    drawer.classList.toggle('active');
    backdrop.classList.toggle('active');
}

// Demo Oyun Açma
function openDemoGame(gameName) {
    alert(`"${gameName}" oyunu seçildi! Oyun mantığı ve kasa algoritması hazırlandığında burada açılacaktır.`);
}

// Sayfa genelinde bakiye güncelleme yardımcısı
function updateGlobalBalance(newBal) {
    if (newBal === undefined || newBal === null) return;
    const str = typeof newBal === 'number' ? newBal.toLocaleString() : newBal;
    
    // Üst Nav Bar
    const navBal = document.getElementById('navBalance');
    if (navBal) navBal.innerText = str;

    // Profil Çekmecesi
    const drawerNakit = document.getElementById('drawerNakit');
    if (drawerNakit) drawerNakit.innerText = `${str} 🪙`;

    // Tüm Oyun Modallarının Başlığındaki Canlı Bakiye Sayaçları
    document.querySelectorAll('.modal-live-balance, .game-modal-balance-val').forEach(el => {
        el.innerText = typeof newBal === 'number' ? `${newBal.toLocaleString()} 🪙` : `${newBal} 🪙`;
    });
}

// Global Şık Toast Bildirim Sistemi
function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('globalToastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'globalToastContainer';
        toastContainer.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const isError = type === 'error';
    const isSuccess = type === 'success';

    let bg = 'rgba(15, 23, 42, 0.95)';
    let border = 'rgba(255, 255, 255, 0.1)';
    let color = '#f8fafc';
    let icon = '<i class="fa-solid fa-circle-info" style="color: #60a5fa;"></i>';

    if (isError) {
        border = 'rgba(239, 68, 68, 0.4)';
        icon = '<i class="fa-solid fa-triangle-exclamation" style="color: #f87171;"></i>';
    } else if (isSuccess) {
        border = 'rgba(16, 185, 129, 0.4)';
        icon = '<i class="fa-solid fa-circle-check" style="color: #34d399;"></i>';
    }

    toast.style.cssText = `
        background: ${bg};
        border: 1px solid ${border};
        color: ${color};
        padding: 12px 18px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        backdrop-filter: blur(12px);
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: auto;
        transform: translateY(-10px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 360px;
    `;

    toast.innerHTML = `${icon} <span>${message}</span>`;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateY(-10px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, 4000);
}

// Canlı Verileri Çek ve Bas
async function loadUserData() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();

        const userSection = document.getElementById('userSection');
        const navBalance = document.getElementById('navBalance');

        if (!data.loggedIn) {
            userSection.innerHTML = `
                <div class="balance-pill">
                    <span>🪙</span>
                    <span>0</span>
                    <span class="currency">VEX</span>
                </div>
                <a href="/auth/login" class="btn-nav" style="background: #5865f2; border-color: #5865f2; color: #fff;">
                    <i class="fa-brands fa-discord"></i>
                    <span>Discord Girişi</span>
                </a>
            `;
            return;
        }

        const u = data.user;
        updateGlobalBalance(u.bakiye);

        // Üst Bar Sağ Taraf
        userSection.innerHTML = `
            <div class="balance-pill">
                <span>🪙</span>
                <span id="navBalance">${u.bakiye.toLocaleString()}</span>
                <span class="currency">VEX</span>
            </div>

            <div class="profile-pill" onclick="toggleProfileDrawer()">
                <img src="${u.avatar}" alt="Avatar">
                <span class="user-name">${u.name}</span>
                <i class="fa-solid fa-chevron-down" style="font-size: 10px; color: var(--text-muted);"></i>
            </div>
        `;

        // Profil Paneli Detayları
        document.getElementById('drawerAvatar').src = u.avatar;
        document.getElementById('drawerName').innerText = u.name;
        document.getElementById('drawerId').innerText = `ID: ${u.id}`;

        document.getElementById('drawerNakit').innerText = `${u.bakiye.toLocaleString()} 🪙`;
        document.getElementById('drawerBorsa').innerText = `${u.borsaDegeri.toLocaleString()} 🪙`;
        document.getElementById('drawerServet').innerText = `${u.toplamServet.toLocaleString()} 🪙`;

        document.getElementById('drawerMeslek').innerHTML = u.meslek ? `${u.meslek.isim} (+%${u.meslek.bonus})` : 'İşsiz';
        document.getElementById('drawerSeviye').innerText = `Lv.${u.seviye} (${u.xp} XP)`;
        document.getElementById('drawerMedeni').innerText = u.medeniDurum;
        document.getElementById('drawerAura').innerText = u.kaderMetni;

        let tilsimStr = 'Aktif tılsım yok';
        if (u.tilsimlar && u.tilsimlar.length > 0) {
            tilsimStr = u.tilsimlar.map(t => `${t.emoji} ${t.isim}`).join(', ');
        }
        document.getElementById('drawerTilsim').innerText = tilsimStr;

        const isletmeBox = document.getElementById('drawerIsletmeler');
        if (u.yatirimlar && u.yatirimlar.length > 0) {
            isletmeBox.innerHTML = u.yatirimlar.map(y => `<span class="badge-tag">${y.isim} (Lvl ${y.seviye || 1})</span>`).join('');
        } else {
            isletmeBox.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">İşletme yok</span>';
        }

        const yuzukBox = document.getElementById('drawerYuzukler');
        if (u.yuzukler && u.yuzukler.length > 0) {
            yuzukBox.innerHTML = u.yuzukler.map(y => `<span class="badge-tag">${y.isim}</span>`).join('');
        } else {
            yuzukBox.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Çantada yüzük yok</span>';
        }

    } catch (e) {
        console.error('Kullanıcı verisi yüklenirken hata:', e);
    }
}

// Sekme Değiştirici (Tabs)
function switchTab(tabName) {
    // Nav buton aktifliği
    document.querySelectorAll('.navbar .btn-nav').forEach(b => b.classList.remove('active'));
    
    // İçerik gizle/göster
    const gamesContent = document.getElementById('tabContentGames');
    const lbContent = document.getElementById('tabContentLeaderboard');
    const marketContent = document.getElementById('tabContentMarket');
    const shopContent = document.getElementById('tabContentShop');

    if (gamesContent) gamesContent.style.display = 'none';
    if (lbContent) lbContent.style.display = 'none';
    if (marketContent) marketContent.style.display = 'none';
    if (shopContent) shopContent.style.display = 'none';

    if (tabName === 'games') {
        const btn = document.getElementById('tabBtnGames');
        if (btn) btn.classList.add('active');
        if (gamesContent) gamesContent.style.display = 'block';
    } else if (tabName === 'leaderboard') {
        const btn = document.getElementById('tabBtnLeaderboard');
        if (btn) btn.classList.add('active');
        if (lbContent) lbContent.style.display = 'block';
        fetchLeaderboard();
    } else if (tabName === 'market') {
        const btn = document.getElementById('tabBtnMarket');
        if (btn) btn.classList.add('active');
        if (marketContent) marketContent.style.display = 'block';
        fetchMarketData();
    } else if (tabName === 'shop') {
        const btn = document.getElementById('tabBtnShop');
        const shopContent = document.getElementById('tabContentShop');
        if (btn) btn.classList.add('active');
        if (shopContent) shopContent.style.display = 'block';
        if (typeof fetchShopData === 'function') {
            fetchShopData();
        }
    }
}

// Liderlik Tablosunu Sunucudan Çek ve Render Et
async function fetchLeaderboard() {
    const tbody = document.getElementById('leaderboardTableBody');
    const podium = document.getElementById('leaderboardPodium');
    if (!tbody) return;

    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();

        if (!data.success || !data.leaderboard || data.leaderboard.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted);">Henüz kayıtlı servet bulunmuyor.</td></tr>';
            if (podium) podium.innerHTML = '';
            return;
        }

        const list = data.leaderboard;

        // Top 3 Podyumu
        if (podium) {
            let podiumHtml = '';
            const medals = ['🥇', '🥈', '🥉'];
            const colors = ['#f59e0b', '#94a3b8', '#d97706'];
            const ranks = [list[0], list[1], list[2]].filter(Boolean);

            ranks.forEach((p, idx) => {
                podiumHtml += `
                    <div class="podium-card rank-${idx + 1}" style="border-top: 3px solid ${colors[idx]};">
                        <div class="podium-badge">${medals[idx]} #${idx + 1}</div>
                        <img class="podium-avatar" src="${p.avatar}" alt="${p.username}">
                        <h4 class="podium-name">${p.username}</h4>
                        <div class="podium-wealth">${p.servet.toLocaleString()} 🪙</div>
                        <div class="podium-sub">
                            <span>Nakit: <b>${p.bakiye.toLocaleString()}</b></span> &bull; 
                            <span>Borsa: <b>${p.borsa.toLocaleString()}</b></span>
                        </div>
                    </div>
                `;
            });
            podium.innerHTML = podiumHtml;
        }

        // Tablo Listesi (Tüm Top 10)
        let rowsHtml = '';
        list.forEach((p, idx) => {
            const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${p.rank}`));
            rowsHtml += `
                <tr class="${idx < 3 ? 'top-row' : ''}">
                    <td style="text-align: center; font-weight: 800; font-size: 15px;">${medal}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${p.avatar}" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1);" alt="Avatar">
                            <div>
                                <div style="font-weight: 700; color: #fff;">${p.username}</div>
                                <div style="font-size: 11px; color: var(--text-muted);">ID: ${p.userId}</div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: var(--gold);">${p.bakiye.toLocaleString()} 🪙</td>
                    <td style="text-align: right; font-weight: 600; color: #38bdf8;">${p.borsa.toLocaleString()} 🪙</td>
                    <td style="text-align: right; font-weight: 800; color: #34d399; font-size: 15px;">${p.servet.toLocaleString()} 🪙</td>
                </tr>
            `;
        });
        tbody.innerHTML = rowsHtml;

    } catch (err) {
        console.error('Leaderboard çekilemedi:', err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: #f43f5e;">Veriler yüklenirken bir sorun oluştu!</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
});
