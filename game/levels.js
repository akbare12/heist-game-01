// levels.js — the four rooms of MIDNIGHT VAULT.
// Each level is one room the thief must cross: walls, shadow cover, guard
// patrols, sweeping cameras, loot with different values, and the exit.
// Room play area: x 16..824, y 72..664 on the 1080x680 canvas.

export const ROOM = { x: 16, y: 72, w: 808, h: 592 };

// Loot kinds: value in loot points, locked ones need a lockpick (or a hold).
export const LOOT_KINDS = {
  coin: { value: 5, color: '#e8c85a', label: 'COIN 5', radius: 9 },
  gold: { value: 25, color: '#f5b301', label: 'GOLD 25', radius: 11 },
  diamond: { value: 50, color: '#7fe7ff', label: 'GEM 50', radius: 11 },
  artifact: { value: 100, color: '#ff5d8f', label: 'RELIC 100', radius: 13, locked: true },
};

function loot(x, y, kind) {
  return { x, y, kind, ...LOOT_KINDS[kind], taken: false, pickProgress: 0 };
}

function guard(waypoints, speed) {
  return { waypoints, speed, pause: 0.9 };
}

function camera(x, y, baseDeg, sweepDeg, speed) {
  return { x, y, base: (baseDeg * Math.PI) / 180, sweep: (sweepDeg * Math.PI) / 180, speed };
}

export const LEVELS = [
  {
    id: 1,
    name: 'THE VELVET LOBBY',
    briefing: 'Slip past the desk patrol. Grab 60 loot, then the north-east door.',
    quota: 60,
    start: { x: 60, y: 600 },
    exit: { x: 764, y: 80, w: 52, h: 44, label: 'EXIT' },
    walls: [
      { x: 300, y: 300, w: 180, h: 40 }, // reception desk
      { x: 150, y: 200, w: 36, h: 36 }, // pillar
      { x: 620, y: 420, w: 36, h: 36 }, // pillar
      { x: 500, y: 120, w: 120, h: 24 }, // planter
    ],
    shadows: [
      { x: 60, y: 120, w: 120, h: 80 }, // dark lounge corner
      { x: 640, y: 540, w: 140, h: 80 }, // stairwell shadow
    ],
    guards: [
      guard([[200, 150], [200, 550], [600, 550], [600, 150]], 55),
      guard([[700, 300], [400, 300], [400, 500], [700, 500]], 60),
    ],
    cameras: [camera(420, 80, 90, 45, 0.5)], // lobby eye, wide slow sweep
    loot: [
      loot(120, 480, 'coin'),
      loot(700, 120, 'coin'),
      loot(390, 340, 'gold'),
      loot(760, 600, 'diamond'),
    ],
  },
  {
    id: 2,
    name: 'THE SILENT GALLERY',
    briefing: 'Paintings watch you back. 120 loot, then the north-west door.',
    quota: 120,
    start: { x: 780, y: 620 },
    exit: { x: 16, y: 80, w: 52, h: 44, label: 'EXIT' },
    walls: [
      { x: 250, y: 150, w: 24, h: 300 }, // partition
      { x: 550, y: 250, w: 24, h: 300 }, // partition
      { x: 380, y: 400, w: 120, h: 28 }, // bench
    ],
    shadows: [
      { x: 60, y: 500, w: 130, h: 90 }, // dark alcove
      { x: 660, y: 100, w: 130, h: 90 }, // sculpture shadow
    ],
    guards: [
      guard([[120, 150], [120, 550], [380, 550], [380, 150]], 60),
      guard([[700, 150], [700, 550], [480, 550], [480, 150]], 65),
      guard([[300, 620], [760, 620], [760, 120], [300, 120]], 50),
    ],
    cameras: [camera(420, 80, 90, 45, 0.6), camera(420, 656, 270, 45, 0.45)],
    loot: [
      loot(120, 150, 'coin'),
      loot(320, 560, 'gold'),
      loot(700, 300, 'gold'),
      loot(420, 120, 'diamond'),
      loot(770, 580, 'artifact'),
    ],
  },
  {
    id: 3,
    name: 'THE GOLD VAULT',
    briefing: 'Two relics sleep behind steel. 200 loot, then out the north-east door.',
    quota: 200,
    start: { x: 60, y: 600 },
    exit: { x: 764, y: 80, w: 52, h: 44, label: 'EXIT' },
    walls: [
      { x: 480, y: 180, w: 280, h: 20 }, // vault north wall
      { x: 480, y: 380, w: 280, h: 20 }, // vault south wall
      { x: 480, y: 200, w: 20, h: 80 }, // vault west wall, upper
      { x: 480, y: 320, w: 20, h: 60 }, // vault west wall, lower (door gap 280..320)
      { x: 740, y: 200, w: 20, h: 180 }, // vault east wall
      { x: 150, y: 300, w: 140, h: 30 }, // crates
      { x: 300, y: 120, w: 24, h: 160 }, // pillar row
    ],
    shadows: [
      { x: 60, y: 120, w: 120, h: 90 }, // entry shadow
      { x: 600, y: 500, w: 150, h: 90 }, // vault shadow
    ],
    guards: [
      guard([[120, 150], [120, 550], [400, 550], [400, 150]], 62),
      guard([[620, 220], [620, 340], [700, 340], [700, 220]], 45),
      guard([[300, 620], [760, 620], [760, 450], [300, 450]], 58),
    ],
    cameras: [
      camera(500, 190, 90, 35, 0.7),
      camera(750, 390, 270, 35, 0.55),
      camera(200, 80, 90, 50, 0.5),
    ],
    loot: [
      loot(200, 150, 'gold'),
      loot(350, 500, 'diamond'),
      loot(620, 280, 'artifact'),
      loot(680, 330, 'artifact'),
      loot(760, 600, 'coin'),
    ],
  },
  {
    id: 4,
    name: 'THE ROOFTOP ESCAPE',
    briefing: 'Last room. 260 loot, then the helipad. The chopper leaves at dawn.',
    quota: 260,
    start: { x: 60, y: 620 },
    exit: { x: 700, y: 80, w: 110, h: 90, label: 'HELIPAD' },
    walls: [
      { x: 200, y: 200, w: 90, h: 60 }, // AC unit
      { x: 500, y: 400, w: 90, h: 60 }, // AC unit
      { x: 350, y: 520, w: 140, h: 30 }, // crates
    ],
    shadows: [
      { x: 60, y: 100, w: 140, h: 80 }, // vent shadow
      { x: 640, y: 480, w: 150, h: 100 }, // stair bulkhead shadow
    ],
    guards: [
      guard([[120, 150], [120, 550], [380, 550], [380, 150]], 68),
      guard([[700, 200], [700, 550], [480, 550], [480, 200]], 72),
      guard([[250, 620], [780, 620], [780, 300], [250, 300]], 60),
      guard([[420, 120], [420, 480], [650, 480], [650, 120]], 55),
    ],
    cameras: [camera(420, 80, 90, 50, 0.65), camera(420, 656, 270, 50, 0.6)],
    loot: [
      loot(150, 550, 'gold'),
      loot(400, 150, 'diamond'),
      loot(700, 500, 'diamond'),
      loot(760, 120, 'artifact'),
      loot(300, 350, 'coin'),
    ],
  },
];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}
