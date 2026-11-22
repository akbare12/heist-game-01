// guards.js — guard patrol, chase and spotting.
// A guard walks its waypoint loop, pauses at each corner, and sweeps its
// vision cone where it looks. When the alarm climbs past half, the nearest
// guard breaks patrol and chases the thief. Being seen is fair: the cone
// shows exactly where the guard looks, and the alarm drains when you hide.

import { GUARD_RANGE, GUARD_HALF_ANGLE, coneStrength, drawCone } from './vision.js';

export const GUARD_SPOT_RATE = 58; // alarm points per second at full strength

export function makeGuard(def) {
  return {
    waypoints: def.waypoints,
    speed: def.speed,
    pause: def.pause,
    x: def.waypoints[0][0],
    y: def.waypoints[0][1],
    targetIndex: 1,
    waitLeft: 0,
    facing: 0,
    chasing: false,
    spotted: false,
  };
}

function moveToward(g, tx, ty, dt) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = g.speed * dt;
  if (step >= dist) {
    g.x = tx;
    g.y = ty;
    return true;
  }
  g.x += (dx / dist) * step;
  g.y += (dy / dist) * step;
  g.facing = Math.atan2(dy, dx);
  return false;
}

export function updateGuard(g, dt, player, walls, shadows, alarm) {
  g.spotted = false;
  // Chase mode: alarm past half and the guard has a line of sight.
  if (alarm > 50) {
    const seen = coneStrength(g.x, g.y, g.facing, GUARD_RANGE, GUARD_HALF_ANGLE,
      player.x, player.y, walls, shadows, player.sneaking);
    if (seen > 0.05) g.chasing = true;
  }
  if (g.chasing) {
    const arrived = moveToward(g, player.x, player.y, dt * 1.25);
    if (arrived) g.chasing = false;
    // Chasing guards stop chasing once the alarm calms down.
    if (alarm < 25) g.chasing = false;
    return;
  }
  // Patrol: walk to the next waypoint, pause, turn to the next leg.
  if (g.waitLeft > 0) {
    g.waitLeft -= dt;
    if (g.waitLeft <= 0) {
      g.targetIndex = (g.targetIndex + 1) % g.waypoints.length;
    }
    return;
  }
  const [tx, ty] = g.waypoints[g.targetIndex];
  if (moveToward(g, tx, ty, dt)) g.waitLeft = g.pause;
}

export function guardSpotStrength(g, player, walls, shadows) {
  const strength = coneStrength(g.x, g.y, g.facing, GUARD_RANGE, GUARD_HALF_ANGLE,
    player.x, player.y, walls, shadows, player.sneaking);
  g.spotted = strength > 0.02;
  return strength;
}

export function drawGuard(ctx, g, playerInSmoke) {
  // Vision cone first (under the guard), red when it spots the thief.
  const color = g.spotted && !playerInSmoke
    ? 'rgba(255, 70, 70, 0.30)'
    : 'rgba(255, 210, 90, 0.20)';
  drawCone(ctx, g.x, g.y, g.facing, GUARD_RANGE, GUARD_HALF_ANGLE, color);
  // Body: dark uniform, gold trim, facing tick.
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#1c2733';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = g.spotted ? '#ff4646' : '#d8a93b';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(g.facing) * 16, Math.sin(g.facing) * 16);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#e8eef5';
  ctx.stroke();
  ctx.restore();
}
