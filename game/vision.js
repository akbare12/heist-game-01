// vision.js — vision cones and line-of-sight math.
// Guards and cameras both see through a cone: range + half-angle + a clear
// line of sight (walls block sight). Shadows halve how fast you are spotted.

export const GUARD_RANGE = 170;
export const GUARD_HALF_ANGLE = 0.62; // ~35 degrees each side
export const CAMERA_RANGE = 210;
export const CAMERA_HALF_ANGLE = 0.5; // ~29 degrees each side

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

// True when the segment (x1,y1)-(x2,y2) crosses no wall. Samples along the
// ray; cheap and good enough for a top-down stealth game.
export function hasLineOfSight(x1, y1, x2, y2, walls) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(4, Math.ceil(dist / 12));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const wall of walls) {
      if (pointInRect(px, py, wall)) return false;
    }
  }
  return true;
}

export function pointInShadow(x, y, shadows) {
  for (const shadow of shadows) {
    if (pointInRect(x, y, shadow)) return true;
  }
  return false;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Is the target inside the watcher's cone? Returns 0 when unseen, otherwise
// a 0..1 strength (1 = dead centre, close). Sneaking and shadows weaken it.
export function coneStrength(wx, wy, facing, range, halfAngle, tx, ty, walls, shadows, sneaking) {
  const dx = tx - wx;
  const dy = ty - wy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (dist < 1) return 1; // point blank: the watcher is on top of you
  const angleTo = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(angleTo, facing)) > halfAngle) return 0;
  if (!hasLineOfSight(wx, wy, tx, ty, walls)) return 0;
  let strength = 1 - dist / range;
  if (pointInShadow(tx, ty, shadows)) strength *= 0.45;
  if (sneaking) strength *= 0.55;
  return Math.max(0, strength);
}

// Draw a translucent vision cone on the canvas.
export function drawCone(ctx, x, y, facing, range, halfAngle, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
