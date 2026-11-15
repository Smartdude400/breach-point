# Breach Point

**A Siege-inspired tactical FPS that runs in the browser — destructible walls, operators, drones and a full attack/defend round loop.**

Breach Point is a complete vertical slice of a round-based tactical shooter: pick an operator,
kit out in the locker, reinforce or breach the site, and fight a bot squad through setup and
action phases. Soft walls crack, hole and collapse in real time — bullets, sightlines and paths
all change as the destruction spreads.

## Features

- **Attack vs. defend** — one full round with a setup phase (reinforce walls, barricade doors)
  and an action phase (plant/defuse the objective, or eliminate the other side).
- **Four operators** — RAM and EMBER on attack (breacher / hard breacher), BASTION and AEGIS on
  defense (anchor / denial), each with a unique ability: hammer, pyro charge, armor crate,
  barricade kit.
- **Destructible geometry** — soft walls show cracks, then holes; breach charges open big holes;
  bullets pierce through what you've opened.
- **Locker loadouts** — five primaries (M4 TEMPEST, VEX-9, ANVIL-P, TRENCH-12) plus the P-92
  sidearm, five optics from iron sights to a 4× scope, and weapon skins.
- **Gadgets** — flash, smoke and frag grenades plus breach charges.
- **Recon drone** — attackers deploy a pilotable drone during the action phase.
- **Bot squad** — nav-graph driven enemies that fight, flank and hold the site.
- **Full game feel** — leaning, sprint/crouch, ADS with per-optic FOV, recoil, synthesized audio,
  HUD and match results, with persistent stats.

## Quick start

Requires Node.js 18+.

```sh
npm install
npm run dev        # open the printed URL, click Play
```

Production build (single-file output):

```sh
npm run build
npm run preview
```

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim · LMB fire · RMB aim down sights |
| Shift / C | Sprint / crouch |
| Space | Jump (exit drone while piloting) |
| Q / E | Lean left / right (E also interacts in setup) |
| 1 / 2 | Primary / P-92 sidearm |
| R | Reload |
| X / G | Cycle gadget / use gadget |
| F | Operator ability |
| V | Deploy drone (attackers, action phase) |

## Tech

TypeScript + [Three.js](https://threejs.org), bundled with Vite into a single HTML file.
All geometry, textures and audio are generated in code — no external assets.