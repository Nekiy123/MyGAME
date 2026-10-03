// ============================================
// FOREST — v11 (исправлен чёрный экран + светлая карта)
// ============================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mmCtx = minimap.getContext('2d');
const fullmapCanvas = document.getElementById('fullmap-canvas');
const fmCtx = fullmapCanvas.getContext('2d');

let W = window.innerWidth;
let H = window.innerHeight;

function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
}

resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));

// ============================================
// ОРИЕНТАЦИЯ
// ============================================
function lockLandscape() {
    if (screen.orientation && 'lock' in screen.orientation) {
        screen.orientation.lock('landscape').catch(() => {});
    }
}
lockLandscape();
document.addEventListener('touchstart', () => lockLandscape(), { once: true });

const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        setTimeout(lockLandscape, 300);
    } else {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    }
}, { passive: false });

// ============================================
// ОБЛАКА
// ============================================
const clouds = [];
for (let i = 0; i < 12; i++) {
    clouds.push({
        x: Math.random(),
        y: Math.random() * 0.45,
        size: Math.random() * 60 + 40,
        speed: Math.random() * 0.01 + 0.005,
        alpha: Math.random() * 0.3 + 0.3
    });
}

// ============================================
// КАРТА ЛЕСА 30x30
// ============================================
const MAP_SIZE = 30;
const CELL = 3;
const MID = Math.floor(MAP_SIZE / 2);

const MAP = [];
for (let z = 0; z < MAP_SIZE; z++) {
    let row = '';
    for (let x = 0; x < MAP_SIZE; x++) {
        const distFromEdge = Math.min(x, z, MAP_SIZE - 1 - x, MAP_SIZE - 1 - z);
        
        // 2 клетки от края — вода
        if (distFromEdge < 2) {
            row += 'W';
            continue;
        }
        
        // Стартовая поляна 7×7 вокруг центра
        const distToCenter = Math.hypot(x - MID, z - MID);
        if (distToCenter < 3.5) {
            row += '.';
            continue;
        }
        
        // Поляна вокруг старта игрока
        const startX = MID + 1;
        const startZ = MID;
        if (Math.abs(x - startX) <= 2 && Math.abs(z - startZ) <= 2) {
            row += '.';
            continue;
        }
        
        // Обычный лес — 25% плотности
        if (Math.random() < 0.25) {
            row += 'T';
        } else {
            row += '.';
        }
    }
    MAP.push(row);
}

// Костёр в центре
MAP[MID] = MAP[MID].substring(0, MID) + 'C' + MAP[MID].substring(MID + 1);

function getCell(wx, wz) {
    const gx = Math.floor(wx / CELL);
    const gz = Math.floor(wz / CELL);
    if (gx < 0 || gz < 0 || gx >= MAP_SIZE || gz >= MAP_SIZE) return 'W';
    return MAP[gz][gx];
}
function isWall(wx, wz) {
    const c = getCell(wx, wz);
    return c === 'T' || c === 'W';
}

// ============================================
// КОСТЁР
// ============================================
const campfire = {
    x: (MID + 0.5) * CELL,
    z: (MID + 0.5) * CELL,
    radius: 3.5
};

// ============================================
// ЯГОДЫ
// ============================================
const berryBushes = [];
for (let i = 0; i < 25; i++) {
    for (let attempt = 0; attempt < 50; attempt++) {
        const gx = 3 + Math.floor(Math.random() * (MAP_SIZE - 6));
        const gz = 3 + Math.floor(Math.random() * (MAP_SIZE - 6));
        
        if (MAP[gz][gx] === '.') {
            const distToCenter = Math.hypot(gx - MID, gz - MID);
            if (distToCenter > 6) {
                berryBushes.push({
                    x: (gx + 0.5) * CELL,
                    z: (gz + 0.5) * CELL,
                    collected: false,
                    respawnAt: 0
                });
                break;
            }
        }
    }
}

// ============================================
// ИГРОК
// ============================================
const player = {
    x: (MID + 1.5) * CELL,
    z: (MID + 0.5) * CELL,
    y: 0, vy: 0,
    height: 1.6,
    speed: 4,
    angle: 0, pitch: 0,
    onGround: true,
    jumpPower: 6.5,
    gravity: 20,
    radius: 0.35,
    hp: 100, maxHp: 100,
    hunger: 100, maxHunger: 100,
    berries: 0,
    alive: true,
    flashlight: false,
    battery: 100
};

// Проверка: игрок не в стене
function ensurePlayerNotInWall() {
    if (isWall(player.x, player.z)) {
        player.x = (MID + 0.5) * CELL;
        player.z = (MID + 0.5) * CELL;
        console.warn('Игрок был в стене — перемещён в центр');
    }
}
ensurePlayerNotInWall();

// ============================================
// ДЖОЙСТИК
// ============================================
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');

const joystick = {
    active: false, touchId: null,
    centerX: 0, centerY: 0,
    dx: 0, dy: 0, maxDist: 55
};

function handleJoyStart(e) {
    const touch = e.changedTouches[0];
    joystick.active = true;
    joystick.touchId = touch.identifier;
    joystick.centerX = touch.clientX;
    joystick.centerY = touch.clientY;
    
    const rect = joystickZone.getBoundingClientRect();
    joystickBase.style.left = (touch.clientX - rect.left - 65) + 'px';
    joystickBase.style.top = (touch.clientY - rect.top - 65) + 'px';
    joystickBase.style.transform = 'none';
    joystickBase.style.background = 'rgba(255, 255, 255, 0.2)';
    joystickBase.style.borderColor = 'rgba(255, 255, 255, 0.6)';
    
    joystick.dx = 0; joystick.dy = 0;
    joystickKnob.style.transform = 'translate(0,0)';
    joystickKnob.style.background = 'rgba(255, 255, 255, 0.7)';
    e.preventDefault();
}
function handleJoyMove(e) {
    if (!joystick.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joystick.touchId) {
            let dx = t.clientX - joystick.centerX;
            let dy = t.clientY - joystick.centerY;
            const d = Math.hypot(dx, dy);
            if (d > joystick.maxDist) { dx = dx / d * joystick.maxDist; dy = dy / d * joystick.maxDist; }
            joystick.dx = dx; joystick.dy = dy;
            joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        }
    }
    e.preventDefault();
}
function handleJoyEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystick.touchId) {
            joystick.active = false;
            joystick.touchId = null;
            joystick.dx = 0; joystick.dy = 0;
            joystickKnob.style.transform = 'translate(0,0)';
            joystickBase.style.background = 'rgba(255, 255, 255, 0.06)';
            joystickBase.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            joystickKnob.style.background = 'rgba(255, 255, 255, 0.3)';
        }
    }
    e.preventDefault();
}
joystickZone.addEventListener('touchstart', handleJoyStart, { passive: false });
joystickZone.addEventListener('touchmove', handleJoyMove, { passive: false });
joystickZone.addEventListener('touchend', handleJoyEnd, { passive: false });
joystickZone.addEventListener('touchcancel', handleJoyEnd, { passive: false });

// ============================================
// ОБЗОР
// ============================================
const lookZone = document.getElementById('look-zone');
const look = { active: false, touchId: null, lastX: 0, lastY: 0 };

function handleLookStart(e) {
    const t = e.changedTouches[0];
    look.active = true;
    look.touchId = t.identifier;
    look.lastX = t.clientX;
    look.lastY = t.clientY;
    e.preventDefault();
}
function handleLookMove(e) {
    if (!look.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === look.touchId) {
            const dx = t.clientX - look.lastX;
            const dy = t.clientY - look.lastY;
            player.angle += dx * 0.005;
            player.pitch -= dy * 0.005;
            const mp = Math.PI / 2 - 0.15;
            if (player.pitch > mp) player.pitch = mp;
            if (player.pitch < -mp) player.pitch = -mp;
            look.lastX = t.clientX; look.lastY = t.clientY;
        }
    }
    e.preventDefault();
}
function handleLookEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === look.touchId) {
            look.active = false; look.touchId = null;
        }
    }
    e.preventDefault();
}
lookZone.addEventListener('touchstart', handleLookStart, { passive: false });
lookZone.addEventListener('touchmove', handleLookMove, { passive: false });
lookZone.addEventListener('touchend', handleLookEnd, { passive: false });
lookZone.addEventListener('touchcancel', handleLookEnd, { passive: false });

// Мышь для ПК
let mouseDown = false;
lookZone.addEventListener('mousedown', (e) => { mouseDown = true; look.lastX = e.clientX; look.lastY = e.clientY; });
window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    player.angle += (e.clientX - look.lastX) * 0.005;
    player.pitch -= (e.clientY - look.lastY) * 0.005;
    const mp = Math.PI / 2 - 0.15;
    if (player.pitch > mp) player.pitch = mp;
    if (player.pitch < -mp) player.pitch = -mp;
    look.lastX = e.clientX; look.lastY = e.clientY;
});
window.addEventListener('mouseup', () => mouseDown = false);

// ============================================
// ПОЛНАЯ КАРТА
// ============================================
const fullmapScreen = document.getElementById('fullmap-screen');

minimap.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFullmap();
}, { passive: false });

minimap.addEventListener('click', (e) => {
    e.preventDefault();
    openFullmap();
});

function openFullmap() {
    fullmapScreen.classList.add('show');
    drawFullmap();
}

fullmapScreen.addEventListener('click', () => {
    fullmapScreen.classList.remove('show');
});
fullmapScreen.addEventListener('touchstart', (e) => {
    e.preventDefault();
    fullmapScreen.classList.remove('show');
}, { passive: false });

function drawFullmap() {
    const size = Math.min(window.innerWidth * 0.85, window.innerHeight * 0.75);
    fullmapCanvas.width = size;
    fullmapCanvas.height = size;
    
    const cs = size / MAP_SIZE;
    
    // Фон — вода
    fmCtx.fillStyle = '#5a9ac8';
    fmCtx.fillRect(0, 0, size, size);
    
    // Остров
    for (let z = 0; z < MAP_SIZE; z++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const cell = MAP[z][x];
            const px = x * cs;
            const py = z * cs;
            
            if (cell === 'W') continue;
            else if (cell === 'T') fmCtx.fillStyle = '#3a6a3a';
            else if (cell === 'C') fmCtx.fillStyle = '#ff8833';
            else fmCtx.fillStyle = '#a8c88a';
            
            fmCtx.fillRect(px, py, cs + 0.5, cs + 0.5);
        }
    }
    
    // Ягоды
    for (const b of berryBushes) {
        if (b.collected) continue;
        const bx = (b.x / CELL) * cs;
        const bz = (b.z / CELL) * cs;
        fmCtx.fillStyle = '#ee2244';
        fmCtx.beginPath();
        fmCtx.arc(bx, bz, cs * 0.3, 0, Math.PI * 2);
        fmCtx.fill();
    }
    
    // Костёр
    const cx = (campfire.x / CELL) * cs;
    const cz = (campfire.z / CELL) * cs;
    fmCtx.fillStyle = '#ffcc00';
    fmCtx.beginPath();
    fmCtx.arc(cx, cz, cs * 0.6, 0, Math.PI * 2);
    fmCtx.fill();
    fmCtx.strokeStyle = '#ff4400';
    fmCtx.lineWidth = 2;
    fmCtx.stroke();
    
    // Игрок — красная стрелка
    const px = (player.x / CELL) * cs;
    const pz = (player.z / CELL) * cs;
    
    const time = performance.now() / 500;
    const pulse = 1 + Math.sin(time) * 0.15;
    
    fmCtx.save();
    fmCtx.translate(px, pz);
    fmCtx.rotate(player.angle);
    
    fmCtx.fillStyle = 'rgba(230, 30, 50, 0.35)';
    fmCtx.beginPath();
    fmCtx.arc(0, 0, cs * 0.8 * pulse, 0, Math.PI * 2);
    fmCtx.fill();
    
    fmCtx.fillStyle = '#ee2233';
    fmCtx.strokeStyle = '#fff';
    fmCtx.lineWidth = 2;
    fmCtx.beginPath();
    fmCtx.moveTo(0, -cs * 0.9);
    fmCtx.lineTo(-cs * 0.55, cs * 0.6);
    fmCtx.lineTo(0, cs * 0.3);
    fmCtx.lineTo(cs * 0.55, cs * 0.6);
    fmCtx.closePath();
    fmCtx.fill();
    fmCtx.stroke();
    fmCtx.restore();
    
    // N
    fmCtx.fillStyle = '#fff';
    fmCtx.font = 'bold 16px Arial';
    fmCtx.textAlign = 'center';
    fmCtx.strokeStyle = '#000';
    fmCtx.lineWidth = 3;
    fmCtx.strokeText('N', size / 2, 20);
    fmCtx.fillText('N', size / 2, 20);
}

// ============================================
// КНОПКИ
// ============================================
function bindButton(id, onDown) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        btn.classList.add('pressed');
        onDown();
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');
    }, { passive: false });
    btn.addEventListener('click', (e) => { e.preventDefault(); onDown(); });
}

bindButton('jump-button', () => {
    if (!player.alive) return;
    if (player.onGround) { player.vy = player.jumpPower; player.onGround = false; }
});
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && player.onGround && player.alive) {
        player.vy = player.jumpPower; player.onGround = false;
    }
});

bindButton('collect-button', () => {
    if (!player.alive) return;
    let closest = null, cd = 2.5;
    for (const b of berryBushes) {
        if (b.collected) continue;
        const d = Math.hypot(b.x - player.x, b.z - player.z);
        if (d < cd) { cd = d; closest = b; }
    }
    if (closest) {
        closest.collected = true;
        closest.respawnAt = performance.now() + 30000;
        player.berries++;
        showHint('+1 🍓');
    } else showHint('Рядом нет ягод');
});

const flashBtn = document.getElementById('flashlight-button');
bindButton('flashlight-button', () => {
    if (!player.alive) return;
    if (player.battery <= 0) { showHint('Батарея разряжена'); return; }
    player.flashlight = !player.flashlight;
    flashBtn.classList.toggle('active', player.flashlight);
});

bindButton('eat-button', () => {
    if (!player.alive) return;
    if (player.berries > 0 && player.hunger < 100) {
        player.berries--;
        player.hunger = Math.min(100, player.hunger + 25);
        showHint('🍓 +25 сытости');
    } else if (player.berries === 0) showHint('Нет ягод');
    else showHint('Ты не голоден');
});

// ============================================
// ПОДСКАЗКИ
// ============================================
const hintEl = document.getElementById('hint');
let hintTimeout = null;
function showHint(text) {
    hintEl.textContent = text;
    hintEl.classList.add('show');
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => hintEl.classList.remove('show'), 1500);
}

// ============================================
// КОЛЛИЗИИ
// ============================================
function tryMove(nx, nz) {
    const r = player.radius;
    const checks = [
        [nx - r, nz - r], [nx + r, nz - r],
        [nx - r, nz + r], [nx + r, nz + r]
    ];
    for (const [cx, cz] of checks) if (isWall(cx, cz)) return false;
    return true;
}

// ============================================
// НЕБО — ДЕНЬ
// ============================================
function drawSky() {
    ctx.save();
    const pitchOffset = player.pitch * H * 0.8;
    
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#4a9ee8');
    skyGrad.addColorStop(0.5, '#87ceeb');
    skyGrad.addColorStop(1, '#c8e8f5');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);
    
    ctx.translate(0, pitchOffset);
    
    const time = performance.now() / 1000;
    const cloudOffset = (player.angle / (Math.PI * 2)) * W * 2;
    for (const c of clouds) {
        let cx = ((c.x + time * c.speed) * W * 2 - cloudOffset) % (W * 2);
        if (cx < -200) cx += W * 2;
        if (cx > W + 200) continue;
        const cy = c.y * H;
        
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, c.size * 0.5, 0, Math.PI * 2);
        ctx.arc(cx + c.size * 0.4, cy - c.size * 0.1, c.size * 0.6, 0, Math.PI * 2);
        ctx.arc(cx - c.size * 0.4, cy + c.size * 0.05, c.size * 0.45, 0, Math.PI * 2);
        ctx.arc(cx + c.size * 0.1, cy + c.size * 0.15, c.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    const sunX = W / 2;
    const sunY = H * 0.18;
    const sunR = 45;
    
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 6);
    sunGlow.addColorStop(0, 'rgba(255, 250, 200, 0.9)');
    sunGlow.addColorStop(0.3, 'rgba(255, 240, 150, 0.4)');
    sunGlow.addColorStop(1, 'rgba(255, 220, 100, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff8c0';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fffde0';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// ============================================
// РЕЙКАСТИНГ
// ============================================
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;

function castRay(rayAngle) {
    const cos = Math.cos(rayAngle), sin = Math.sin(rayAngle);
    const step = 0.05;
    let dist = 0;
    const maxDist = 35;
    while (dist < maxDist) {
        dist += step;
        if (isWall(player.x + cos * dist, player.z + sin * dist)) return dist;
    }
    return maxDist;
}

function renderWalls() {
    const horizon = H / 2 + player.pitch * H * 0.8;
    const numRays = Math.floor(W / 2);
    const rayStep = W / numRays;

    for (let i = 0; i < numRays; i++) {
        const screenX = i * rayStep;
        const rayAngle = player.angle - HALF_FOV + (i / numRays) * FOV;
        const dist = castRay(rayAngle);
        const correctedDist = dist * Math.cos(rayAngle - player.angle);
        
        const wallHeight = (CELL * 2.5 * H) / correctedDist * 0.9;
        const wallTop = horizon - wallHeight / 2 + (player.height - 1.6) * H / correctedDist;

        let brightness = Math.max(0.55, 1 - correctedDist / 60);
        
        const rayOffset = (i / numRays) - 0.5;
        if (player.flashlight && Math.abs(rayOffset) < 0.4) {
            const falloff = 1 - Math.abs(rayOffset) / 0.4;
            brightness += falloff * Math.max(0, 1 - correctedDist / 25) * 0.3;
        }
        brightness = Math.min(1.3, brightness);

        const cell = getCell(player.x + Math.cos(rayAngle) * dist, player.z + Math.sin(rayAngle) * dist);
        
        if (cell === 'W') {
            const r = Math.floor(50 * brightness + 20);
            const g = Math.floor(120 * brightness + 40);
            const b = Math.floor(180 * brightness + 40);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(screenX, wallTop, rayStep + 1, wallHeight);
        } else {
            const r = Math.floor(110 * brightness + 20);
            const g = Math.floor(80 * brightness + 25);
            const b = Math.floor(50 * brightness + 15);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(screenX, wallTop, rayStep + 1, wallHeight);

            const crownTop = wallTop;
            const crownHeight = wallHeight * 0.45;
            
            const gr = Math.floor(60 * brightness + 20);
            const gg = Math.floor(120 * brightness + 40);
            const gb = Math.floor(50 * brightness + 20);
            ctx.fillStyle = `rgb(${gr},${gg},${gb})`;
            ctx.fillRect(screenX, crownTop, rayStep + 1, crownHeight);

            if (i % 3 === 0) {
                ctx.fillStyle = `rgba(0, 0, 0, ${0.15 * brightness})`;
                ctx.fillRect(screenX, wallTop + crownHeight, 1, wallHeight - crownHeight);
            }
        }
    }
}

// ============================================
// ПОЛ
// ============================================
function renderFloor() {
    const horizon = H / 2 + player.pitch * H * 0.8;
    
    const floorGrad = ctx.createLinearGradient(0, horizon, 0, H);
    floorGrad.addColorStop(0, '#3a5a2a');
    floorGrad.addColorStop(0.3, '#5a8a3a');
    floorGrad.addColorStop(1, '#7aa84a');

    if (horizon < H) {
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, Math.max(0, horizon), W, H - Math.max(0, horizon));
    }
    if (horizon >= H) return;

    const floorTop = Math.max(0, horizon);
    const camY = player.height + player.y;
    
    for (let d = 1; d < 30; d++) {
        const worldZ = d * CELL;
        const screenY = horizon + (H - horizon) * (camY / (camY + worldZ * 0.7));
        if (screenY < floorTop || screenY > H) continue;
        
        const alpha = Math.max(0, 1 - d / 25) * 0.2;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#2a4a1a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(W, screenY);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// ============================================
// КОСТЁР
// ============================================
function renderCampfire() {
    const dx = campfire.x - player.x, dz = campfire.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 20) return;

    let angleToFire = Math.atan2(dx, dz) - player.angle;
    while (angleToFire > Math.PI) angleToFire -= Math.PI * 2;
    while (angleToFire < -Math.PI) angleToFire += Math.PI * 2;
    if (Math.abs(angleToFire) > HALF_FOV + 0.2) return;

    const horizon = H / 2 + player.pitch * H * 0.8;
    const screenX = W / 2 + (angleToFire / HALF_FOV) * (W / 2);
    const size = Math.max(10, 200 / dist);
    const screenY = horizon + (H - horizon) * (1 / (1 + dist * 0.5)) - size * 0.3;

    const time = performance.now() / 100;
    const flicker = 1 + Math.sin(time) * 0.15;

    ctx.fillStyle = '#ff6622';
    ctx.beginPath();
    ctx.moveTo(screenX - size * 0.4, screenY + size * 0.5);
    ctx.lineTo(screenX, screenY - size * flicker);
    ctx.lineTo(screenX + size * 0.4, screenY + size * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffaa44';
    ctx.beginPath();
    ctx.moveTo(screenX - size * 0.25, screenY + size * 0.3);
    ctx.lineTo(screenX, screenY - size * 0.6 * flicker);
    ctx.lineTo(screenX + size * 0.25, screenY + size * 0.3);
    ctx.closePath();
    ctx.fill();
}

// ============================================
// ЯГОДЫ
// ============================================
function renderBerries() {
    const horizon = H / 2 + player.pitch * H * 0.8;
    for (const b of berryBushes) {
        if (b.collected) continue;
        const dx = b.x - player.x, dz = b.z - player.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 18 || dist < 0.3) continue;

        let angleToB = Math.atan2(dx, dz) - player.angle;
        while (angleToB > Math.PI) angleToB -= Math.PI * 2;
        while (angleToB < -Math.PI) angleToB += Math.PI * 2;
        if (Math.abs(angleToB) > HALF_FOV + 0.2) continue;

        const screenX = W / 2 + (angleToB / HALF_FOV) * (W / 2);
        const screenY = horizon + (H - horizon) * (player.height / (player.height + dist * 0.5));
        const size = Math.max(4, 80 / dist);

        ctx.fillStyle = `rgba(40, 130, 30, 0.95)`;
        ctx.beginPath();
        ctx.arc(screenX, screenY - size * 0.3, size * 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ee2244';
        for (let k = 0; k < 3; k++) {
            const ox = Math.cos(k * 2.1) * size * 0.5;
            const oy = Math.sin(k * 2.1) * size * 0.4 - size * 0.3;
            ctx.beginPath();
            ctx.arc(screenX + ox, screenY - size * 0.3 + oy, size * 0.18, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ============================================
// ВИНЬЕТКА
// ============================================
function drawVignette() {
    const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H) * 0.5, W/2, H/2, Math.max(W,H) * 0.9);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ============================================
// МИНИКАРТА
// ============================================
function renderMinimap() {
    const size = minimap.width;
    const cx = size / 2;
    const cy = size / 2;
    
    const viewRadius = 7;
    const scale = (size / 2) / viewRadius;
    
    mmCtx.fillStyle = '#e8e8d0';
    mmCtx.fillRect(0, 0, size, size);
    
    const pgx = player.x / CELL;
    const pgz = player.z / CELL;
    
    for (let dz = -viewRadius; dz <= viewRadius; dz++) {
        for (let dx = -viewRadius; dx <= viewRadius; dx++) {
            const gx = Math.floor(pgx + dx);
            const gz = Math.floor(pgz + dz);
            
            const screenX = cx + (dx - (pgx - Math.floor(pgx))) * scale;
            const screenY = cy + (dz - (pgz - Math.floor(pgz))) * scale;
            
            if (gx < 0 || gz < 0 || gx >= MAP_SIZE || gz >= MAP_SIZE) {
                mmCtx.fillStyle = '#5a9ac8';
                mmCtx.fillRect(screenX, screenY, scale + 0.5, scale + 0.5);
                continue;
            }
            
            const cell = MAP[gz][gx];
            
            if (cell === 'T') {
                mmCtx.fillStyle = '#2d6a2d';
            } else if (cell === 'C') {
                mmCtx.fillStyle = '#ffaa33';
            } else if (cell === 'W') {
                mmCtx.fillStyle = '#5a9ac8';
            } else {
                mmCtx.fillStyle = '#c8e8a0';
            }
            mmCtx.fillRect(screenX, screenY, scale + 0.5, scale + 0.5);
        }
    }
    
    // Ягоды
    for (const b of berryBushes) {
        if (b.collected) continue;
        const bdx = (b.x - player.x) / CELL;
        const bdz = (b.z - player.z) / CELL;
        if (Math.hypot(bdx, bdz) > viewRadius) continue;
        const bx = cx + bdx * scale;
        const by = cy + bdz * scale;
        mmCtx.fillStyle = '#ee2244';
        mmCtx.beginPath();
        mmCtx.arc(bx, by, 3.5, 0, Math.PI * 2);
        mmCtx.fill();
        mmCtx.strokeStyle = '#fff';
        mmCtx.lineWidth = 1;
        mmCtx.stroke();
    }
    
    // Костёр
    const cdx = (campfire.x - player.x) / CELL;
    const cdz = (campfire.z - player.z) / CELL;
    if (Math.hypot(cdx, cdz) <= viewRadius) {
        const cxPos = cx + cdx * scale;
        const cyPos = cy + cdz * scale;
        mmCtx.fillStyle = '#ffcc00';
        mmCtx.beginPath();
        mmCtx.arc(cxPos, cyPos, 5, 0, Math.PI * 2);
        mmCtx.fill();
        mmCtx.strokeStyle = '#ff4400';
        mmCtx.lineWidth = 1.5;
        mmCtx.stroke();
    }
    
    // Игрок — стрелка
    mmCtx.save();
    mmCtx.translate(cx, cy);
    mmCtx.rotate(-player.angle);
    mmCtx.fillStyle = '#ee2233';
    mmCtx.strokeStyle = '#fff';
    mmCtx.lineWidth = 1.5;
    mmCtx.beginPath();
    mmCtx.moveTo(0, -9);
    mmCtx.lineTo(-6, 6);
    mmCtx.lineTo(6, 6);
    mmCtx.closePath();
    mmCtx.fill();
    mmCtx.stroke();
    mmCtx.restore();
}

// ============================================
// HUD
// ============================================
const healthCircle = document.getElementById('health-circle');
const hungerCircle = document.getElementById('hunger-circle');
const batteryCircle = document.getElementById('battery-circle');
const berriesCount = document.getElementById('berries-count');

function updateHUD() {
    healthCircle.style.borderColor = 
        player.hp > 60 ? '#44ff66' :
        player.hp > 30 ? '#ffcc00' : '#ff2222';
    
    hungerCircle.style.borderColor = 
        player.hunger > 60 ? '#44ff66' :
        player.hunger > 30 ? '#ffcc00' : '#ff2222';
    
    batteryCircle.style.borderColor = 
        player.battery > 60 ? '#44ccff' :
        player.battery > 30 ? '#ffcc00' : '#ff2222';
    
    berriesCount.textContent = player.berries;
}

// ============================================
// СМЕРТЬ
// ============================================
const deathScreen = document.getElementById('death-screen');
const deathReason = document.getElementById('death-reason');
const respawnBtn = document.getElementById('respawn-btn');

function die(reason) {
    player.alive = false;
    deathReason.textContent = reason;
    deathScreen.classList.add('show');
}

respawnBtn.addEventListener('click', () => {
    player.hp = player.maxHp;
    player.hunger = player.maxHunger;
    player.battery = 100;
    player.alive = true;
    player.x = (MID + 1.5) * CELL;
    player.z = (MID + 0.5) * CELL;
    player.y = 0; player.vy = 0;
    player.angle = 0; player.pitch = 0;
    ensurePlayerNotInWall();
    deathScreen.classList.remove('show');
});

// ============================================
// ОБНОВЛЕНИЕ
// ============================================
let hungerTimer = 0;
let batteryTimer = 0;

function update(dt) {
    if (!player.alive) return;

    if (joystick.active) {
        const jx = joystick.dx / joystick.maxDist;
        const jy = joystick.dy / joystick.maxDist;
        
        const deadzone = 0.12;
        const mx = Math.abs(jx) < deadzone ? 0 : jx;
        const my = Math.abs(jy) < deadzone ? 0 : jy;
        
        const forward = -my;
        const strafe = mx;
        
        const sinA = Math.sin(player.angle);
        const cosA = Math.cos(player.angle);
        
        const moveX = (sinA * forward + cosA * strafe) * player.speed * dt;
        const moveZ = (cosA * forward - sinA * strafe) * player.speed * dt;
        
        if (tryMove(player.x + moveX, player.z)) player.x += moveX;
        if (tryMove(player.x, player.z + moveZ)) player.z += moveZ;
    }

    if (!player.onGround) {
        player.vy -= player.gravity * dt;
        player.y += player.vy * dt;
        if (player.y <= 0) { player.y = 0; player.vy = 0; player.onGround = true; }
    }

    hungerTimer += dt;
    if (hungerTimer > 3) {
        hungerTimer = 0;
        player.hunger = Math.max(0, player.hunger - 1);
    }

    if (player.hunger <= 0) {
        player.hp -= 5 * dt;
        if (player.hp <= 0) die('Ты умер от голода');
    }

    const fireDist = Math.hypot(campfire.x - player.x, campfire.z - player.z);
    if (fireDist < campfire.radius && player.hunger > 50) {
        player.hp = Math.min(player.maxHp, player.hp + 3 * dt);
    }

    if (player.flashlight) {
        batteryTimer += dt;
        if (batteryTimer > 0.5) {
            batteryTimer = 0;
            player.battery = Math.max(0, player.battery - 1);
            if (player.battery <= 0) {
                player.flashlight = false;
                flashBtn.classList.remove('active');
                showHint('Батарея разряжена');
            }
        }
    }

    const now = performance.now();
    for (const b of berryBushes) {
        if (b.collected && now > b.respawnAt) b.collected = false;
    }

    updateHUD();
}

// ============================================
// РЕНДЕР
// ============================================
function render() {
    drawSky();
    renderFloor();
    renderWalls();
    renderCampfire();
    renderBerries();
    drawVignette();
    renderMinimap();
}

// ============================================
// ЦИКЛ
// ============================================
let lastTime = performance.now();

function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
