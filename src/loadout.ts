import type { GadgetKind, SightId } from './types';

export interface LoadoutSave {
  sight: LoadoutSight;
  gadgets: GadgetKind[];
  skin: string;
}
type LoadoutSight = SightId;
