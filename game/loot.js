// loot.js — loot kinds, pickup, and lockpicking.
// Coins are small change, gold bars pay for tools, gems are the big score,
// and relics are locked: a lockpick opens one instantly, otherwise hold E
// for two seconds while the alarm keeps ticking.

export const LOCKPICK_HOLD_SECONDS = 2;

export function makeLoot(defs) {
  // Fresh copies per level so a restart resets every item.
  return defs.map((def) => ({ ...def, taken: false, pickProgress: 0 }));
}

export function nearestLoot(lootItems, x, y, maxDist = 34) {
  let best = null;
  let bestDist = maxDist;
  for (const item of lootItems) {
    if (item.taken) continue;
    const dist = Math.hypot(item.x - x, item.y - y);
    if (dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}

// Hold-to-pick for locked loot. Returns the item when the pick completes.
export function updateLockpick(item, dt, holding) {
  if (!item || !item.locked) return null;
  if (holding) {
    item.pickProgress += dt;
    if (item.pickProgress >= LOCKPICK_HOLD_SECONDS) {
      item.taken = true;
      return item;
    }
  } else {
    item.pickProgress = 0;
  }
  return null;
}

export function grabLoot(item) {
  item.taken = true;
  return item.value;
}

export function drawLoot(ctx, item, time) {
  if (item.taken) return;
  const bob = Math.sin(time * 2 + item.x) * 2.5; // gentle idle bob
  ctx.save();
  ctx.translate(item.x, item.y + bob);
  // Glow ring so loot reads at a glance.
  ctx.beginPath();
  ctx.arc(0, 0, item.radius + 6, 0, Math.PI * 2);
  ctx.fillStyle = item.color + '22';
  ctx.fill();
  // The loot itself: coin circle, gold bar, gem diamond, relic star.
  ctx.fillStyle = item.color;
  if (item.kind === 'coin') {
    ctx.beginPath();
    ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0.5);
  } else if (item.kind === 'gold') {
    ctx.fillRect(-item.radius, -item.radius / 2, item.radius * 2, item.radius);
  } else if (item.kind === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, -item.radius);
    ctx.lineTo(item.radius, 0);
    ctx.lineTo(0, item.radius);
    ctx.lineTo(-item.radius, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    // Relic: five-point star.
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? item.radius : item.radius * 0.45;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Lock ring on locked relics + pick progress arc.
  if (item.locked) {
    ctx.beginPath();
    ctx.arc(0, 0, item.radius + 4, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff5d8f';
    ctx.stroke();
    if (item.pickProgress > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, item.radius + 8, -Math.PI / 2,
        -Math.PI / 2 + (item.pickProgress / LOCKPICK_HOLD_SECONDS) * Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }
  // Value label under the loot.
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = item.color;
  ctx.fillText(String(item.value), 0, item.radius + 9);
  ctx.restore();
}
