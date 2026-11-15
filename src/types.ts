// ============ Breach Point — shared types ============

export type Side = 'atk' | 'def';

export type PanelMaterial = 'soft' | 'reinforced';

export type SightId = 'iron' | 'reddot' | 'holo' | 'scope25' | 'scope40';

export type GadgetKind = 'flash' | 'smoke' | 'frag' | 'breach';

export interface WeaponSpec {
  id: string;
  name: string;
  cls: 'primary' | 'secondary';
  magSize: number;
  reserve: number;
  rpm: number;
  auto: boolean;
  pellets: number;
  dmg: number;
  falloffStart: number;
  falloffEnd: number;
  minDmgMult: number;
  headMult: number;
  spreadDeg: number;
  adsSpreadDeg: number;
  recoilKick: number;
  reloadTime: number;
  zoomFov: number;
  sights: SightId[];
}

export interface GadgetSpec {
  kind: GadgetKind;
  name: string;
  count: number;
  desc: string;
}

export interface OperatorSpec {
  id: string;
  name: string;
  side: Side;
  role: string;
  blurb: string;
  primary: WeaponSpec;
  ability: string;
  abilityDesc: string;
  gadgetChoices: GadgetKind[];
}

export interface Loadout {
  opId: string;
  sight: SightId;
  gadgets: GadgetKind[];
  skin: string;
}

export interface CareerStats {
  roundsPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
}

export type MatchPhase = 'setup' | 'drone' | 'action' | 'over';
