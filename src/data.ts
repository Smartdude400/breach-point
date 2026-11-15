// ============ Breach Point — data tables ============
import type { GadgetKind, GadgetSpec, OperatorSpec, SightId, WeaponSpec } from './types';

// ---------- Sights ----------
export interface SightSpec {
  id: SightId;
  name: string;
  fov: number; // ADS field of view (lower = more zoom)
  overlay: 'none' | 'dot' | 'holo' | 'scope';
}
export const SIGHTS: Record<SightId, SightSpec> = {
  iron:    { id: 'iron',    name: 'Iron Sights',   fov: 75, overlay: 'none'  },
  reddot:  { id: 'reddot',  name: 'Red Dot 1.0×',  fov: 62, overlay: 'dot'   },
  holo:    { id: 'holo',    name: 'Holo A 1.5×',   fov: 50, overlay: 'holo'  },
  scope25: { id: 'scope25', name: 'Scope 2.5×',    fov: 34, overlay: 'scope' },
  scope40: { id: 'scope40', name: 'Telescopic 4×', fov: 26, overlay: 'scope' },
};

// ---------- Weapons ----------
const W = (w: WeaponSpec): WeaponSpec => w;

export const WEAPONS: Record<string, WeaponSpec> = {
  m4tempest: W({
    id: 'm4tempest', name: 'M4 TEMPEST', cls: 'primary',
    magSize: 30, reserve: 120, rpm: 720, auto: true, pellets: 1,
    dmg: 34, falloffStart: 18, falloffEnd: 35, minDmgMult: 0.65, headMult: 1.6,
    spreadDeg: 3.0, adsSpreadDeg: 0.3, recoilKick: 0.8, reloadTime: 2.2,
    zoomFov: 55, sights: ['iron', 'reddot', 'holo', 'scope25', 'scope40'],
  }),
  vex9: W({
    id: 'vex9', name: 'VEX-9', cls: 'primary',
    magSize: 32, reserve: 128, rpm: 900, auto: true, pellets: 1,
    dmg: 24, falloffStart: 12, falloffEnd: 26, minDmgMult: 0.55, headMult: 1.5,
    spreadDeg: 3.8, adsSpreadDeg: 0.6, recoilKick: 0.5, reloadTime: 1.9,
    zoomFov: 58, sights: ['iron', 'reddot', 'holo', 'scope25'],
  }),
  anvilp: W({
    id: 'anvilp', name: 'ANVIL-P', cls: 'primary',
    magSize: 25, reserve: 100, rpm: 780, auto: true, pellets: 1,
    dmg: 27, falloffStart: 14, falloffEnd: 28, minDmgMult: 0.6, headMult: 1.5,
    spreadDeg: 3.4, adsSpreadDeg: 0.5, recoilKick: 0.55, reloadTime: 2.0,
    zoomFov: 58, sights: ['iron', 'reddot', 'holo', 'scope25'],
  }),
  trench12: W({
    id: 'trench12', name: 'TRENCH-12', cls: 'primary',
    magSize: 7, reserve: 28, rpm: 68, auto: false, pellets: 8,
    dmg: 13, falloffStart: 6, falloffEnd: 16, minDmgMult: 0.2, headMult: 1.3,
    spreadDeg: 5.5, adsSpreadDeg: 3.6, recoilKick: 2.0, reloadTime: 2.8,
    zoomFov: 62, sights: ['iron', 'reddot', 'holo'],
  }),
  p92: W({
    id: 'p92', name: 'P-92', cls: 'secondary',
    magSize: 15, reserve: 45, rpm: 400, auto: false, pellets: 1,
    dmg: 26, falloffStart: 15, falloffEnd: 30, minDmgMult: 0.6, headMult: 1.7,
    spreadDeg: 2.2, adsSpreadDeg: 0.4, recoilKick: 0.6, reloadTime: 1.6,
    zoomFov: 60, sights: ['iron'],
  }),
};

// ---------- Gadgets ----------
export const GADGETS: Record<GadgetKind, GadgetSpec> = {
  flash:  { kind: 'flash',  name: 'Flash Grenade', count: 2, desc: 'Blinds anyone looking at the pop.' },
  smoke:  { kind: 'smoke',  name: 'Smoke Grenade', count: 2, desc: 'Vision-blocking cloud for 10s.' },
  frag:   { kind: 'frag',   name: 'Frag Grenade',  count: 2, desc: 'Area damage, shreds soft walls.' },
  breach: { kind: 'breach', name: 'Breach Charge', count: 1, desc: 'Plant on a soft wall. Big hole.' },
};
export const GADGET_ORDER: GadgetKind[] = ['flash', 'smoke', 'frag', 'breach'];

// ---------- Operators ----------
export const OPERATORS: OperatorSpec[] = [
  {
    id: 'ram', name: 'RAM', side: 'atk', role: 'Breacher',
    blurb: 'Walks through walls so the team does not have to. If it is soft, it is already open.',
    primary: WEAPONS.m4tempest,
    ability: 'Breach Hammer',
    abilityDesc: 'Melee soft wall panels to smash them instantly. Also one-shots barricades.',
    gadgetChoices: ['flash', 'smoke', 'frag', 'breach'],
  },
  {
    id: 'ember', name: 'EMBER', side: 'atk', role: 'Hard Breacher',
    blurb: 'Where RAM is stopped by steel, EMBER melts it. Reinforced walls are a suggestion.',
    primary: WEAPONS.vex9,
    ability: 'Pyro Charge',
    abilityDesc: 'Melts reinforced wall panels — the only tool in the game that opens steel.',
    gadgetChoices: ['flash', 'smoke', 'frag', 'breach'],
  },
  {
    id: 'bastion', name: 'BASTION', side: 'def', role: 'Anchor',
    blurb: 'Turns the objective into a fortress and everyone holding it into a tank.',
    primary: WEAPONS.anvilp,
    ability: 'Armor Crate',
    abilityDesc: 'Deploys an armor pack. You and teammates take 30% less damage after grabbing it.',
    gadgetChoices: ['flash', 'smoke', 'frag', 'breach'],
  },
  {
    id: 'aegis', name: 'AEGIS', side: 'def', role: 'Denial',
    blurb: 'Slams doors shut on the plan and forces attackers to earn every entry.',
    primary: WEAPONS.trench12,
    ability: 'Barricade Kit',
    abilityDesc: 'Seals doorways with heavy panels during setup. Breakable, but it costs time.',
    gadgetChoices: ['flash', 'smoke', 'frag', 'breach'],
  },
];

export function opById(id: string): OperatorSpec {
  return OPERATORS.find((o) => o.id === id) ?? OPERATORS[0];
}

// ---------- Skins ----------
export interface SkinSpec { id: string; name: string; tint: number; accent: number }
export const SKINS: SkinSpec[] = [
  { id: 'default',  name: 'Default', tint: 0x3a4756, accent: 0x232a34 },
  { id: 'arctic',   name: 'Arctic',  tint: 0xb8c4d4, accent: 0x6f7f92 },
  { id: 'rose',     name: 'Rose',    tint: 0x8a3d4e, accent: 0x54242f },
  { id: 'digital',  name: 'Digital', tint: 0x39533c, accent: 0x24341f },
];

// ---------- Map: Canal House ----------
// Grid of 2m cells. Rooms/corridors are carved out of solid wall.
export const CELL = 2;
export const MAP_COLS = 42;
export const MAP_ROWS = 32;

export interface Rect { x: number; y: number; w: number; h: number }
export interface RoomDef { id: string; label: string; rect: Rect; kind: 'spawn' | 'room' | 'corridor' }
export interface DoorDef { x: number; y: number }
export interface WindowDef { x: number; y: number }

export const ROOMS: RoomDef[] = [
  { id: 'spawnW',  label: 'West Spawn',   rect: { x: 1,  y: 1,  w: 12, h: 5 }, kind: 'spawn' },
  { id: 'topMid',  label: 'Office',       rect: { x: 14, y: 1,  w: 13, h: 5 }, kind: 'room'  },
  { id: 'spawnE',  label: 'East Spawn',   rect: { x: 28, y: 1,  w: 13, h: 5 }, kind: 'spawn' },
  { id: 'corrN',   label: 'North Hall',   rect: { x: 3,  y: 7,  w: 36, h: 2 }, kind: 'corridor' },
  { id: 'corrW',   label: 'West Hall',    rect: { x: 14, y: 9,  w: 2,  h: 14 }, kind: 'corridor' },
  { id: 'corrE',   label: 'East Hall',    rect: { x: 26, y: 9,  w: 2,  h: 14 }, kind: 'corridor' },
  { id: 'corrS',   label: 'South Hall',   rect: { x: 3,  y: 24, w: 36, h: 2 }, kind: 'corridor' },
  { id: 'storage', label: 'Storage',      rect: { x: 3,  y: 10, w: 9,  h: 5 }, kind: 'room' },
  { id: 'gym',     label: 'Gym',          rect: { x: 3,  y: 17, w: 9,  h: 5 }, kind: 'room' },
  { id: 'server',  label: 'Server Room',  rect: { x: 17, y: 10, w: 8,  h: 5 }, kind: 'room' },
  { id: 'meeting', label: 'Meeting',      rect: { x: 17, y: 17, w: 8,  h: 5 }, kind: 'room' },
  { id: 'workshop',label: 'Workshop',     rect: { x: 29, y: 10, w: 9,  h: 5 }, kind: 'room' },
  { id: 'lab',     label: 'Lab',          rect: { x: 29, y: 17, w: 9,  h: 5 }, kind: 'room' },
  { id: 'garage',  label: 'Garage',       rect: { x: 1,  y: 27, w: 12, h: 4 }, kind: 'room' },
  { id: 'lobby',   label: 'Lobby',        rect: { x: 14, y: 27, w: 13, h: 4 }, kind: 'room' },
  { id: 'kitchen', label: 'Kitchen',      rect: { x: 28, y: 27, w: 13, h: 4 }, kind: 'room' },
];

export const DOORS: DoorDef[] = [
  { x: 7,  y: 6 }, { x: 20, y: 6 }, { x: 34, y: 6 },
  { x: 14, y: 8 }, { x: 15, y: 8 }, { x: 26, y: 8 }, { x: 27, y: 8 },
  { x: 15, y: 12 }, { x: 15, y: 19 },
  { x: 26, y: 12 }, { x: 26, y: 19 },
  { x: 25, y: 12 },
  { x: 25, y: 19 },
  { x: 7,  y: 23 }, { x: 20, y: 23 }, { x: 34, y: 23 },
  { x: 14, y: 23 }, { x: 15, y: 23 }, { x: 26, y: 23 }, { x: 27, y: 23 },
  { x: 7,  y: 26 }, { x: 20, y: 26 }, { x: 34, y: 26 },
  { x: 16, y: 26 }, { x: 25, y: 26 },
  { x: 13, y: 29 },
  { x: 27, y: 29 },
];

export const WINDOWS: WindowDef[] = [
  { x: 6,  y: 0 }, { x: 35, y: 0 },
  { x: 0,  y: 14 }, { x: 41, y: 14 },
  { x: 4,  y: 31 }, { x: 20, y: 31 }, { x: 36, y: 31 },
];

export const SITES = [
  { id: 'server', label: 'Server Room', room: 'server', canister: { x: 21, y: 12 } },
  { id: 'garage', label: 'Garage', room: 'garage', canister: { x: 7, y: 29 } },
] as const;

export const ATK_SPAWNS = [
  { x: 6, y: 3 }, { x: 4, y: 4 }, { x: 35, y: 3 }, { x: 37, y: 4 },
];
export const DEF_SPAWNS = [
  { x: 20, y: 29 }, { x: 22, y: 28 }, { x: 18, y: 28 },
];

export const WALL_H = 3.2;
export const EYE_H = 1.62;
export const CROUCH_H = 1.0;
