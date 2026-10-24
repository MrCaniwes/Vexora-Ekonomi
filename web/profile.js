// ======================================================
// 👤 VEXORA AYRI PROFİL SAYFASI İSTEMCİSİ (PROFILE.JS)
// ======================================================

let profileWorkTimer = null;

async function loadProfilePage() {
    try {
        const res = await fetch('/api/me');
        if (!res.ok) {
            document.getElementById('profileGuestNotice').style.display = 'block';
            document.getElementById('profileUserContent').style.display = 'none';
            return;
        }

        const data = await res.json();
        if (!data.loggedIn || !data.user) {
            document.getElementById('profileGuestNotice').style.display = 'block';
            document.getElementById('profileUserContent').style.display = 'none';
            return;
        }

        document.getElementById('profileGuestNotice').style.display = 'none';
        document.getElementById('profileUserContent').style.display = 'flex';

        const u = data.user;

        // Üst Başlık & Avatar
        document.getElementById('pageProfileAvatar').src = u.avatar;
        document.getElementById('pageProfileName').innerText = u.name;
        document.getElementById('pageProfileId').innerText = `ID: ${u.id}`;
        document.getElementById('pageProfileLevelBadge').innerText = `Lv.${u.seviye}`;

        // Sağ Bakiye & Servet
        document.getElementById('pageProfileNakit').innerText = u.bakiye.toLocaleString();
        document.getElementById('pageProfileServet').innerText = `${u.toplamServet.toLocaleString()} 🪙`;

        // 1. Kariyer & Meslek
        document.getElementById('pageProfileMeslek').innerText = u.meslek ? u.meslek.isim : 'İşsiz (Meslek Yok)';
        document.getElementById('pageProfileMeslekBonus').innerText = u.meslek ? `+%${u.meslek.bonus} Maaş Bonusu` : 'Maaş bonusu yok';
        document.getElementById('pageProfileLevelText').innerText = `Seviye ${u.seviye} / 5`;
        document.getElementById('pageProfileXpText').innerText = `${u.xp} XP`;

        // XP Bar (Maksimum 5600 XP baz alınır)
        const nextXpTarget = u.seviye >= 5 ? 5600 : (Math.pow(u.seviye, 2) * 350);
        const xpPercent = Math.min(100, Math.floor((u.xp / nextXpTarget) * 100));
        document.getElementById('pageProfileXpFill').style.width = `${xpPercent}%`;

        // 2. Sosyal & Aura
        document.getElementById('pageProfileMedeni').innerText = u.medeniDurum;
        document.getElementById('pageProfileAura').innerText = u.kaderMetni;

        // Tılsımlar
        const tilsimArea = document.getElementById('pageProfileTilsimlar');
        if (u.tilsimlar && u.tilsimlar.length > 0) {
            tilsimArea.innerHTML = u.tilsimlar.map(t => `
                <div class="profile-item-row">
                    <div class="profile-item-left">
                        <span class="profile-item-icon">${t.emoji || '✨'}</span>
                        <div class="profile-item-info">
                            <h4>${t.isim}</h4>
                            <p>Kalan Süre: ${Math.max(0, Math.floor((t.bitisZamani - Date.now()) / (1000 * 60)))} dakika</p>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            tilsimArea.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); font-style: italic;">Aktif büyülü tılsım bulunmuyor.</p>';
        }

        // 3. İşletmeler Listesi
        const isletmeArea = document.getElementById('pageProfileIsletmeler');
        if (u.yatirimlar && u.yatirimlar.length > 0) {
            isletmeArea.innerHTML = u.yatirimlar.map(y => `
                <div class="profile-item-row">
                    <div class="profile-item-left">
                        <span class="profile-item-icon">🏢</span>
                        <div class="profile-item-info">
                            <h4>${y.isim}</h4>
                            <p>Seviye: <strong>${y.seviye || 1} / 5</strong></p>
                        </div>
                    </div>
                    <div class="profile-item-right">
                        ${(y.seviye || 1) < 5 ? `
                            <button class="btn-item-upgrade" onclick="handleProfileUpgrade('${y.id}', ${y.yukseltmeMaliyeti || 0})">
                                <i class="fa-solid fa-arrow-up"></i>
                                <span>Yükselt</span>
                                <span class="upgrade-cost-pill">${y.yukseltmeMaliyeti ? y.yukseltmeMaliyeti.toLocaleString() + ' 🪙' : ''}</span>
                            </button>
                        ` : '<span style="font-size: 11px; color: #10b981; font-weight: 800;">MAX LVL</span>'}
                    </div>
                </div>
            `).join('');
        } else {
            isletmeArea.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); font-style: italic;">Henüz bir işletmeniz yok. Mağazadan satın alabilirsiniz!</p>';
        }

        // Buton Durumları & Cooldown Kontrolü
        checkProfileCooldowns();

    } catch (err) {
        console.error('Profil yükleme hatası:', err);
    }
}

// Cooldown Kontrolü
async function checkProfileCooldowns() {
    try {
        const res = await fetch('/api/profile/status');
        if (!res.ok) return;
        const data = await res.json();

        // Çalış Cooldown
        const workBtn = document.getElementById('btnProfileWork');
        const workSub = document.getElementById('profileWorkSub');
        
        if (data.canWork) {
            workBtn.disabled = false;
            workSub.innerText = 'Maaşını almak için tıkla';
        } else {
            workBtn.disabled = true;
            startWorkCountdown(data.workRemainingSec);
        }

        // Topla Durumu
        const collectBtn = document.getElementById('btnProfileCollect');
        const collectSub = document.getElementById('profileCollectSub');
        
        if (data.isletmeSayisi === 0) {
            collectBtn.disabled = true;
            collectSub.innerText = 'İşletmen bulunmuyor';
        } else if (data.hasilat > 0) {
            collectBtn.disabled = false;
            collectSub.innerText = `Kasada bekleyen: +${data.hasilat.toLocaleString()} 🪙`;
        } else {
            collectBtn.disabled = true;
            collectSub.innerText = 'Kasada henüz para birikmedi';
        }

    } catch (e) {
        console.error('Cooldown kontrol hatası:', e);
    }
}

function startWorkCountdown(sec) {
    if (profileWorkTimer) clearInterval(profileWorkTimer);
    let remaining = sec;

    const workBtn = document.getElementById('btnProfileWork');
    const workSub = document.getElementById('profileWorkSub');

    const updateUI = () => {
        if (remaining <= 0) {
            clearInterval(profileWorkTimer);
            workBtn.disabled = false;
            workSub.innerText = 'Maaşını almak için tıkla';
            return;
        }
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        workSub.innerText = `Dinleniyorsun: ${m}:${s < 10 ? '0' : ''}${s}`;
        remaining--;
    };

    updateUI();
    profileWorkTimer = setInterval(updateUI, 1000);
}

// 💼 ÇALIŞ İŞLEMİ
async function handleProfileWork() {
    const btn = document.getElementById('btnProfileWork');
    btn.disabled = true;

    try {
        const res = await fetch('/api/profile/work', { method: 'POST' });
        const data = await res.json();

        if (!data.success) {
            if (typeof showToast === 'function') {
                showToast(data.error || 'Mesaiye başlanamadı!', 'error');
            } else {
                alert(data.error || 'Hata oluştu!');
            }
            return;
        }

        if (typeof showToast === 'function') {
            showToast(`💼 ${data.message}`, 'success');
        }

        // Global bakiyeyi güncelle
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        loadProfilePage();

    } catch (err) {
        console.error('Çalışma hatası:', err);
    }
}

// 🏢 TOPLA İŞLEMİ
async function handleProfileCollect() {
    const btn = document.getElementById('btnProfileCollect');
    btn.disabled = true;

    try {
        const res = await fetch('/api/profile/collect', { method: 'POST' });
        const data = await res.json();

        if (!data.success) {
            if (typeof showToast === 'function') {
                showToast(data.error || 'Hasılat toplanamadı!', 'error');
            } else {
                alert(data.error || 'Hata oluştu!');
            }
            btn.disabled = false;
            return;
        }

        if (typeof showToast === 'function') {
            showToast(`🏢 ${data.message}`, 'success');
        }

        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        loadProfilePage();

    } catch (err) {
        console.error('Toplama hatası:', err);
    }
}

// ⬆️ İŞLETME YÜKSELTME
async function handleProfileUpgrade(isletmeId, cost) {
    const costText = cost ? `${cost.toLocaleString()} 🪙 karşılığında ` : '';
    if (!confirm(`Bu işletmeyi ${costText}bir üst seviyeye yükseltmek istiyor musunuz?`)) return;

    try {
        const res = await fetch('/api/profile/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isletmeId })
        });

        const data = await res.json();

        if (!data.success) {
            if (typeof showToast === 'function') {
                showToast(data.error || 'Yükseltilemedi!', 'error');
            } else {
                alert(data.error || 'Hata oluştu!');
            }
            return;
        }

        if (typeof showToast === 'function') {
            showToast(`⬆️ ${data.message}`, 'success');
        }

        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye);
        }

        loadProfilePage();

    } catch (err) {
        console.error('Yükseltme hatası:', err);
    }
}
