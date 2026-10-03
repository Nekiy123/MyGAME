// ============================================
// FOREST — Прототип v4 (лес + выживание)
// ============================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let W = window.innerWidth;
let H = window.innerHeight;

function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));

// ============================================
// БЛОКИРОВКА ОРИЕНТАЦИИ
// ============================================
function lockLandscape() {
    if (screen.orientation && 'lock' in screen.orientation) {
        screen.orientation.lock('landscape').catch(() => {});
    }
}
lockLandscape();
document.addEventListener('touchstart', () => lockLandscape(), { once: true });

// ============================================
// ПОЛНОЭКРАННЫЙ
// ============================================
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
// ЗВЁЗДЫ
// ============================================
const stars = [];
for (let i = 0; i < 300; i++) {
    stars.push({
        x: Math.random(),
        y: Math.random() * 0.6,
        size: Math.random() * 1.8 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 2 + 0.5
    });
}

// ============================================
// КАРТА ЛЕСА
// ============================================
// T = дерево (стена), . = пусто, R = ручей (проходимо но темнее), C = костёр (центр)
const MAP_SIZE = 30;
const CELL = 3;

const MAP = [];
// Генерируем карту: рамка из деревьев + случайные деревья внутри
for (let z = 0; z < MAP_SIZE; z++) {
    let row = '';
    for (let x = 0; x < MAP_SIZE; x++) {
        // Границы — всегда деревья
        if (x === 0 || z === 0 || x === MAP_SIZE - 1 || z === MAP_SIZE - 1) {
            row += 'T';
        } else {
            // Случайные деревья, но не в центре и не в стартовой зоне
            const cx = MAP_SIZE / 2;
            const cz = MAP_SIZE / 2;
            const distToCenter = Math.hypot(x - cx, z - cz);
            
            // Поляна вокруг центра (радиус 4)
            if (distToCenter < 4) {
                row += '.';
            } else if (Math.random() < 0.35) {
                // Плотность деревьев
                row += 'T';
            } else {
                row += '.';
            }
        }
    }
    MAP.push(row);
}

// Убеждаемся что центр пустой (для костра)
const MID = Math.floor(MAP_SIZE / 2);
MAP[MID] = MAP[MID].substring(0, MID) + 'C' + MAP[MID].substring(MID + 1);

function getCell(worldX, worldZ) {
    const gx = Math.floor(worldX / CELL);
    const gz = Math.floor(worldZ / CELL);
    if (gx < 0 || gz < 0 || gx >= MAP_SIZE || gz >= MAP_SIZE) return 'T';
    return MAP[gz][gx];
}

function isWall(worldX, worldZ) {
    return getCell(worldX, worldZ) === 'T';
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
// ЯГОДЫ (собираемые)
// ============================================
const berryBushes = [];
for (let i = 0; i < 25; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const gx = 1 + Math.floor(Math.random() * (MAP_SIZE - 2));
        const gz = 1 + Math.floor(Math.random() * (MAP_SIZE - 2));
        if (MAP[gz][gx] === '.') {
            // Не в центре у костра
            const distToCenter = Math.hypot(gx - MID, gz - MID);
            if (distToCenter > 5) {
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
    x: (MID + 0.5) * CELL + CELL,  // рядом с костром
    z: (MID + 0.5) * CELL,
    y: 0,
    vy: 0,
    height: 1.6,
    speed: 4,
    angle: 0,
    pitch: 0,
    onGround: true,
    jumpPower: 6.5,
    gravity: 20,
    radius: 0.35,
    // Выживание
    hp: 100,
    maxHp: 100,
    hunger: 100,
    maxHunger: 100,
    berries: 0,
    alive: true,
    // Фонарик
    flashlight: false,
    battery: 100
};

// ============================================
// ДЖОЙСТИК
// ============================================
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');

const joystick = {
    active: false,
    touchId: null,
    centerX: 0,
    centerY: 0,
    dx: 0,
    dy: 0,
    maxDist: 55
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
    
    joystick.dx = 0; joystick.dy = 0;
    joystickKnob.style.transform = 'translate(0,0)';
    e.preventDefault();
}
function handleJoyMove(e) {
    if (!joystick.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joystick.touchId) {
            let dx = touch.clientX - joystick.centerX;
            let dy = touch.clientY - joystick.centerY;
            const dist = Math.hypot(dx, dy);
            if (dist > joystick.maxDist) {
                dx = dx / dist * joystick.maxDist;
                dy = dy / dist * joystick.maxDist;
            }
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
    const touch = e.changedTouches[0];
    look.active = true;
    look.touchId = touch.identifier;
    look.lastX = touch.clientX;
    look.lastY = touch.clientY;
    e.preventDefault();
}
function handleLookMove(e) {
    if (!look.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === look.touchId) {
            const dx = touch.clientX - look.lastX;
            const dy = touch.clientY - look.lastY;
            player.angle += dx * 0.005;
            player.pitch -= dy * 0.005;
            const mp = Math.PI / 2 - 0.15;
            if (player.pitch > mp) player.pitch = mp;
            if (player.pitch < -mp) player.pitch = -mp;
            look.lastX = touch.clientX;
            look.lastY = touch.clientY;
        }
    }
    e.preventDefault();
}
function handleLookEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === look.touchId) {
            look.active = false;
            look.touchId = null;
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
lookZone.addEventListener('mousedown', (e) => {
    mouseDown = true;
    look.lastX = e.clientX; look.lastY = e.clientY;
});
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
// КНОПКИ ДЕЙСТВИЙ
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
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        onDown();
    });
}

// Прыжок
bindButton('jump-button', () => {
    if (!player.alive) return;
    if (player.onGround) {
        player.vy = player.jumpPower;
        player.onGround = false;
    }
});
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && player.onGround && player.alive) {
        player.vy = player.jumpPower;
        player.onGround = false;
    }
});

// Собрать
bindButton('collect-button', () => {
    if (!player.alive) return;
    let closest = null;
    let closestDist = 2.5;
    for (const b of berryBushes) {
        if (b.collected) continue;
        const d = Math.hypot(b.x - player.x, b.z - player.z);
        if (d < closestDist) {
            closestDist = d;
            closest = b;
        }
    }
    if (closest) {
        closest.collected = true;
        closest.respawnAt = performance.now() + 30000;
        player.berries++;
        showHint('+1 🍓');
    } else {
        showHint('Рядом нет ягод');
    }
});

// Фонарик
const flashBtn = document.getElementById('flashlight-button');
bindButton('flashlight-button', () => {
    if (!player.alive) return;
    if (player.battery <= 0) {
        showHint('Батарея разряжена');
        return;
    }
    player.flashlight = !player.flashlight;
    if (player.flashlight) {
        flashBtn.classList.add('active');
    } else {
        flashBtn.classList.remove('active');
    }
});

// Съесть ягоду
bindButton('eat-button', () => {
    if (!player.alive) return;
    if (player.berries > 0 && player.hunger < 100) {
        player.berries--;
        player.hunger = Math.min(100, player.hunger + 25);
        showHint('🍓 +25 сытости');
    } else if (player.berries === 0) {
        showHint('Нет ягод');
    } else {
        showHint('Ты не голоден');
    }
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
    for (const [cx, cz] of checks) {
        if (isWall(cx, cz)) return false;
    }
    return true;
}

// ============================================
// РЕНДЕР НЕБА
// ============================================
function drawSky() {
    ctx.save();
    const pitchOffset = player.pitch * H * 0.8;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(0, pitchOffset);
    
    const time = performance.now() / 1000;
    const skyOffset = (player.angle / (Math.PI * 2)) * W * 2;
    
    for (const star of stars) {
        let sx = (star.x * W * 2 - skyOffset) % (W * 2);
        if (sx < 0) sx += W * 2;
        if (sx > W) continue;
        const sy = star.y * H;
        const alpha = 0.5 + Math.sin(time * star.speed + star.twinkle) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Луна
    const moonX = W / 2, moonY = H * 0.25, moonR = 50;
    const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 5);
    glow.addColorStop(0, 'rgba(220, 220, 255, 0.35)');
    glow.addColorStop(0.4, 'rgba(180, 180, 220, 0.12)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#e8e8f0';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// ============================================
// РЕЙКАСТИНГ С ДЕРЕВЬЯМИ
// ============================================
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;

function castRay(rayAngle) {
    const cos = Math.cos(rayAngle);
    const sin = Math.sin(rayAngle);
    const step = 0.1;
    let dist = 0;
    const maxDist = 35;
    while (dist < maxDist) {
        dist += step;
        const x = player.x + cos * dist;
        const z = player.z + sin * dist;
        if (isWall(x, z)) return dist;
    }
    return maxDist;
}

function renderWalls() {
    const horizon = H / 2 + player.pitch * H * 0.8;
    const numRays = Math.floor(W / 3);
    const rayStep = W / numRays;
    
    // Расчёт освещения
    const fireDist = Math.hypot(campfire.x - player.x, campfire.z - player.z);
    
    for (let i = 0; i < numRays; i++) {
        const screenX = i * rayStep;
        const rayAngle = player.angle - HALF_FOV + (i / numRays) * FOV;
        
        const dist = castRay(rayAngle);
        const correctedDist = dist * Math.cos(rayAngle - player.angle);
        
        // Высота ствола дерева
        const wallHeight = (CELL * 1.8 * H) / correctedDist * 0.9;
        const wallTop = horizon - wallHeight / 2 + (player.height - 1.6) * H / correctedDist;
        
        // Освещение
        let brightness = Math.max(0, 1 - correctedDist / 15) * 0.4;
        
        // Свет от фонарика
        const rayOffset = (i / numRays) - 0.5;
        if (player.flashlight && Math.abs(rayOffset) < 0.4) {
            const falloff = 1 - Math.abs(rayOffset) / 0.4;
            brightness += falloff * Math.max(0, 1 - correctedDist / 20) * 0.7;
        }
        
        // Свет от костра
        const fireFalloff = Math.max(0, 1 - fireDist / campfire.radius);
        brightness += fireFalloff * 0.3;
        
        // Цвет ствола (коричневый) + освещение
        const r = Math.floor(60 * brightness + 15);
        const g = Math.floor(40 * brightness + 10);
        const b = Math.floor(25 * brightness + 8);
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(screenX, wallTop, rayStep + 1, wallHeight);
        
        // Полоски коры
        if (i % 3 === 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * brightness})`;
            ctx.fillRect(screenX, wallTop, 1, wallHeight);
        }
    }
}

// ============================================
// РЕНДЕР ПОЛА (земля)
// ============================================
function renderFloor() {
    const horizon = H / 2 + player.pitch * H * 0.8;
    
    const floorGrad = ctx.createLinearGradient(0, horizon, 0, H);
    floorGrad.addColorStop(0, '#000');
    floorGrad.addColorStop(0.3, '#0a0805');
    floorGrad.addColorStop(1, '#100c08');
    
    if (horizon < H) {
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, Math.max(0, horizon), W, H - Math.max(0, horizon));
    }
    
    if (horizon >= H) return;
    
    // Сетка "травы" — горизонтальные линии
    const floorTop = Math.max(0, horizon);
    const camY = player.height + player.y;
    
    for (let d = 1; d < 20; d++) {
        const worldZ = d * CELL;
        const screenY = horizon + (H - horizon) * (camY / (camY + worldZ * 0.7));
        if (screenY < floorTop || screenY > H) continue;
        
        const alpha = Math.max(0, 1 - d / 15) * 0.25;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#3a2a15';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(W, screenY);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// ============================================
// РЕНДЕР КОСТРА (если близко)
// ============================================
function renderCampfire() {
    const dx = campfire.x - player.x;
    const dz = campfire.z - player.z;
    const dist = Math.hypot(dx, dz);
    
    if (dist > 20) return;
    
    // Угол к костру относительно направления камеры
    let angleToFire = Math.atan2(dx, dz) - player.angle;
    while (angleToFire > Math.PI) angleToFire -= Math.PI * 2;
    while (angleToFire < -Math.PI) angleToFire += Math.PI * 2;
    
    if (Math.abs(angleToFire) > HALF_FOV + 0.2) return;
    
    const horizon = H / 2 + player.pitch * H * 0.8;
    
    // Экранная X
    const screenX = W / 2 + (angleToFire / HALF_FOV) * (W / 2);
    
    // Размер пламени
    const size = Math.max(10, (200 / dist));
    const screenY = horizon + (H - horizon) * (1 / (1 + dist * 0.5)) - size * 0.3;
    
    // Свечение
    const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size * 2);
    glow.addColorStop(0, `rgba(255, 180, 60, ${Math.max(0, 1 - dist / 15) * 0.9})`);
    glow.addColorStop(0.5, `rgba(255, 100, 20, ${Math.max(0, 1 - dist / 15) * 0.4})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY, size * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Пламя (простой треугольник)
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
// РЕНДЕР ЯГОД
// ============================================
function renderBerries() {
    const horizon = H / 2 + player.pitch * H * 0.8;
    
    for (const b of berryBushes) {
        if (b.collected) continue;
        
        const dx = b.x - player.x;
        const dz = b.z - player.z;
        const dist = Math.hypot(dx, dz);
        
        if (dist > 18 || dist < 0.3) continue;
        
        let angleToB = Math.atan2(dx, dz) - player.angle;
        while (angleToB > Math.PI) angleToB -= Math.PI * 2;
        while (angleToB < -Math.PI) angleToB += Math.PI * 2;
        
        if (Math.abs(angleToB) > HALF_FOV + 0.2) continue;
        
        const screenX = W / 2 + (angleToB / HALF_FOV) * (W / 2);
        
        // Позиция на полу
        const screenY = horizon + (H - horizon) * (player.height / (player.height + dist * 0.5));
        
        const size = Math.max(4, 80 / dist);
        
        // Куст
        ctx.fillStyle = `rgba(30, ${Math.min(80, Math.floor(60 + 100 / dist))}, 20, 0.9)`;
        ctx.beginPath();
        ctx.arc(screenX, screenY - size * 0.3, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Ягоды (красные точки)
        ctx.fillStyle = '#cc2233';
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
// ВИНЬЕТКА + ТЕМНОТА
// ============================================
function drawVignette() {
    // Общая темнота ночи
    let darkness = 0.75;
    if (player.flashlight) darkness = 0.55;
    
    // Если у костра — светлее
    const fireDist = Math.hypot(campfire.x - player.x, campfire.z - player.z);
    if (fireDist < campfire.radius) {
        darkness -= 0.3 * (1 - fireDist / campfire.radius);
    }
    
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, darkness)})`;
    ctx.fillRect(0, 0, W, H);
    
    // Виньетка
    const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H) * 0.3, W/2, H/2, Math.max(W,H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ============================================
// HUD
// ============================================
const healthBar = document.getElementById('health-bar');
const hungerBar = document.getElementById('hunger-bar');
const batteryBar = document.getElementById('battery-bar');
const berriesEl = document.getElementById('berries');

function updateHUD() {
    healthBar.style.width = Math.max(0, player.hp) + '%';
    hungerBar.style.width = Math.max(0, player.hunger) + '%';
    batteryBar.style.width = Math.max(0, player.battery) + '%';
    berriesEl.textContent = player.berries;
}

// ============================================
// СМЕРТЬ / РЕСПАВН
// ============================================
const deathScreen = document.getElementById('death-screen');
const deathReason = document.getElementById('death-reason');
const respawnBtn = document.getElementById('respawn-btn');
const damageFlash = document.getElementById('damage-flash');

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
    player.x = (MID + 0.5) * CELL + CELL;
    player.z = (MID + 0.5) * CELL;
    player.y = 0;
    player.vy = 0;
    player.angle = 0;
    player.pitch = 0;
    deathScreen.classList.remove('show');
});

// ============================================
// ОБНОВЛЕНИЕ
// ============================================
let hungerTimer = 0;
let batteryTimer = 0;

function update(dt) {
    if (!player.alive) return;
    
    // Движение
    if (joystick.active) {
        const jx = joystick.dx / joystick.maxDist;
        const jy = joystick.dy / joystick.maxDist;
        const dz = 0.15;
        const mx = Math.abs(jx) < dz ? 0 : jx;
        const my = Math.abs(jy) < dz ? 0 : jy;
        
        const forward = -my;
        const strafe = mx;
        
        const sinA = Math.sin(player.angle);
        const cosA = Math.cos(player.angle);
        
        const moveX = (sinA * forward + cosA * strafe) * player.speed * dt;
        const moveZ = (cosA * forward - sinA * strafe) * player.speed * dt;
        
        if (tryMove(player.x + moveX, player.z)) player.x += moveX;
        if (tryMove(player.x, player.z + moveZ)) player.z += moveZ;
    }
    
    // Прыжок
    if (!player.onGround) {
        player.vy -= player.gravity * dt;
        player.y += player.vy * dt;
        if (player.y <= 0) {
            player.y = 0; player.vy = 0; player.onGround = true;
        }
    }
    
    // Голод (падает на 2 в секунду / 60 = медленно)
    hungerTimer += dt;
    if (hungerTimer > 3) {
        hungerTimer = 0;
        player.hunger = Math.max(0, player.hunger - 1);
    }
    
    // Урон от голода
    if (player.hunger <= 0) {
        player.hp -= 5 * dt;
        if (player.hp <= 0) die('Ты умер от голода');
    }
    
    // Регенерация у костра
    const fireDist = Math.hypot(campfire.x - player.x, campfire.z - player.z);
    if (fireDist < campfire.radius && player.hunger > 50) {
        player.hp = Math.min(player.maxHp, player.hp + 3 * dt);
    }
    
    // Батарея фонарика
    if (player.flashlight) {
        batteryTimer += dt;
        if (batteryTimer > 0.5) {
            batteryTimer = 0;
            player.battery = Math.max(0, player.battery - 1);
            if (player.battery <= 0) {
                player.flashlight = false;
                document.getElementById('flashlight-button').classList.remove('active');
                showHint('Батарея разряжена');
            }
        }
    }
    
    // Респавн ягод
    const now = performance.now();
    for (const b of berryBushes) {
        if (b.collected && now > b.respawnAt) {
            b.collected = false;
        }
    }
    
    updateHUD();
}

// ============================================
// РЕНДЕР
// ============================================
function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    
    drawSky();
    renderFloor();
    renderWalls();
    renderCampfire();
    renderBerries();
    drawVignette();
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
