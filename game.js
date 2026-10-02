// ============================================
// HORROR GAME — Прототип v2
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
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

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
// КАРТА / СТЕНЫ
// ============================================
// 1 = стена, 0 = пусто
// Простой лабиринт 16x16
const MAP = [
    "1111111111111111",
    "1000000000000001",
    "1011110111110101",
    "1010000100000101",
    "1010110101110101",
    "1000100001000101",
    "1111101111011101",
    "1000001000010001",
    "1011111011010111",
    "1010000010010001",
    "1010111110011101",
    "1000100000000101",
    "1111101111110101",
    "1000001000000101",
    "1011111011111101",
    "1111111111111111"
];

const MAP_SIZE = MAP.length;
const CELL = 3; // размер клетки в мировых единицах

function isWall(worldX, worldZ) {
    const gx = Math.floor(worldX / CELL);
    const gz = Math.floor(worldZ / CELL);
    if (gx < 0 || gz < 0 || gx >= MAP_SIZE || gz >= MAP_SIZE) return true;
    return MAP[gz][gx] === '1';
}

// ============================================
// ИГРОК
// ============================================
const player = {
    x: 1.5 * CELL,     // стартовая позиция (внутри первой комнаты)
    z: 1.5 * CELL,
    y: 0,
    vy: 0,
    height: 1.6,
    speed: 5,
    angle: 0,          // горизонтальный поворот (yaw)
    pitch: 0,          // вертикальный поворот
    onGround: true,
    jumpPower: 6.5,
    gravity: 20,
    radius: 0.3
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
    maxDist: 55,
    baseX: 0,
    baseY: 0
};

function initJoystickPosition() {
    const rect = joystickZone.getBoundingClientRect();
    joystick.baseX = rect.left + 60 + 70;  // left + half base
    joystick.baseY = rect.top + rect.height / 2;
    joystickBase.style.left = '60px';
    joystickBase.style.top = '50%';
    joystickBase.style.transform = 'translateY(-50%)';
}
setTimeout(initJoystickPosition, 100);
window.addEventListener('resize', () => setTimeout(initJoystickPosition, 100));
window.addEventListener('orientationchange', () => setTimeout(initJoystickPosition, 300));

function handleJoyStart(e) {
    const touch = e.changedTouches[0];
    joystick.active = true;
    joystick.touchId = touch.identifier;
    
    // Центр джойстика = точка касания
    joystick.centerX = touch.clientX;
    joystick.centerY = touch.clientY;
    
    // Визуально перемещаем базу джойстика к точке касания
    const rect = joystickZone.getBoundingClientRect();
    const localX = touch.clientX - rect.left;
    const localY = touch.clientY - rect.top;
    joystickBase.style.left = (localX - 70) + 'px';
    joystickBase.style.top = (localY - 70) + 'px';
    joystickBase.style.transform = 'none';
    
    joystick.dx = 0;
    joystick.dy = 0;
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
            joystick.dx = dx;
            joystick.dy = dy;
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
            joystick.dx = 0;
            joystick.dy = 0;
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
// ОБЗОР (свайп по правой части экрана)
// ============================================
const lookZone = document.getElementById('look-zone');
const look = {
    active: false,
    touchId: null,
    lastX: 0,
    lastY: 0
};

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
            
            // Чувствительность
            player.angle += dx * 0.005;
            player.pitch -= dy * 0.005;
            
            // Ограничение вертикали
            const maxPitch = Math.PI / 2 - 0.15;
            if (player.pitch > maxPitch) player.pitch = maxPitch;
            if (player.pitch < -maxPitch) player.pitch = -maxPitch;
            
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

// Управление мышью (для ПК-теста)
let mouseDown = false;
lookZone.addEventListener('mousedown', (e) => { mouseDown = true; look.lastX = e.clientX; look.lastY = e.clientY; });
window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    const dx = e.clientX - look.lastX;
    const dy = e.clientY - look.lastY;
    player.angle += dx * 0.005;
    player.pitch -= dy * 0.005;
    const maxPitch = Math.PI / 2 - 0.15;
    if (player.pitch > maxPitch) player.pitch = maxPitch;
    if (player.pitch < -maxPitch) player.pitch = -maxPitch;
    look.lastX = e.clientX;
    look.lastY = e.clientY;
});
window.addEventListener('mouseup', () => mouseDown = false);

// ============================================
// КНОПКА ПРЫЖКА
// ============================================
const jumpButton = document.getElementById('jump-button');

function jump() {
    if (player.onGround) {
        player.vy = player.jumpPower;
        player.onGround = false;
    }
}

jumpButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    jumpButton.classList.add('pressed');
    jump();
}, { passive: false });

jumpButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    jumpButton.classList.remove('pressed');
}, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') jump();
});

// ============================================
// КОЛЛИЗИИ
// ============================================
function tryMove(nx, nz) {
    const r = player.radius;
    // Проверяем 4 угла (приближённо)
    const checks = [
        [nx - r, nz - r],
        [nx + r, nz - r],
        [nx - r, nz + r],
        [nx + r, nz + r]
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
    
    // Смещаем небо в зависимости от pitch
    const pitchOffset = player.pitch * H * 0.8;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    
    ctx.translate(0, pitchOffset);
    
    // Звёзды
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
        if (star.size > 1.3) {
            ctx.globalAlpha = alpha * 0.3;
            ctx.beginPath();
            ctx.arc(sx, sy, star.size * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
    
    // Луна
    const moonX = W / 2;
    const moonY = H * 0.25;
    const moonR = 50;
    
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
    
    ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
    ctx.beginPath();
    ctx.arc(moonX - 15, moonY - 12, 8, 0, Math.PI * 2);
    ctx.arc(moonX + 12, moonY + 8, 6, 0, Math.PI * 2);
    ctx.arc(moonX - 5, moonY + 18, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// ============================================
// РЕЙКАСТИНГ ПО СТЕНАМ (псевдо-3D)
// ============================================
const FOV = Math.PI / 3; // 60°
const HALF_FOV = FOV / 2;

function castRay(rayAngle) {
    // Возвращает расстояние до ближайшей стены
    const cos = Math.cos(rayAngle);
    const sin = Math.sin(rayAngle);
    
    const step = 0.05;
    let dist = 0;
    const maxDist = 40;
    
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
    const numRays = Math.floor(W / 2); // 1 луч на 2 пикселя — быстрее
    const rayStep = W / numRays;
    const cosCorrection = Math.cos(FOV / 2);
    
    // Для каждой колонки пикселей
    for (let i = 0; i < numRays; i++) {
        const screenX = i * rayStep;
        
        // Угол луча
        const rayAngle = player.angle - HALF_FOV + (i / numRays) * FOV;
        
        const dist = castRay(rayAngle);
        // Устраняем fish-eye
        const correctedDist = dist * Math.cos(rayAngle - player.angle);
        
        // Высота стены на экране
        const wallHeight = (CELL * H) / correctedDist * 0.9;
        const wallTop = horizon - wallHeight / 2 + (player.height - 1.6) * H / correctedDist;
        const wallBottom = wallTop + wallHeight;
        
        // Затемнение по расстоянию
        let brightness = Math.max(0, 1 - correctedDist / 20);
        brightness = brightness * 0.7 + 0.05;
        
        // Оттенок стен (серый с холодным отливом)
        const r = Math.floor(70 * brightness);
        const g = Math.floor(75 * brightness);
        const b = Math.floor(90 * brightness);
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(screenX, wallTop, rayStep + 1, wallHeight);
        
        // Тёмная обводка для контуров (псевдо-текстура)
        if (i % 4 === 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * brightness})`;
            ctx.fillRect(screenX, wallTop, 1, wallHeight);
        }
    }
}

// ============================================
// РЕНДЕР ПОЛА
// ============================================
function renderFloor() {
    const horizon = H / 2 + player.pitch * H * 0.8;
    
    // Градиент пола
    const floorGrad = ctx.createLinearGradient(0, horizon, 0, H);
    floorGrad.addColorStop(0, '#000');
    floorGrad.addColorStop(0.3, '#0a0a0d');
    floorGrad.addColorStop(1, '#101013');
    
    // Рисуем пол только ниже горизонта, если горизонт на экране
    if (horizon < H) {
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, Math.max(0, horizon), W, H - Math.max(0, horizon));
    }
    
    // Сетка плитки — рисуем лучами вниз
    if (horizon >= H) return;
    
    const floorTop = Math.max(0, horizon);
    
    // Горизонтальные линии плитки (по Z)
    const camY = player.height + player.y;
    for (let d = 1; d < 25; d++) {
        const worldZ = d * CELL;
        // Приближение для горизонтальной линии
        const screenY = horizon + (H - horizon) * (camY / (camY + worldZ * 0.7));
        if (screenY < floorTop || screenY > H) continue;
        
        const alpha = Math.max(0, 1 - d / 20) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#4a4a55';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(W, screenY);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// ============================================
// ВИНЬЕТКА
// ============================================
function drawVignette() {
    const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H) * 0.3, W/2, H/2, Math.max(W,H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ============================================
// ОБНОВЛЕНИЕ
// ============================================
function update(dt) {
    // Движение от джойстика
    if (joystick.active) {
        const jx = joystick.dx / joystick.maxDist;  // -1..1
        const jy = joystick.dy / joystick.maxDist;
        
        // Deadzone
        const deadzone = 0.15;
        const mx = Math.abs(jx) < deadzone ? 0 : jx;
        const my = Math.abs(jy) < deadzone ? 0 : jy;
        
        // jy: вверх = -1 (вперёд), вниз = +1 (назад)
        const forward = -my;
        const strafe = mx;
        
        // Вектор движения в мировых координатах
        const sinA = Math.sin(player.angle);
        const cosA = Math.cos(player.angle);
        
        const moveX = (sinA * forward + cosA * strafe) * player.speed * dt;
        const moveZ = (cosA * forward - sinA * strafe) * player.speed * dt;
        
        // Коллизии по X и Z отдельно (скольжение по стенам)
        if (tryMove(player.x + moveX, player.z)) {
            player.x += moveX;
        }
        if (tryMove(player.x, player.z + moveZ)) {
            player.z += moveZ;
        }
    }
    
    // Прыжок
    if (!player.onGround) {
        player.vy -= player.gravity * dt;
        player.y += player.vy * dt;
        if (player.y <= 0) {
            player.y = 0;
            player.vy = 0;
            player.onGround = true;
        }
    }
}

// ============================================
// ЦИКЛ
// ============================================
let lastTime = performance.now();

function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    
    drawSky();
    renderFloor();
    renderWalls();
    drawVignette();
}

function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    
    update(dt);
    render();
    
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
