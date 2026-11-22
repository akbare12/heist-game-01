// cameras.js — sweeping security cameras.
// A camera sits on the wall and sweeps its cone back and forth. It cannot
// move, but its cone is longer than a guard's and it never blinks — unless
// an EMP knocks it out. The cone shows exactly where it looks right now.

import { CAMERA_RANGE, CAMERA_HALF_ANGLE, coneStrength, drawCone } from './vision.js';

export const CAMERA_SPOT_RATE = 40; // alarm points per second at full strength

export function makeCamera(def) {
  return {
    x: def.x,
    y: def.y,
    base: def.base,
    sweep: def.sweep,
    speed: def.speed,
    phase: 0,
    facing: def.base,
    disabledLeft: 0,
    spotted: false,
  };
}

export function updateCamera(cam, dt) {
  if (cam.disabledLeft > 0) {
    cam.disabledLeft -= dt;
    return;
  }
  cam.phase += dt * cam.speed;
  cam.facing = cam.base + Math.sin(cam.phase) * cam.sweep;
}

export function cameraSpotStrength(cam, player, walls, shadows) {
  if (cam.disabledLeft > 0) {
    cam.spotted = false;
    return 0;
  }
  const strength = coneStrength(cam.x, cam.y, cam.facing, CAMERA_RANGE, CAMERA_HALF_ANGLE,
    player.x, player.y, walls, shadows, player.sneaking);
  cam.spotted = strength > 0.02;
  return strength;
}

export function drawCamera(ctx, cam, playerInSmoke) {
  const disabled = cam.disabledLeft > 0;
  const color = disabled
    ? 'rgba(120, 130, 140, 0.10)'
    : cam.spotted && !playerInSmoke
      ? 'rgba(255, 70, 70, 0.26)'
      : 'rgba(255, 90, 90, 0.16)';
  if (!disabled) {
    drawCone(ctx, cam.x, cam.y, cam.facing, CAMERA_RANGE, CAMERA_HALF_ANGLE, color);
  }
  // Mount: a small square + red lens — a different SHAPE from the thief's
  // disc and the guard's chevron, so all three read apart at small scale.
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.fillStyle = disabled ? '#3a4550' : '#232d38';
  ctx.fillRect(-8, -8, 16, 16);
  ctx.lineWidth = 2;
  ctx.strokeStyle = disabled ? '#5a6a78' : '#ff5d5d';
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.beginPath();
  ctx.arc(Math.cos(cam.facing) * 5, Math.sin(cam.facing) * 5, 4, 0, Math.PI * 2);
  ctx.fillStyle = disabled ? '#5a6a78' : '#ff2d2d';
  ctx.fill();
  ctx.restore();
}
