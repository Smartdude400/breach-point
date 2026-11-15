// ============ Breach Point — save/load (localStorage) ============
import type { CareerStats } from './types';
import type { LoadoutSave } from './loadout';
import { OPERATORS } from './data';

const KEY = 'breachpoint.save.v1';

export interface SaveData {
  loadouts: Record<string, LoadoutSave>;
  stats: CareerStats;
}

export function defaultLoadout(opId: string): LoadoutSave {
  const op = OPERATORS.find((o) => o.id === opId) ?? OPERATORS[0];
  const sight = op.side === 'atk' ? 'reddot' : 'holo';
  const gadgets = op.side === 'atk' ? ['flash', 'smoke'] : ['smoke', 'frag'];
  return { sight, gadgets, skin: 'default' } as LoadoutSave;
}

export function defaultStats(): CareerStats {
  return { roundsPlayed: 0, wins: 0, losses: 0, kills: 0, deaths: 0 };
}

export function defaultSave(): SaveData {
  const loadouts: Record<string, LoadoutSave> = {};
  for (const op of OPERATORS) loadouts[op.id] = defaultLoadout(op.id);
  return { loadouts, stats: defaultStats() };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    const out: SaveData = { loadouts: base.loadouts, stats: base.stats };
    if (parsed.loadouts) {
      for (const id of Object.keys(base.loadouts)) {
        const l = parsed.loadouts[id];
        if (l && Array.isArray(l.gadgets)) {
          out.loadouts[id] = {
            sight: l.sight ?? base.loadouts[id].sight,
            gadgets: l.gadgets.slice(0, 2),
            skin: l.skin ?? 'default',
          };
        }
      }
    }
    if (parsed.stats) out.stats = { ...base.stats, ...parsed.stats };
    return out;
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable — play without persistence */
  }
}
