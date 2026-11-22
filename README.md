# MIDNIGHT VAULT — Best Heist Game

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/akbare12/heist-game-01/rank.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/akbare12/heist-game-01/reward.svg)](https://make.fun/c/best-heist-game-20261122-0559)

A top-down 2D stealth heist game. One thief, four rooms, one getaway.

**MIDNIGHT VAULT** — sneak through the Velvet Lobby, the Silent Gallery, the
Gold Vault and the Rooftop Escape. Read the patrols, slip past the sweeping
vision cones and security cameras, grab the loot, and reach the exit before
the alarm meter fills. Caught is fair: cones warn you first, the alarm climbs
while you are seen and drains while you hide.

## How to play

- **Move** — WASD or arrow keys. **Sneak** — hold Shift (slower, harder to spot).
- **Grab loot** — walk up to it and press **E** (locked artifacts need a
  lockpick or a 2-second hold).
- **Tools** (bought with loot coins) — **1** Smoke Bomb, **2** EMP (cameras
  off), **3** Lockpick. Tools are also clickable in the HUD.
- **Restart room** — press **R** (coins roll back to the room's start).
- **Win a room** — reach the green exit zone with at least the room's loot
  quota. Clear all four rooms to escape by helicopter.

## The four rooms

| Room | Guards | Cameras | Quota |
| --- | --- | --- | --- |
| 1. The Velvet Lobby | 2 | 1 | 60 |
| 2. The Silent Gallery | 3 | 2 | 120 |
| 3. The Gold Vault | 3 | 3 | 200 |
| 4. The Rooftop Escape | 4 | 2 | 200 |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files. `main.ts` (Node 22,
standard library only) copies `game/` and `screenshots/` to `/output` and
writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.

## Layout

- `game/index.html` — page, canvas, HUD shell
- `game/levels.js` — the four rooms: walls, patrols, cameras, loot, exits
- `game/vision.js` — vision cones and line-of-sight math
- `game/guards.js` — guard patrol, chase and spotting
- `game/cameras.js` — sweeping security cameras
- `game/loot.js` — loot kinds, values, lockpicking
- `game/hud.js` — alarm meter, coins, tools, legend, screens
- `game/main.js` — game loop, input, alarm, tools, state machine
- `main.ts` — hand-in program
- `screenshots/` — 3–4 real renders of the game

Built for the make.fun best-heist-game bounty. Original game, art and names.
