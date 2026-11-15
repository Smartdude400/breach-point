// ============ Breach Point — shared fire pipeline ============
import * as THREE from 'three';
import { Sfx } from './audio';
import type { Effects } from './effects';
import { CELL } from './data';

export interface ShotResult { hit: boolean; head: boolean }

export interface FireCtx {
  scene: THREE.Scene;
  world: import('./physics').GridWorld;
  wviz: import('./world').World;
  fx: Effects;
  units: import('./units').Unit[];
  shooter: import('./units').Unit;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  spec: import('./types').WeaponSpec;
  spreadDeg: number;
  blockedBySmoke: (a: THREE.Vector3, b: THREE.Vector3) => boolean;
  cellBroken: (x: number, y: number) => void;
  soundKind: 'rifle' | 'smg' | 'shotgun' | 'pistol';
  listener?: { x: number; z: number; yaw: number };
}

const CELL_SIZE = CELL;

export function fireWeapon(ctx: FireCtx): ShotResult {
  const res: ShotResult = { hit: false, head: false };
  for (let p = 0; p < ctx.spec.pellets; p++) {
    const dir = jitterDir(ctx.dir, ctx.spreadDeg);
    const origin = ctx.origin.clone();
    // smoke blocks
    if (ctx.blockedBySmoke(origin, origin.clone().addScaledVector(dir, 60))) {
      continue;
    }
    const ray = new THREE.Raycaster(origin, dir, 0.1, 80);
    const targets: THREE.Object3D[] = [];
    for (const u of ctx.units) {
      if (u.dead || u.side === ctx.shooter.side) continue;
      targets.push(u.hitMesh);
    }
    const worldMeshes: THREE.Object3D[] = [];
    for (const m of ctx.wviz.panels.values()) worldMeshes.push(m);
    for (const m of ctx.wviz.doorMeshes.values()) worldMeshes.push(m);
    for (const m of ctx.wviz.barricadeMeshes.values()) {
      if (m.visible) worldMeshes.push(m);
    }
    ray.intersectObjects([...targets, ...worldMeshes], false);
    const hits = ray.intersectObjects([...targets, ...worldMeshes], false);
    const hit = hits[0];
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, 60);
    if (!ctx.blockedBySmoke(origin, end)) {
      ctx.fx.tracer(origin, end);
    }

    if (!hit) continue;
    const obj = hit.object;
    const unit = obj.userData.unitRef as import('./units').Unit | undefined;
    if (unit) {
      const head = hit.point.y > unit.pos.y + 1.35;
      const d = origin.distanceTo(hit.point);
      const dmg = applyFalloff(ctx.spec, d) * (head ? ctx.spec.headMult : 1);
      unit.takeDamage(dmg, ctx.shooter, head);
      res.hit = true;
      res.head = head;
      continue;
    }
    // world hits
    const panelKey = obj.userData.panelKey as string | undefined;
    const doorKey = obj.userData.doorKey as string | undefined;
    if (panelKey) {
      const panel = ctx.world.panels.get(panelKey);
      if (panel?.reinforced) {
        ctx.fx.impact(hit.point, hit.face?.normal ?? dir.clone().negate());
        Sfx.impact({ pos: hit.point, maxDist: 40 });
        continue;
      }
      ctx.wviz.damagePanel(panelKey, ctx.spec.dmg * 0.5, false);
      ctx.fx.impact(hit.point, hit.face?.normal ?? dir.clone().negate());
      Sfx.impact({ pos: hit.point, maxDist: 40 });
      if (panel && panel.state === 3) ctx.cellBroken(panel.x, panel.y);
    } else if (doorKey) {
      const door = ctx.world.doors.get(doorKey);
      if (door && door.open01 < 0.2 && door.barricade === 0) {
        // closed slab — bullets pass around it, treat as blocked but no damage
        ctx.fx.impact(hit.point, dir.clone().negate());
        continue;
      }
      const bar = ctx.wviz.barricadeMeshes.get(doorKey);
      if (bar && bar.visible) {
        bar.userData.hp = ((bar.userData.hp as number) ?? 40) - ctx.spec.dmg;
        ctx.fx.impact(hit.point, dir.clone().negate());
        Sfx.impact({ pos: hit.point, maxDist: 40 });
        if ((bar.userData.hp as number) <= 0) {
          bar.visible = false;
          if (door) { door.barricade = 0; ctx.cellBroken(door.x, door.y); }
        }
      }
    } else {
      ctx.fx.impact(hit.point, hit.face?.normal ?? dir.clone().negate());
      Sfx.impact({ pos: hit.point, maxDist: 40 });
    }
  }
  return res;
}

export function applyFalloff(spec: import('./types').WeaponSpec, dist: number): number {
  if (dist <= spec.falloffStart) return spec.dmg;
  if (dist >= spec.falloffEnd) return spec.dmg * spec.minDmgMult;
  const t = (dist - spec.falloffStart) / (spec.falloffEnd - spec.falloffStart);
  return spec.dmg * (1 - t * (1 - spec.minDmgMult));
}

export function jitterDir(dir: THREE.Vector3, spreadDeg: number): THREE.Vector3 {
  if (spreadDeg <= 0) return dir.clone();
  const rad = (spreadDeg * Math.PI) / 180;
  const out = dir.clone();
  out.x += (Math.random() - 0.5) * rad;
  out.y += (Math.random() - 0.5) * rad * 0.6;
  out.z += (Math.random() - 0.5) * rad;
  return out.normalize();
}

export { CELL_SIZE };
