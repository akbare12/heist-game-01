// hud.js — alarm meter, coins, tools, legend, and screens.
// The HUD is drawn on the canvas so every screenshot carries it: the alarm
// meter, the loot quota, the tool costs, and the legend that explains each
// system without playing. One dark palette, gold + teal accents, everywhere.

export const TOOL_BUTTONS = [
  { key: '1', name: 'SMOKE', cost: 15, x: 800, y: 14, w: 84, h: 36 },
  { key: '2', name: 'EMP', cost: 20, x: 892, y: 14, w: 84, h: 36 },
  { key: '3', name: 'PICK', cost: 10, x: 984, y: 14, w: 84, h: 36 },
];

export const TOOL_COSTS = { smoke: 15, emp: 20, pick: 10 };

function alarmColor(alarm) {
  if (alarm >= 70) return '#ff4646';
  if (alarm >= 40) return '#ffb02e';
  return '#2dd4bf';
}

export function drawTopBar(ctx, state) {
  const { level, alarm, lootValue, coins, timeLeft } = state;
  ctx.save();
  ctx.fillStyle = '#0d141c';
  ctx.fillRect(0, 0, 1080, 64);
  ctx.fillStyle = '#1c2a38';
  ctx.fillRect(0, 62, 1080, 2);

  // Level name.
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f5c542';
  ctx.fillText(`MIDNIGHT VAULT — ${level.name}`, 16, 24);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#8fa3b5';
  ctx.fillText(level.briefing, 16, 46);

  // Alarm meter.
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#e8eef5';
  ctx.fillText('ALARM', 300, 18);
  ctx.fillStyle = '#1c2a38';
  ctx.fillRect(300, 26, 240, 16);
  ctx.fillStyle = alarmColor(alarm);
  ctx.fillRect(300, 26, Math.max(0, Math.min(240, (alarm / 100) * 240)), 16);
  ctx.strokeStyle = '#3a4a5a';
  ctx.lineWidth = 1;
  ctx.strokeRect(300, 26, 240, 16);
  if (alarm >= 70) {
    ctx.fillStyle = '#ff4646';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('SPOTTED!', 548, 34);
  }

  // Loot quota + coins + timer.
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#f5c542';
  ctx.fillText(`LOOT ${lootValue}/${level.quota}`, 600, 24);
  ctx.fillStyle = '#7fe7ff';
  ctx.fillText(`COINS ${coins}`, 600, 46);
  ctx.fillStyle = '#8fa3b5';
  ctx.font = '12px monospace';
  ctx.fillText(`TIME LEFT ${Math.max(0, Math.ceil(timeLeft))}s`, 700, 24);

  // Tool buttons (clickable; keys 1/2/3 do the same).
  for (const btn of TOOL_BUTTONS) {
    const afford = coins >= btn.cost;
    ctx.fillStyle = afford ? '#14332e' : '#1c2a38';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = afford ? '#2dd4bf' : '#3a4a5a';
    ctx.lineWidth = 1;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.fillStyle = afford ? '#2dd4bf' : '#5a6a78';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[${btn.key}] ${btn.name}`, btn.x + btn.w / 2, btn.y + 14);
    ctx.font = '11px monospace';
    ctx.fillText(`${btn.cost}c`, btn.x + btn.w / 2, btn.y + 29);
  }
  ctx.restore();
}

function legendRow(ctx, x, y, swatch, text) {
  swatch(ctx, x, y);
  ctx.fillStyle = '#c7d3df';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 30, y);
}

export function drawLegend(ctx, state) {
  const { level, tools } = state;
  ctx.save();
  ctx.fillStyle = '#0d141c';
  ctx.fillRect(840, 72, 224, 592);
  ctx.fillStyle = '#1c2a38';
  ctx.fillRect(840, 72, 2, 592);
  let y = 96;
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#f5c542';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEGEND', 856, y);
  y += 30;
  legendRow(ctx, 856, y, (c, x, yy) => {
    c.fillStyle = 'rgba(255, 210, 90, 0.5)';
    c.beginPath(); c.moveTo(x + 12, yy); c.lineTo(x + 24, yy - 8); c.lineTo(x + 24, yy + 8); c.closePath(); c.fill();
  }, 'Guard cone — seen = alarm');
  y += 26;
  legendRow(ctx, 856, y, (c, x, yy) => {
    c.fillStyle = 'rgba(255, 90, 90, 0.5)';
    c.beginPath(); c.moveTo(x + 12, yy); c.lineTo(x + 24, yy - 8); c.lineTo(x + 24, yy + 8); c.closePath(); c.fill();
  }, 'Camera cone — sweeps');
  y += 26;
  legendRow(ctx, 856, y, (c, x, yy) => {
    c.fillStyle = '#141d27'; c.fillRect(x, yy - 9, 24, 18);
    c.strokeStyle = '#2dd4bf'; c.strokeRect(x, yy - 9, 24, 18);
  }, 'Shadow — half spotted');
  y += 26;
  legendRow(ctx, 856, y, (c, x, yy) => {
    c.fillStyle = '#f5b301'; c.beginPath(); c.arc(x + 12, yy, 8, 0, Math.PI * 2); c.fill();
  }, 'Loot — coin 5, gold 25');
  y += 26;
  legendRow(ctx, 856, y, (c, x, yy) => {
    c.fillStyle = '#7fe7ff'; c.beginPath();
    c.moveTo(x + 12, yy - 9); c.lineTo(x + 21, yy); c.lineTo(x + 12, yy + 9); c.lineTo(x + 3, yy);
    c.closePath(); c.fill();
  }, 'Gem 50 — relic 100 locked');
  y += 26;
  legendRow(ctx, 856, y, (c, x, yy) => {
    c.fillStyle = '#2dd4bf'; c.fillRect(x, yy - 9, 24, 18);
  }, 'Exit — needs quota');
  y += 34;
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#f5c542';
  ctx.fillText('TOOLS', 856, y);
  y += 26;
  ctx.font = '12px monospace';
  ctx.fillStyle = '#c7d3df';
  const toolLines = [
    `[1] Smoke ${TOOL_COSTS.smoke}c — hide 6s`,
    `[2] EMP ${TOOL_COSTS.emp}c — cams off 8s`,
    `[3] Pick ${TOOL_COSTS.pick}c — open relic`,
    `Smoke active: ${tools.smokeLeft > 0 ? tools.smokeLeft.toFixed(0) + 's' : '—'}`,
    `EMP active: ${tools.empLeft > 0 ? tools.empLeft.toFixed(0) + 's' : '—'}`,
  ];
  for (const line of toolLines) {
    ctx.fillText(line, 856, y);
    y += 22;
  }
  y += 12;
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#f5c542';
  ctx.fillText('CONTROLS', 856, y);
  y += 26;
  ctx.font = '12px monospace';
  ctx.fillStyle = '#c7d3df';
  const controlLines = [
    'WASD / arrows — move',
    'Shift — sneak (slow,',
    '  half spotted)',
    'E — grab loot / pick lock',
    '1 / 2 / 3 — use a tool',
    'Click — buttons + tools',
  ];
  for (const line of controlLines) {
    ctx.fillText(line, 856, y);
    y += 22;
  }
  y += 12;
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#f5c542';
  ctx.fillText('HOW TO WIN', 856, y);
  y += 26;
  ctx.font = '12px monospace';
  ctx.fillStyle = '#c7d3df';
  const winLines = [
    `Room ${level.id} of 4 — quota ${level.quota}.`,
    'Reach the green exit',
    'with the quota to move on.',
    'Clear room 4 to escape.',
  ];
  for (const line of winLines) {
    ctx.fillText(line, 856, y);
    y += 22;
  }
  ctx.restore();
}

function overlay(ctx, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 12, 0.82)';
  ctx.fillRect(16, 72, 808, 592);
  ctx.fillStyle = '#0d141c';
  const w = 520;
  const h = 120 + lines.length * 26;
  const x = 16 + (808 - w) / 2;
  const y = 72 + (592 - h) / 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.font = 'bold 26px monospace';
  ctx.fillText(title, x + w / 2, y + 44);
  ctx.fillStyle = '#e8eef5';
  ctx.font = '14px monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, y + 84 + i * 26);
  });
  ctx.fillStyle = '#8fa3b5';
  ctx.font = '12px monospace';
  ctx.fillText('Click or press Enter to continue', x + w / 2, y + h - 24);
  ctx.restore();
}

export function drawTitleScreen(ctx) {
  overlay(ctx, 'MIDNIGHT VAULT', [
    'One thief. Four rooms. One getaway.',
    'Read the cones. Spend the coins. Mind the alarm.',
    'WASD move — Shift sneak — E grab — 1/2/3 tools',
  ], '#f5c542');
}

export function drawLevelComplete(ctx, level, lootValue, coins) {
  overlay(ctx, `ROOM ${level.id} CLEARED`, [
    `${level.name} — loot ${lootValue}, coins banked ${coins}.`,
    'Next room: more guards, more cameras, bigger quota.',
  ], '#2dd4bf');
}

export function drawCaught(ctx, level, lootValue) {
  overlay(ctx, 'CAUGHT!', [
    'The alarm hit 100. The crew left without you.',
    `${level.name} — loot kept: ${lootValue}. Try the shadows.`,
  ], '#ff4646');
}

export function drawWin(ctx, totalLoot, totalCoins, timeUsed) {
  overlay(ctx, 'CLEAN GETAWAY!', [
    `All four rooms cleared — loot ${totalLoot}, coins ${totalCoins}.`,
    `Escape time ${Math.floor(timeUsed / 60)}:${String(Math.floor(timeUsed % 60)).padStart(2, '0')}.`,
    'The chopper lifts off. Nobody saw a thing.',
  ], '#2dd4bf');
}
