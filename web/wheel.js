// ======================================================
// 🎡 KLASİK ÇARKIFELEK (KIRMIZI 2X / SİYAH 2X / YEŞİL 20X)
// ======================================================

const WHEEL_SEGMENTS_CLIENT = [
    'green', // 0 (20x)
    'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
    'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
    'black', 'red', 'black', 'red', 'black', 'red',
    'green', // 27 (20x)
    'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
    'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red',
    'black', 'red', 'black', 'red', 'black', 'red'
];

let wheelCanvas, wheelCtx;
let currentWheelRotation = 0;
let isWheelSpinning = false;

function openWheelModal() {
    const modal = document.getElementById('wheelModal');
    if (modal) {
        modal.classList.add('active');
        initWheelCanvas();
        fetchWheelHistory();
    }
}

function closeWheelModal() {
    if (isWheelSpinning) {
        alert('Çark dönerken pencereyi kapatamazsınız!');
        return;
    }
    const modal = document.getElementById('wheelModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function initWheelCanvas() {
    wheelCanvas = document.getElementById('wheelCanvas');
    if (!wheelCanvas) return;
    wheelCtx = wheelCanvas.getContext('2d');

    const size = 380;
    wheelCanvas.width = size;
    wheelCanvas.height = size;

    drawWheel(0);
}

function drawWheel(rotationDeg) {
    if (!wheelCtx || !wheelCanvas) return;
    const w = wheelCanvas.width;
    const h = wheelCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 8;

    wheelCtx.clearRect(0, 0, w, h);

    const count = WHEEL_SEGMENTS_CLIENT.length; // 54
    const anglePerSeg = (2 * Math.PI) / count;

    for (let i = 0; i < count; i++) {
        const startAngle = i * anglePerSeg - Math.PI / 2;
        const endAngle = startAngle + anglePerSeg;
        const type = WHEEL_SEGMENTS_CLIENT[i];

        wheelCtx.beginPath();
        wheelCtx.moveTo(cx, cy);
        wheelCtx.arc(cx, cy, radius, startAngle, endAngle);
        wheelCtx.closePath();

        if (type === 'red') {
            wheelCtx.fillStyle = (i % 2 === 0) ? '#e11d48' : '#be123c';
        } else if (type === 'black') {
            wheelCtx.fillStyle = (i % 2 === 0) ? '#1e293b' : '#0f172a';
        } else {
            wheelCtx.fillStyle = '#10b981'; // Yeşil Jackpot
        }
        wheelCtx.fill();

        wheelCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        wheelCtx.lineWidth = 1;
        wheelCtx.stroke();
    }

    // Dış Halka & Altın Çerçeve
    wheelCtx.beginPath();
    wheelCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
    wheelCtx.strokeStyle = '#f59e0b';
    wheelCtx.lineWidth = 4;
    wheelCtx.stroke();
}

function setWheelBetAmount(color, amount) {
    const input = document.getElementById(`wheelBet_${color}`);
    if (!input) return;
    if (amount === 'clear') {
        input.value = 0;
    } else if (amount === '2x') {
        input.value = (parseInt(input.value) || 0) * 2;
    } else {
        input.value = (parseInt(input.value) || 0) + amount;
    }
}

async function handleWheelSpin() {
    if (isWheelSpinning) return;

    const redBet = parseInt(document.getElementById('wheelBet_red').value) || 0;
    const blackBet = parseInt(document.getElementById('wheelBet_black').value) || 0;
    const greenBet = parseInt(document.getElementById('wheelBet_green').value) || 0;
    const totalBet = redBet + blackBet + greenBet;

    if (totalBet < 10) {
        alert('Lütfen en az 10 🪙 bahis yapın!');
        return;
    }

    const spinBtn = document.getElementById('btnWheelSpin');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<span>ÇEVRİLİYOR...</span>';
    isWheelSpinning = true;

    try {
        const res = await fetch('/api/wheel/spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bets: { red: redBet, black: blackBet, green: greenBet } })
        });

        const data = await res.json();
        if (!data.success) {
            alert(data.error || 'Bahis yapılamadı!');
            spinBtn.disabled = false;
            spinBtn.innerHTML = '<i class="fa-solid fa-rotate"></i><span>ÇEVİR</span>';
            isWheelSpinning = false;
            return;
        }

        // Bakiye düşüşünü güncelle
        if (typeof updateGlobalBalance === 'function') {
            updateGlobalBalance(data.yeniBakiye - data.totalWin);
        } else {
            const navBal = document.getElementById('navBalance');
            if (navBal) navBal.innerText = (data.yeniBakiye - data.totalWin).toLocaleString();
        }

        // Çark Dönüş Açısını Hesapla
        const count = WHEEL_SEGMENTS_CLIENT.length; // 54
        const segAngle = 360 / count; // ~6.66667 derece
        
        // Hedef dilimin tam ortasını ibreye (0° / Tepe) getirecek mutlak hedef açı (0 - 360)
        // Dilim i, (i * segAngle) ile ((i + 1) * segAngle) arasındadır. Tam ortası: i * segAngle + segAngle / 2
        // Saat yönünde döndüğünde tepeye gelmesi için ters açı: 360 - ortaNokta
        const targetStopAngle = (360 - (data.winningIndex * segAngle + segAngle / 2)) % 360;

        // Mevcut rotasyonun 360 modundaki kalan açısı
        const currentMod = currentWheelRotation % 360;
        let deltaAngle = targetStopAngle - currentMod;
        if (deltaAngle < 0) {
            deltaAngle += 360;
        }

        // En az 6 tam tur (2160°) + tam hedefin ortasına oturtacak fark
        const totalSpinDelta = 360 * 6 + deltaAngle;
        currentWheelRotation += totalSpinDelta;

        wheelCanvas.style.transform = `rotate(${currentWheelRotation}deg)`;

        // 5 saniyelik dönüş animasyonu bittiğinde sonucu göster
        setTimeout(() => {
            isWheelSpinning = false;
            spinBtn.disabled = false;
            spinBtn.innerHTML = '<i class="fa-solid fa-rotate"></i><span>ÇEVİR</span>';

            // Yeni Bakiye
            if (typeof updateGlobalBalance === 'function') {
                updateGlobalBalance(data.yeniBakiye);
            } else if (navBal) {
                navBal.innerText = data.yeniBakiye.toLocaleString();
            }

            // Geçmişe ekle
            addWheelHistoryPill(data.winningColor);

            // Bildirim
            showWheelResult(data.winningColor, data.totalWin);

        }, 5100);

    } catch (err) {
        console.error('Wheel error:', err);
        isWheelSpinning = false;
        spinBtn.disabled = false;
        spinBtn.innerHTML = '<i class="fa-solid fa-rotate"></i><span>ÇEVİR</span>';
    }
}

function showWheelResult(winningColor, totalWin) {
    const overlay = document.getElementById('wheelResultOverlay');
    if (!overlay) return;

    const colorTr = winningColor === 'green' ? 'YEŞİL (20x)' : (winningColor === 'red' ? 'KIRMIZI (2x)' : 'SİYAH (2x)');

    if (totalWin > 0) {
        overlay.className = 'wheel-result-overlay active win';
        overlay.innerHTML = `<span>🎉</span> <span>KAZANDIN! ${colorTr} &bull; <b>+${totalWin.toLocaleString()} 🪙</b></span>`;
    } else {
        overlay.className = 'wheel-result-overlay active lose';
        overlay.innerHTML = `<span>💥</span> <span>${colorTr} ÇIKTI &bull; Kaybettin</span>`;
    }

    setTimeout(() => {
        overlay.classList.remove('active');
    }, 4500);
}

function addWheelHistoryPill(color) {
    const bar = document.getElementById('wheelHistoryBar');
    if (!bar) return;
    const pill = document.createElement('span');
    pill.className = `wheel-history-pill ${color}`;
    pill.innerText = color === 'green' ? '20x' : '2x';
    bar.prepend(pill);
    if (bar.children.length > 8) {
        bar.removeChild(bar.lastChild);
    }
}

async function fetchWheelHistory() {
    try {
        const res = await fetch('/api/wheel/history');
        const data = await res.json();
        if (data && data.history) {
            const bar = document.getElementById('wheelHistoryBar');
            if (!bar) return;
            bar.innerHTML = '';
            data.history.slice(0, 8).forEach(color => {
                const pill = document.createElement('span');
                pill.className = `wheel-history-pill ${color}`;
                pill.innerText = color === 'green' ? '20x' : '2x';
                bar.appendChild(pill);
            });
        }
    } catch (e) {}
}
