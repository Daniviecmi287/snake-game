/**
 * Snake Game — game.js
 * Vanilla JS, no dependencies.
 */

'use strict';

// ─── Constants ────────────────────────────────────────
const COLS        = 20;
const ROWS        = 20;
const CELL        = 20;           // px per cell (canvas 400×400)
const BASE_SPEED  = 150;          // ms per tick (level 1)
const SPEED_STEP  = 10;           // ms faster per level
const MIN_SPEED   = 60;           // fastest possible
const POINTS_STEP = 10;           // score points per food eaten
const LEVEL_EVERY = 5;            // foods eaten to advance a level

// ─── DOM refs ─────────────────────────────────────────
const canvas     = document.getElementById('gameCanvas');
const ctx        = canvas.getContext('2d');
const scoreEl    = document.getElementById('score');
const levelEl    = document.getElementById('level');
const highEl     = document.getElementById('highscore');
const overlay    = document.getElementById('overlay');
const overlayIcon  = document.getElementById('overlayIcon');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMsg   = document.getElementById('overlayMsg');
const startBtn   = document.getElementById('startBtn');

// Mobile buttons
const upBtn    = document.getElementById('upBtn');
const downBtn  = document.getElementById('downBtn');
const leftBtn  = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

// ─── State ────────────────────────────────────────────
let snake, dir, nextDir, food, score, level, foodEaten;
let highScore   = Number(localStorage.getItem('snakeHS') || 0);
let gameLoop    = null;
let isRunning   = false;
let gameOver    = false;
let particles   = [];

// ─── Helpers ──────────────────────────────────────────
const rand = (n) => Math.floor(Math.random() * n);

function spawnFood() {
  let pos;
  do {
    pos = { x: rand(COLS), y: rand(ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

function currentSpeed() {
  return Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_STEP);
}

function popHUD(el) {
  el.classList.remove('pop');
  void el.offsetWidth;       // reflow to restart animation
  el.classList.add('pop');
}

// ─── Particle burst ───────────────────────────────────
function spawnParticles(x, y) {
  const px = x * CELL + CELL / 2;
  const py = y * CELL + CELL / 2;
  for (let i = 0; i < 14; i++) {
    const angle  = Math.random() * Math.PI * 2;
    const speed  = 1.5 + Math.random() * 3;
    particles.push({
      x: px, y: py,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      radius: 2 + Math.random() * 3,
      color: Math.random() > .5 ? '#ff2d78' : '#00ff9d',
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.alpha > 0.05);
  particles.forEach(p => {
    p.x     += p.vx;
    p.y     += p.vy;
    p.vx    *= 0.93;
    p.vy    *= 0.93;
    p.alpha -= 0.045;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ─── Drawing ──────────────────────────────────────────
function drawCell(x, y, color, glow, radius = 3) {
  const px = x * CELL;
  const py = y * CELL;
  const pad = 1;
  ctx.save();
  ctx.shadowColor = glow || color;
  ctx.shadowBlur  = glow ? 12 : 0;
  ctx.fillStyle   = color;
  ctx.beginPath();
  roundRect(ctx, px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, radius);
  ctx.fill();
  ctx.restore();
}

function roundRect(c, x, y, w, h, r) {
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(30,30,46,.55)';
  ctx.lineWidth   = .5;
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, ROWS * CELL);
    ctx.stroke();
  }
  for (let j = 0; j <= ROWS; j++) {
    ctx.beginPath();
    ctx.moveTo(0, j * CELL);
    ctx.lineTo(COLS * CELL, j * CELL);
    ctx.stroke();
  }
}

function drawFood() {
  // Pulsing glow for food
  const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
  ctx.save();
  ctx.shadowColor = '#ff2d78';
  ctx.shadowBlur  = 14 * pulse;
  ctx.fillStyle   = '#ff2d78';
  const px  = food.x * CELL + CELL / 2;
  const py  = food.y * CELL + CELL / 2;
  const r   = (CELL / 2 - 3) * pulse;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnake() {
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const t      = 1 - i / snake.length;   // gradient: 1 at head → 0 at tail
    // interpolate accent green → dark teal
    const lightness = Math.floor(40 + 30 * t);
    const color     = isHead ? '#00ff9d' : `hsl(152, 100%, ${lightness}%)`;
    drawCell(seg.x, seg.y, color, isHead ? '#00ff9d' : null, isHead ? 4 : 2);
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
  drawParticles();
}

// ─── Tick ─────────────────────────────────────────────
function tick() {
  if (!isRunning) return;

  dir = nextDir;

  const head    = snake[0];
  const newHead = {
    x: (head.x + dir.x + COLS) % COLS,
    y: (head.y + dir.y + ROWS) % ROWS,
  };

  // Self collision
  if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
    endGame();
    return;
  }

  snake.unshift(newHead);

  // Ate food?
  if (newHead.x === food.x && newHead.y === food.y) {
    spawnParticles(food.x, food.y);
    foodEaten++;
    score += POINTS_STEP * level;
    scoreEl.textContent = score;
    popHUD(scoreEl);

    if (foodEaten % LEVEL_EVERY === 0) {
      level++;
      levelEl.textContent = level;
      popHUD(levelEl);
      restartLoop();
    }

    food = spawnFood();
  } else {
    snake.pop();
  }

  updateParticles();
  render();
}

// ─── Game control ─────────────────────────────────────
function initState() {
  const midX = Math.floor(COLS / 2);
  const midY = Math.floor(ROWS / 2);
  snake      = [
    { x: midX,     y: midY },
    { x: midX - 1, y: midY },
    { x: midX - 2, y: midY },
  ];
  dir        = { x: 1, y: 0 };
  nextDir    = { x: 1, y: 0 };
  score      = 0;
  level      = 1;
  foodEaten  = 0;
  particles  = [];
  food       = spawnFood();
  scoreEl.textContent = 0;
  levelEl.textContent = 1;
}

function startGame() {
  initState();
  showOverlay(false);
  isRunning = true;
  gameOver  = false;
  restartLoop();
  render();
}

function restartLoop() {
  clearInterval(gameLoop);
  gameLoop = setInterval(tick, currentSpeed());
}

function endGame() {
  isRunning = false;
  clearInterval(gameLoop);
  gameOver = true;

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('snakeHS', highScore);
    highEl.textContent = highScore;
    popHUD(highEl);
  }

  overlayIcon.textContent  = '✕';
  overlayTitle.textContent = 'GAME OVER';
  overlayMsg.textContent   = `Score: ${score}  |  Level: ${level}`;
  startBtn.textContent     = 'PLAY AGAIN';
  showOverlay(true);
  render();
}

function showOverlay(visible) {
  if (visible) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// ─── Input ────────────────────────────────────────────
const DIRS = {
  ArrowUp:    { x: 0,  y: -1 },
  ArrowDown:  { x: 0,  y:  1 },
  ArrowLeft:  { x: -1, y:  0 },
  ArrowRight: { x: 1,  y:  0 },
  w:          { x: 0,  y: -1 },
  s:          { x: 0,  y:  1 },
  a:          { x: -1, y:  0 },
  d:          { x: 1,  y:  0 },
  W:          { x: 0,  y: -1 },
  S:          { x: 0,  y:  1 },
  A:          { x: -1, y:  0 },
  D:          { x: 1,  y:  0 },
};

function tryDir(newDir) {
  // Prevent reversing
  if (newDir.x !== -dir.x || newDir.y !== -dir.y) {
    nextDir = newDir;
  }
}

document.addEventListener('keydown', (e) => {
  if (DIRS[e.key]) {
    e.preventDefault();
    tryDir(DIRS[e.key]);
  }
  if ((e.key === ' ' || e.key === 'Enter') && !isRunning) {
    startGame();
  }
});

// Mobile buttons
upBtn.addEventListener('click',    () => tryDir({ x: 0,  y: -1 }));
downBtn.addEventListener('click',  () => tryDir({ x: 0,  y:  1 }));
leftBtn.addEventListener('click',  () => tryDir({ x: -1, y:  0 }));
rightBtn.addEventListener('click', () => tryDir({ x: 1,  y:  0 }));

startBtn.addEventListener('click', startGame);

// Swipe support (mobile)
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    tryDir(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
  } else {
    tryDir(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
  }
  touchStart = null;
}, { passive: true });

// ─── Init ─────────────────────────────────────────────
highEl.textContent = highScore;
initState();
render();
