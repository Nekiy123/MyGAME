// ============================================
// HORROR GAME — Прототип
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

// ============================================
// ЗВЁЗДЫ НА НЕБЕ (генерируем один раз)
// ============================================
const stars = [];
for (let i = 0; i < 250; i++) {
    stars.push({
        x: Math.random(),
        y: Math.random() * 0.55, // только верхняя часть
        size: Math.random() * 1.8 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 2 + 0.5
    });
}

// ============================================
// ИГРОК
// ============================================
const player = {
    x: 0,
    z: 0,
    y: 0,           // высота (прыжок)
    vy: 0,          // скорость по вертикали
    height: 1.7,    // рост (для камеры)
    speed: 4.5,     // скорость ходьбы
    angle: 0,       // поворот камеры
    onGround: true,
    jumpPower: 6.5,
    gravity: 18
};

// ============================================
// УПРАВЛЕНИЕ — ДЖОЙСТИК
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

function setJoystickCenter() {
    const rect = joystickBase.getBoundingClientRect();
    joystick.centerX = rect.left + rect.width / 2;
    joystick.centerY = rect.top + rect.height / 2;
}

// Позиционируем джойстик при старте
window.addEventListener('load', setJoystickCenter);
window.addEventListener('resize', setJoystickCenter);

function handleJoyStart(e) {
    const touch = e.changedTouches[0];
    joystick.active = true;
    joystick.touchId = touch.identifier;
    
    // Перемещаем базу джойстика под палец
    const rect = joystickZone.getBoundingClientRect();
    const localX = touch.clientX - rect.left;
    const localY = touch.clientY - rect.top;
    
    joystickBase.style.left = (localX - 70) + 'px';
    joystickBase.style.bottom = 'auto';
    joystickBase.style.top = (localY - 70) + 'px';
    
    setJoystickCenter();
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
    jumpButton.classList.add('pressed');
    jump();
}, { passive: false });

jumpButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    jumpButton.classList.remove('pressed');
}, { passive: false });

// Управление мышью (для теста на ПК)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') jump();
});

// ============================================
// РЕНДЕР
// ============================================
const TILE_SIZE = 2; // размер плитки

function drawSky() {
    // Чёрное небо (градиент от чёрного к тёмно-синему у горизонта)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    skyGrad.addColorStop(0, '#000000');
    skyGrad.addColorStop(0.7, '#02020a');
    skyGrad.addColorStop(1, '#050510');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.65);
    
    // Смещение неба от поворота камеры
    const skyOffset = (player.angle / (Math.PI * 2)) * W * 2;
    
    // Звёзды
    const time = performance.now() / 1000;
    for (const star of stars) {
        let sx = (star.x * W * 2 - skyOffset) % (W * 2);
        if (sx < 0) sx += W * 2;
        if (sx > W) continue; // за экраном
        
        const sy = star.y * H * 0.65;
        const alpha = 0.5 + Math.sin(time * star.speed + star.twinkle) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Свечение у крупных звёзд
        if (star.size > 1.3) {
            ctx.globalAlpha = alpha * 0.3;
            ctx.beginPath();
            ctx.arc(sx, sy, star.size * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
    
    // Луна по центру неба (с учётом поворота — плавно появляется)
    const moonX = W / 2;
    const moonY = H * 0.18;
    const moonR = 55;
    
    // Свечение вокруг луны
    const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 5);
    glow.addColorStop(0, 'rgba(220, 220, 255, 0.35)');
    glow.addColorStop(0.4, 'rgba(180, 180, 220, 0.12)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Диск луны
    ctx.fillStyle = '#e8e8f0';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    
    // Кратеры (лёгкие)
    ctx.fillStyle = 'rgba(180, 180, 200, 0.6)';
    ctx.beginPath();
    ctx.arc(moonX - 15, moonY - 12, 8, 0, Math.PI * 2);
    ctx.arc(moonX + 12, moonY + 8, 6, 0, Math.PI * 2);
    ctx.arc(moonX - 5, moonY + 18, 5, 0, Math.PI * 2);
    ctx.fill();
}

function drawFloor() {
    const horizon = H * 0.65;
    
    // Тёмный пол с плиткой
    const floorGrad = ctx.createLinearGradient(0, horizon, 0, H);
    floorGrad.addColorStop(0, '#0a0a0d');
    floorGrad.addColorStop(1, '#151518');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizon, W, H - horizon);
    
    // ========================================
    // ПЕРСПЕКТИВНАЯ ПЛИТКА
    // ========================================
    // Псевдо-3D: рисуем линии в перспективе
    
    const camX = player.x;
    const camZ = player.z;
    const camAngle = player.angle;
    const camY = player.y + player.height; // высота камеры над полом
    
    ctx.strokeStyle = 'rgba(80, 80, 90, 0.7)';
    ctx.lineWidth = 1.5;
    
    // Продольные линии (вдоль направления взгляда) — рисуем сетку
    // Используем простую проекцию: для каждой точки мира вычисляем экранные координаты
    // Через raycasting по линиям сетки
    
    // Поперечные линии (горизонтальные полосы в мире) — приближаем
    const maxDist = 40;
    for (let i = 1; i <= 20; i++) {
        const dist = i * TILE_SIZE;
        if (dist > maxDist) break;
        
        // Проекция: чем дальше, тем ближе к горизонту
        const screenY = horizon + (H - horizon) * (camY / (camY + dist * 0.9));
        
        // Смещение по X от поворота камеры — для поперечных линий оно 0 (они параллельны)
        // Но если камера смотрит вбок, они всё равно отображаются
        
        // Затемнение по расстоянию
        const alpha = Math.max(0, 1 - dist / maxDist) * 0.6;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(W, screenY);
        ctx.stroke();
    }
    
    // Продольные линии — вертикальные полосы мира
    // Тут сложнее, используем raycast-подобный подход
    // Упрощённо: рисуем линии с шагом по X в мире, проецируя на экран
    
    const fov = Math.PI / 3; // 60 градусов
    const halfW = W / 2;
    
    // Смещение сетки по X в мире
    const startX = Math.floor(camX / TILE_SIZE) * TILE_SIZE - 20;
    
    for (let wx = startX; wx < camX + 20; wx += TILE_SIZE) {
        // Угол до линии относительно направления камеры
        const dx = wx - camX;
        
        // Проецируем несколько точек вдоль Z
        let prevSX = null, prevSY = null;
        
        for (let dz = 1; dz <= maxDist; dz += 1) {
            const worldZ = camZ + dz;
            
            // Вектор от камеры к точке
            const rx = wx - camX;
            const rz = worldZ - camZ;
            
            // Поворот в систему камеры
            const cosA = Math.cos(-camAngle);
            const sinA = Math.sin(-camAngle);
            const camSpaceX = rx * cosA - rz * sinA;
            const camSpaceZ = rx * sinA + rz * cosA;
            
            if (camSpaceZ <= 0.1) continue;
            
            const screenX = halfW + (camSpaceX / camSpaceZ) * halfW / Math.tan(fov / 2);
            const distToPoint = Math.hypot(rx, rz);
            const screenY = horizon + (H - horizon) * (camY / (camY + distToPoint * 0.9));
            
            if (prevSX !== null) {
                const alpha = Math.max(0, 1 - distToPoint / maxDist) * 0.7;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(prevSX, prevSY);
                ctx.lineTo(screenX, screenY);
                ctx.stroke();
            }
            
            prevSX = screenX;
            prevSY = screenY;
            
            // Не рисуем слишком далеко
            if (Math.abs(screenX) > W * 3) break;
        }
    }
    
    ctx.globalAlpha = 1;
    
    // Туман у горизонта (мрачная атмосфера)
    const fogGrad = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 60);
    fogGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fogGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.85)');
    fogGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, horizon - 40, W, 100);
}

function drawVignette() {
    // Тёмная виньетка по краям для мрачности
    const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H) * 0.3, W/2, H/2, Math.max(W,H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

// ============================================
// ИГРОВОЙ ЦИКЛ
// ============================================
let lastTime = performance.now();

function update(dt) {
    // Движение от джойстика
    if (joystick.active) {
        const jx = joystick.dx / joystick.maxDist;
        const jy = joystick.dy / joystick.maxDist;
        
        // Вперёд/назад
        const forward = -jy;
        // Влево/вправо — поворот камеры
        const turn = jx;
        
        // Поворот
        player.angle += turn * 2.2 * dt;
        
        // Движение вперёд/назад с учётом угла
        const moveX = Math.sin(player.angle) * forward * player.speed * dt;
        const moveZ = Math.cos(player.angle) * forward * player.speed * dt;
        player.x += moveX;
        player.z += moveZ;
    }
    
    // Прыжок / гравитация
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

function render() {
    ctx.clearRect(0, 0, W, H);
    
    drawSky();
    drawFloor();
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
