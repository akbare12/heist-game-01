// main.js — MIDNIGHT VAULT game loop, input, alarm, tools, state machine.
// One thief crosses four rooms. Guards patrol with vision cones, cameras
// sweep, loot pays for tools, the alarm climbs while you are seen and drains
// while you hide. Reach the exit with the quota to move on; clear room 4
// to escape. Keyboard + mouse, offline, no network.

import { LEVELS, ROOM } from './levels.js';
import { pointInShadow } from './vision.js';
import { makeGuard, updateGuard, guardSpotStrength, drawGuard, GUARD_SPOT_RATE } from './guards.js';
import { makeCamera, updateCamera, cameraSpotStrength, drawCamera, CAMERA_SPOT_RATE } from './cameras.js';
import { makeLoot, nearestLoot, updateLockpick, grabLoot, drawLoot, LOCKPICK_HOLD_SECONDS } from './loot.js';
import {
  TOOL_BUTTONS, TOOL_COSTS,
  drawTopBar, drawLegend, drawTitleScreen, drawLevelComplete, drawCaught, drawWin,
} from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const PLAYER_SPEED = 140;
const SNEAK_SPEED = 70;
const PLAYER_RADIUS = 11;
const LEVEL_TIME_SECONDS = 240;
const ALARM_DECAY = 12;
const TIME_UP_ALARM_RATE = 25;

let audioCtx = null;
function beep(freq, seconds, type = 'sine', gain = 0.05) {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + seconds);
  } catch (_) { /* sound is optional */ }
}

const keys = {};
let state = 'title'; // title | playing | levelComplete | caught | win
let levelIndex = 0;
let level = null;
let guards = [];
let cameras = [];
let lootItems = [];
let player = null;
let alarm = 0;
let lootValue = 0;
let coins = 0;
let coinsAtLevelStart = 0;
let totalLoot = 0;
let totalCoins = 0;
let timeLeft = LEVEL_TIME_SECONDS;
let timeUsed = 0;
let smoke = null; // {x, y, left}
let empLeft = 0;
let spotBeepCooldown = 0;

function loadLevel(index) {
  levelIndex = index;
  level = LEVELS[index];
  guards = level.guards.map(makeGuard);
  cameras = level.cameras.map(makeCamera);
  lootItems = makeLoot(level.loot);
  player = {
    x: level.start.x, y: level.start.y,
    sneaking: false, facing: 0, moving: false,
  };
  alarm = 0;
  lootValue = 0;
  coinsAtLevelStart = coins;
  timeLeft = LEVEL_TIME_SECONDS;
  smoke = null;
  empLeft = 0;
}

function rectsCollideCircle(rect, x, y, r) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r;
}

function movePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.ArrowUp || keys.KeyW) dy -= 1;
  if (keys.ArrowDown || keys.KeyS) dy += 1;
  if (keys.ArrowLeft || keys.KeyA) dx -= 1;
  if (keys.ArrowRight || keys.KeyD) dx += 1;
  player.sneaking = !!keys.ShiftLeft || !!keys.ShiftRight;
  if (dx === 0 && dy === 0) {
    player.moving = false;
    return;
  }
  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;
  const speed = player.sneaking ? SNEAK_SPEED : PLAYER_SPEED;
  player.facing = Math.atan2(dy, dx);
  player.moving = true;
  const nx = player.x + dx * speed * dt;
  const ny = player.y + dy * speed * dt;
  // Axis-separated movement so the thief slides along walls.
  const inRoomX = nx - PLAYER_RADIUS >= ROOM.x && nx + PLAYER_RADIUS <= ROOM.x + ROOM.w;
  const inRoomY = ny - PLAYER_RADIUS >= ROOM.y && ny + PLAYER_RADIUS <= ROOM.y + ROOM.h;
  const hitWallX = level.walls.some((w) => rectsCollideCircle(w, nx, player.y, PLAYER_RADIUS));
  const hitWallY = level.walls.some((w) => rectsCollideCircle(w, player.x, ny, PLAYER_RADIUS));
  if (inRoomX && !hitWallX) player.x = nx;
  if (inRoomY && !hitWallY) player.y = ny;
}

function playerInSmoke() {
  return smoke && Math.hypot(player.x - smoke.x, player.y - smoke.y) < 62;
}

function updateAlarm(dt) {
  let seen = 0;
  if (!playerInSmoke()) {
    for (const g of guards) {
      seen += guardSpotStrength(g, player, level.walls, level.shadows) * GUARD_SPOT_RATE;
    }
    for (const cam of cameras) {
      seen += cameraSpotStrength(cam, player, level.walls, level.shadows) * CAMERA_SPOT_RATE;
    }
    // A guard that walks right into you catches you on the spot.
    for (const g of guards) {
      if (Math.hypot(g.x - player.x, g.y - player.y) < 22) {
        alarm = 100;
      }
    }
  } else {
    for (const g of guards) g.spotted = false;
    for (const cam of cameras) cam.spotted = false;
  }
  if (seen > 0) {
    alarm += seen * dt;
    spotBeepCooldown -= dt;
    if (spotBeepCooldown <= 0) {
      beep(880, 0.08, 'square', 0.03);
      spotBeepCooldown = 0.45;
    }
  } else {
    alarm -= ALARM_DECAY * dt;
  }
  if (timeLeft <= 0) alarm += TIME_UP_ALARM_RATE * dt;
  alarm = Math.max(0, Math.min(100, alarm));
  if (alarm >= 100) {
    state = 'caught';
    beep(160, 0.5, 'sawtooth', 0.07);
  }
}

function tryGrabLoot(dt) {
  const item = nearestLoot(lootItems, player.x, player.y);
  if (!item) return;
  if (item.locked) {
    if (keys.KeyE) {
      const picked = updateLockpick(item, dt, true);
      if (picked) {
        lootValue += picked.value;
        coins += picked.value;
        beep(1320, 0.12);
      }
    } else {
      item.pickProgress = 0;
    }
    return;
  }
  if (keys.KeyE) {
    const value = grabLoot(item);
    lootValue += value;
    coins += value;
    beep(1040, 0.1);
  }
}

function useTool(name) {
  if (name === 'smoke') {
    if (coins < TOOL_COSTS.smoke || smoke) return;
    coins -= TOOL_COSTS.smoke;
    smoke = { x: player.x, y: player.y, left: 6 };
    beep(300, 0.15, 'triangle', 0.05);
  } else if (name === 'emp') {
    if (coins < TOOL_COSTS.emp || empLeft > 0) return;
    coins -= TOOL_COSTS.emp;
    empLeft = 8;
    for (const cam of cameras) cam.disabledLeft = 8;
    beep(220, 0.2, 'triangle', 0.05);
  } else if (name === 'pick') {
    if (coins < TOOL_COSTS.pick) return;
    const item = nearestLoot(lootItems, player.x, player.y);
    if (!item || !item.locked) return;
    coins -= TOOL_COSTS.pick;
    const value = grabLoot(item);
    lootValue += value;
    coins += value;
    beep(1320, 0.12);
  }
}

function inExit() {
  const e = level.exit;
  return player.x >= e.x && player.x <= e.x + e.w && player.y >= e.y && player.y <= e.y + e.h;
}

function update(dt) {
  if (state !== 'playing') return;
  timeLeft -= dt;
  timeUsed += dt;
  if (smoke) {
    smoke.left -= dt;
    if (smoke.left <= 0) smoke = null;
  }
  if (empLeft > 0) empLeft -= dt;
  movePlayer(dt);
  for (const g of guards) updateGuard(g, dt, player, level.walls, level.shadows, alarm);
  for (const cam of cameras) updateCamera(cam, dt);
  updateAlarm(dt);
  if (state !== 'playing') return; // caught during this tick
  tryGrabLoot(dt);
  if (inExit() && lootValue >= level.quota) {
    totalLoot += lootValue;
    totalCoins = coins;
    if (levelIndex >= LEVELS.length - 1) {
      state = 'win';
      beep(660, 0.2);
      setTimeout(() => beep(990, 0.3), 180);
    } else {
      state = 'levelComplete';
      beep(660, 0.15);
      setTimeout(() => beep(880, 0.2), 150);
    }
  }
}

function drawRoom(time) {
  // Floor: dark tiles.
  ctx.fillStyle = '#101820';
  ctx.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  ctx.strokeStyle = '#18222d';
  ctx.lineWidth = 1;
  for (let x = ROOM.x; x <= ROOM.x + ROOM.w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, ROOM.y); ctx.lineTo(x, ROOM.y + ROOM.h); ctx.stroke();
  }
  for (let y = ROOM.y; y <= ROOM.y + ROOM.h; y += 40) {
    ctx.beginPath(); ctx.moveTo(ROOM.x, y); ctx.lineTo(ROOM.x + ROOM.w, y); ctx.stroke();
  }
  // Shadow cover zones.
  for (const s of level.shadows) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = '#2dd4bf';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.setLineDash([]);
  }
  // Exit zone (pulses green once the quota is met).
  const e = level.exit;
  const quotaMet = lootValue >= level.quota;
  const pulse = quotaMet ? 0.55 + Math.sin(time * 4) * 0.2 : 0.25;
  ctx.fillStyle = `rgba(45, 212, 191, ${pulse})`;
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#0d141c';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e.label, e.x + e.w / 2, e.y + e.h / 2);
  // Loot.
  for (const item of lootItems) drawLoot(ctx, item, time);
  // Smoke cloud.
  if (smoke) {
    ctx.fillStyle = 'rgba(200, 210, 220, 0.35)';
    ctx.beginPath();
    ctx.arc(smoke.x, smoke.y, 62, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cones + watchers.
  const inSmoke = playerInSmoke();
  for (const g of guards) drawGuard(ctx, g, inSmoke);
  for (const cam of cameras) drawCamera(ctx, cam, inSmoke);
  // Walls on top of the cones.
  for (const w of level.walls) {
    ctx.fillStyle = '#2a3a4a';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#4a5f74';
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }
  // The thief: teal hood, gold trim, facing tick.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = player.sneaking ? '#0f3d38' : '#14b8a6';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f5c542';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(player.facing) * 15, Math.sin(player.facing) * 15);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#e8eef5';
  ctx.stroke();
  ctx.restore();
  // "E to grab" hint.
  const near = nearestLoot(lootItems, player.x, player.y);
  if (near) {
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(near.locked ? 'Hold E to pick — or [3] lockpick' : 'Press E to grab',
      player.x, player.y - 24);
  }
  // Alarm flash at high alarm.
  if (alarm >= 70 && state === 'playing') {
    ctx.fillStyle = `rgba(255, 70, 70, ${0.06 + Math.sin(time * 8) * 0.04})`;
    ctx.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  }
}

function render(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0a0f14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (state === 'title') {
    drawTopBar(ctx, {
      level: LEVELS[0], alarm: 0, lootValue: 0, coins: 0, timeLeft: LEVEL_TIME_SECONDS,
    });
    drawLegend(ctx, { level: LEVELS[0], tools: { smokeLeft: 0, empLeft: 0 } });
    drawTitleScreen(ctx);
    return;
  }
  drawTopBar(ctx, {
    level, alarm, lootValue, coins, timeLeft,
  });
  drawRoom(time);
  drawLegend(ctx, {
    level,
    tools: { smokeLeft: smoke ? smoke.left : 0, empLeft: Math.max(0, empLeft) },
  });
  if (state === 'levelComplete') drawLevelComplete(ctx, level, lootValue, coins);
  if (state === 'caught') drawCaught(ctx, level, lootValue);
  if (state === 'win') drawWin(ctx, totalLoot, totalCoins, timeUsed);
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render(now / 1000);
  requestAnimationFrame(frame);
}

function advance() {
  if (state === 'title') {
    coins = 0;
    totalLoot = 0;
    totalCoins = 0;
    timeUsed = 0;
    loadLevel(0);
    state = 'playing';
  } else if (state === 'levelComplete') {
    loadLevel(levelIndex + 1);
    state = 'playing';
  } else if (state === 'caught') {
    coins = coinsAtLevelStart;
    loadLevel(levelIndex);
    state = 'playing';
  } else if (state === 'win') {
    coins = 0;
    totalLoot = 0;
    totalCoins = 0;
    timeUsed = 0;
    loadLevel(0);
    state = 'playing';
  }
}

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === 'Enter' && state !== 'playing') advance();
  if (event.code === 'KeyR' && state === 'playing') {
    // Restart the room: coins roll back to what the room started with.
    coins = coinsAtLevelStart;
    loadLevel(levelIndex);
  }
  if (event.code === 'Digit1' && state === 'playing') useTool('smoke');
  if (event.code === 'Digit2' && state === 'playing') useTool('emp');
  if (event.code === 'Digit3' && state === 'playing') useTool('pick');
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  if (state === 'playing') {
    for (const btn of TOOL_BUTTONS) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        useTool(btn.name.toLowerCase() === 'smoke' ? 'smoke' : btn.name.toLowerCase() === 'emp' ? 'emp' : 'pick');
        return;
      }
    }
    return;
  }
  advance();
});

// Expose a tiny debug handle for play-testing from the console.
window.__vault = {
  get state() { return state; },
  get alarm() { return alarm; },
  get lootValue() { return lootValue; },
  get coins() { return coins; },
  get level() { return levelIndex + 1; },
  teleport(x, y) { if (player) { player.x = x; player.y = y; } },
  advance,
};

loadLevel(0);
requestAnimationFrame(frame);

// Demo hook (?level=N&demo=1): jump straight into a room for screenshots.
// Mid-room showcase spot per level, alarm preset so the meter reads.
const demoParams = new URLSearchParams(location.search);
const demoLevel = Number(demoParams.get('level') || 0);
if (demoParams.get('demo') === '1' && demoLevel >= 1 && demoLevel <= LEVELS.length) {
  const demoSpots = [
    { x: 420, y: 380 }, // Velvet Lobby — by the gold loot
    { x: 450, y: 320 }, // Silent Gallery — between the partitions
    { x: 400, y: 320 }, // Gold Vault — at the vault door gap
    { x: 420, y: 380 }, // Rooftop Escape — by the coin loot
  ];
  loadLevel(demoLevel - 1);
  state = 'playing';
  player.x = demoSpots[demoLevel - 1].x;
  player.y = demoSpots[demoLevel - 1].y;
  alarm = 45;
}
