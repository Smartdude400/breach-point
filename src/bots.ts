// ============ Breach Point — bot AI ============
import * as THREE from 'three';
import { SITES } from './data';
import { cellToWorld, worldToCell } from './world';
import { fireWeapon } from './weapons';
import { Sfx } from './audio';
import type { Match } from './match';
import type { Unit } from './units';
import type { WeaponSpec } from './types';
import { WEAPONS } from './data';

export function nearestEnemyTo(unit: Unit, units: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  for (const u of units) {
    if (u.dead || u.side === unit.side) continue;
    const d = u.pos.distanceTo(unit.pos);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

const BOT_SPECS: Record<string, WeaponSpec> = {
  ram: WEAPONS.m4tempest,
  ember: WEAPONS.vex9,
  bastion: WEAPONS.anvilp,
  aegis: WEAPONS.trench12,
};

export class BotBrain {
  match: Match;
  unit: Unit;
  state = 'idle';
  path: Array<{ x: number; y: number }> = [];
  pathI = 0;
  repathT = 0;
  fireCd = 0;
  strafe = 1;
  strafeT = 0;
  alertT = 0;
  lastKnown: THREE.Vector3 | null = null;

  constructor(match: Match, unit: Unit) {
    this.match = match;
    this.unit = unit;
  }

  private canSee(target: Unit): boolean {
    if (target.dead) return false;
    const a = this.unit.eyePos();
    const b = target.eyePos();
    if (a.distanceTo(b) > 34) return false;
    if (this.match.fx.blockedBySmoke(a, b)) return false;
    const dir = b.clone().sub(a).normalize();
    const ray = new THREE.Raycaster(a, dir, 0.2, a.distanceTo(b));
    const objs: THREE.Object3D[] = [];
    for (const m of this.match.wviz.panels.values()) if (m.visible) objs.push(m);
    for (const m of this.match.wviz.doorMeshes.values()) objs.push(m);
    for (const m of this.match.wviz.barricadeMeshes.values()) if (m.visible) objs.push(m);
    const hits = ray.intersectObjects(objs, false);
    return hits.length === 0;
  }

  private setPathTo(wx: number, wz: number): void {
    const from = worldToCell(this.unit.pos.x, this.unit.pos.z);
    const to = worldToCell(wx, wz);
    const path = this.match.nav.findPath(from.x, from.y, to.x, to.y);
    this.path = path ?? [];
    this.pathI = 0;
  }

  private followPath(dt: number, speedMul = 1): boolean {
    if (this.pathI >= this.path.length) return false;
    const node = this.path[this.pathI];
    const w = cellToWorld(node.x, node.y);
    const dx = w.x - this.unit.pos.x;
    const dz = w.z - this.unit.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) { this.pathI++; return this.pathI < this.path.length; }
    const spd = this.unit.speed * speedMul;
    this.unit.pos.x += (dx / d) * spd * dt;
    this.unit.pos.z += (dz / d) * spd * dt;
    this.unit.yaw = Math.atan2(-dx, -dz);
    return true;
  }

  update(dt: number): void {
    const u = this.unit;
    if (u.dead) return;
    const phase = this.match.phase;
    this.fireCd -= dt;
    this.strafeT -= dt;
    this.alertT -= dt;
    if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0.8 + Math.random(); }

    const site = SITES[this.match.siteIndex];
    const siteW = cellToWorld(site.canister.x, site.canister.y);

    if (phase === 'setup' || phase === 'drone') {
      if (u.side === 'def') {
        if (this.state !== 'hold') {
          this.state = 'hold';
          const ang = Math.random() * Math.PI * 2;
          this.setPathTo(siteW.x + Math.cos(ang) * 2.3, siteW.z + Math.sin(ang) * 2.3);
        }
        this.followPath(dt, 0.8);
      }
      return;
    }

    const enemy = nearestEnemyTo(u, this.match.units);
    const see = enemy && this.canSee(enemy) ? enemy : null;
    if (see) {
      this.alertT = 3;
      this.lastKnown = see.pos.clone();
      this.state = 'combat';
      const dx = see.pos.x - u.pos.x;
      const dz = see.pos.z - u.pos.z;
      u.yaw = Math.atan2(-dx, -dz);
      const d = Math.hypot(dx, dz);
      const side = new THREE.Vector3(dz, 0, -dx).normalize();
      u.pos.x += side.x * this.strafe * u.speed * 0.5 * dt;
      u.pos.z += side.z * this.strafe * u.speed * 0.5 * dt;
      const ideal = u.opId === 'aegis' ? 5 : 14;
      if (d > ideal + 3) {
        u.pos.x += (dx / d) * u.speed * 0.6 * dt;
        u.pos.z += (dz / d) * u.speed * 0.6 * dt;
      } else if (d < ideal - 3) {
        u.pos.x -= (dx / d) * u.speed * 0.6 * dt;
        u.pos.z -= (dz / d) * u.speed * 0.6 * dt;
      }
      if (this.fireCd <= 0 && d < 30) {
        this.fireCd = u.opId === 'aegis' ? 0.95 : 0.16;
        const spec = BOT_SPECS[u.opId] ?? WEAPONS.anvilp;
        const origin = u.eyePos();
        const aim = see.eyePos();
        const dir = aim.sub(origin).normalize();
        fireWeapon({
          scene: this.match.scene, world: this.match.world, wviz: this.match.wviz, fx: this.match.fx,
          units: this.match.units, shooter: u, origin, dir, spec,
          spreadDeg: 3.2,
          blockedBySmoke: (a, b) => this.match.fx.blockedBySmoke(a, b),
          cellBroken: (x, y) => this.match.onCellBroken(x, y),
          soundKind: this.match.gunSoundKind(spec.id),
          listener: this.matchListener(),
        });
        Sfx.shot({
          kind: this.match.gunSoundKind(spec.id),
          pos: { x: u.pos.x, z: u.pos.z },
          listener: { x: this.match.player.pos.x, z: this.match.player.pos.z },
          listenerYaw: this.match.player.yaw,
        });
      }
      return;
    }

    if (this.alertT > 0 && this.lastKnown) {
      this.state = 'hunt';
      if (this.pathI >= this.path.length || this.repathT <= 0) {
        this.repathT = 1.2;
        this.setPathTo(this.lastKnown.x, this.lastKnown.z);
      }
      this.repathT -= dt;
      this.followPath(dt);
      return;
    }

    this.state = 'obj';
    const distToSite = Math.hypot(u.pos.x - siteW.x, u.pos.z - siteW.z);
    if (u.side === 'atk') {
      if (distToSite > 2.0) {
        if (this.pathI >= this.path.length || this.repathT <= 0) {
          this.repathT = 2.5;
          this.setPathTo(siteW.x + (Math.random() - 0.5) * 2, siteW.z + (Math.random() - 0.5) * 2);
        }
        this.repathT -= dt;
        this.followPath(dt);
      }
    } else if (distToSite > 3.2) {
      if (this.pathI >= this.path.length || this.repathT <= 0) {
        this.repathT = 2.5;
        this.setPathTo(siteW.x + (Math.random() - 0.5) * 3, siteW.z + (Math.random() - 0.5) * 3);
      }
      this.repathT -= dt;
      this.followPath(dt);
    }
  }

  matchListener(): { x: number; z: number; yaw: number } {
    return { x: this.match.player.pos.x, z: this.match.player.pos.z, yaw: this.match.player.yaw };
  }
}
