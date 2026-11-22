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
const PLAYER_RADIUS = 16;
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
let demoMode = false; // true only under ?demo=1 (screenshot staging)

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
    } else if (!demoMode) {
      // In demo (screenshot) mode the staged pick progress is frozen so the
      // progress arc stays visible; in normal play it resets when you let go.
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

function drawProps(ctx) {
  if (!level.props) return;
  for (const p of level.props) {
    if (p.kind === 'rect') {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    } else if (p.kind === 'frame') {
      ctx.fillStyle = p.fill;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    } else if (p.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    } else if (p.kind === 'label') {
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.kind === 'heli') {
      // Parked helicopter silhouette: body + tail + rotor.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = '#46586a';
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, -2);
      ctx.lineTo(40, -6);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#46586a';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(38, -12);
      ctx.lineTo(38, 0);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-26, -13);
      ctx.lineTo(26, -13);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f5c542';
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawRoom(time) {
  // Floor: per-room tint + dark tiles.
  ctx.fillStyle = level.floor ?? '#101820';
  ctx.fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  ctx.strokeStyle = level.grid ?? '#18222d';
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
  // Named props: room identity (reception desk, paintings, vault, skyline).
  // Decorative only — drawn on top of walls, in empty spots, no collision.
  drawProps(ctx);
  // The thief: big teal hood, thick gold trim, white outline, facing wedge.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = player.sneaking ? '#0f3d38' : '#14b8a6';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f5c542';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_RADIUS + 2, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#e8eef5';
  ctx.stroke();
  // Facing wedge: a bright arrowhead showing where the thief looks.
  const fx = Math.cos(player.facing);
  const fy = Math.sin(player.facing);
  ctx.beginPath();
  ctx.moveTo(fx * 5, fy * 5);
  ctx.lineTo(fx * 21 - fy * 6, fy * 21 + fx * 6);
  ctx.lineTo(fx * 21 + fy * 6, fy * 21 - fx * 6);
  ctx.closePath();
  ctx.fillStyle = '#e8eef5';
  ctx.fill();
  ctx.restore();
  // "E to grab" hint.
  const near = nearestLoot(lootItems, player.x, player.y);
  if (near) {
    ctx.fillStyle = '#e8eef5';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(near.locked ? 'Hold E to pick — or [3] lockpick' : 'Press E to grab',
      player.x, player.y - 28);
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
// Each level stages a DIFFERENT mid-heist state: thief beside loot being
// grabbed, a tool visibly in use, alarm matching the scene. Alarm presets
// read ~15-18 lower at capture (~1.25s after load, decay 12/s while unseen).
// Staged spots were checked against guard/camera cones at capture time:
// no watcher can spot the thief in the first ~2s, so no chase / no catch.
const demoParams = new URLSearchParams(location.search);
const demoLevel = Number(demoParams.get('level') || 0);
if (demoParams.get('demo') === '1' && demoLevel >= 1 && demoLevel <= LEVELS.length) {
  // taken: loot indexes already banked before the shot.
  // taken: loot indexes already banked before the shot. The loot beside the
  // thief stays visible (meter = an earlier grab) so the "Press E" hint shows.
  // pickIndex: locked relic mid-pick (progress arc visible, frozen in demo).
  const demoStages = [
    // 1 Velvet Lobby — smoke + cone edge, gold off the desk, alarm ~68 at capture.
    { x: 418, y: 348, facing: Math.PI, alarm: 85, lootValue: 25, coins: 25, timeLeft: 200, taken: [], smoke: true },
    // 2 Silent Gallery — smoke cloud, thief inside it, alarm 40.
    { x: 348, y: 560, facing: Math.PI, alarm: 55, lootValue: 25, coins: 10, timeLeft: 160, taken: [], smoke: true },
    // 3 Gold Vault — hold-E picking a relic, thief offset so the star reads clear, EMP off, alarm 70.
    { x: 711, y: 318, facing: 2.77, alarm: 85, lootValue: 75, coins: 55, timeLeft: 120, taken: [0, 1], pickIndex: 3, emp: true },
    // 4 Rooftop Escape — at the helipad's edge, quota met (exit pulses), alarm 20.
    // (NOT on the pad itself: standing on it with the quota met wins instantly.)
    { x: 690, y: 155, facing: 0, alarm: 35, lootValue: 205, coins: 205, timeLeft: 90, taken: [1, 2, 3, 4] },
  ];
  const stage = demoStages[demoLevel - 1];
  demoMode = true;
  loadLevel(demoLevel - 1);
  state = 'playing';
  player.x = stage.x;
  player.y = stage.y;
  player.facing = stage.facing;
  alarm = stage.alarm;
  lootValue = stage.lootValue;
  coins = stage.coins;
  timeLeft = stage.timeLeft;
  for (const i of stage.taken ?? []) {
    if (lootItems[i]) lootItems[i].taken = true;
  }
  if (stage.pickIndex !== undefined && lootItems[stage.pickIndex]) {
    lootItems[stage.pickIndex].pickProgress = 1.2; // 60% of the 2s hold
  }
  if (stage.smoke) smoke = { x: player.x, y: player.y, left: 6 };
  if (stage.emp) {
    empLeft = 8;
    for (const cam of cameras) cam.disabledLeft = 8;
  }
}
