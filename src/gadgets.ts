// ============ Breach Point — gadgets & operator abilities ============
import * as THREE from 'three';
import { Sfx } from './audio';
import type { Effects } from './effects';
import type { World } from './world';
import { worldToCell } from './world';
import type { Unit } from './units';

export interface ThrowCtx {
  scene: THREE.Scene;
  world: import('./physics').GridWorld;
  wviz: World;
  fx: Effects;
  units: Unit[];
  thrower: Unit;
  cellBroken: (x: number, y: number) => void;
  damageUnit: (u: Unit, dmg: number, from: Unit, head: boolean) => void;
  listener?: { x: number; z: number; yaw: number };
}

export interface Projectile {
  kind: 'flash' | 'smoke' | 'frag';
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  fuse: number;
  thrower: Unit;
}

export class Gadgets {
  scene: THREE.Scene;
  wviz: World;
  world: import('./physics').GridWorld;
  fx: Effects;
  projectiles: Projectile[] = [];
  units: Unit[] = [];
  cellBroken: (x: number, y: number) => void = () => {};
  damageUnit: (u: Unit, dmg: number, from: Unit, head: boolean) => void = () => {};
  listener?: { x: number; z: number; yaw: number };

  constructor(scene: THREE.Scene, world: import('./physics').GridWorld, wviz: World, fx: Effects) {
    this.scene = scene;
    this.world = world;
    this.wviz = wviz;
    this.fx = fx;
  }

  throwGrenade(kind: 'flash' | 'smoke' | 'frag', origin: THREE.Vector3, dir: THREE.Vector3, thrower: Unit): void {
    const color = kind === 'flash' ? 0xf2f2f2 : kind === 'smoke' ? 0x777c85 : 0x3f5233;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.push({
      kind,
      mesh,
      vel: dir.clone().multiplyScalar(11).add(new THREE.Vector3(0, 2.5, 0)),
      fuse: kind === 'frag' ? 2.2 : 1.6,
      thrower,
    });
    Sfx.blip(500, 0.1);
  }

  update(dt: number): void {
    for (const p of this.projectiles) {
      p.fuse -= dt;
      p.vel.y -= 14 * dt;
      const next = p.mesh.position.clone().addScaledVector(p.vel, dt);
      // bounce off walls
      if (this.solidAt(next.x, next.z)) {
        p.vel.x *= -0.4;
        p.vel.z *= -0.4;
      } else {
        p.mesh.position.copy(next);
      }
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.vel.y = Math.abs(p.vel.y) * 0.35;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }
      if (p.fuse <= 0) this.detonate(p);
    }
    this.projectiles = this.projectiles.filter((p) => p.fuse > 0);
  }

  private solidAt(x: number, z: number): boolean {
    const c = worldToCell(x, z);
    return this.world.isWall(c.x, c.y) && !this.brokenCells.has(`${c.x},${c.y}`);
  }

  brokenCells = new Set<string>();

  private detonate(p: Projectile): void {
    const pos = p.mesh.position.clone();
    this.scene.remove(p.mesh);
    if (p.kind === 'flash') {
      Sfx.flashPop({ pos, maxDist: 70 });
      for (const u of this.units) {
        if (u.dead) continue;
        const d = u.pos.distanceTo(pos);
        if (d > 14) continue;
        const toFlash = pos.clone().sub(u.pos).normalize();
        const facing = u.forward();
        if (facing.dot(toFlash) > 0.1) u.blind(2.4);
        else u.blind(0.8);
      }
    } else if (p.kind === 'smoke') {
      Sfx.smokePop({ pos, maxDist: 70 });
      this.fx.smokeCloud(pos);
    } else {
      Sfx.explosion({ pos, maxDist: 80 });
      this.fx.explosion(pos);
      for (const u of this.units) {
        if (u.dead) continue;
        const d = u.pos.distanceTo(pos);
        if (d < 6.5) {
          const dmg = 105 * (1 - d / 6.5);
          this.damageUnit(u, dmg, p.thrower, false);
        }
      }
      this.shatterPanels(pos, 3.2, false);
      this.popBarricades(pos, 4);
    }
  }

  /** Break soft panels within radius of a world point. */
  shatterPanels(pos: THREE.Vector3, radius: number, pierceSteel: boolean): void {
    for (const [key, mesh] of this.wviz.panels) {
      if (mesh.visible === false) continue;
      const panel = this.world.panels.get(key);
      if (!panel) continue;
      if (panel.reinforced && !pierceSteel) continue;
      const d = Math.hypot(mesh.position.x - pos.x, mesh.position.z - pos.z);
      if (d <= radius) {
        this.wviz.destroyPanel(key);
        this.cellBroken(panel.x, panel.y);
      }
    }
    for (const [key, mesh] of this.wviz.doorMeshes) {
      const d = Math.hypot(mesh.position.x - pos.x, mesh.position.z - pos.z);
      if (d <= radius + 0.5) {
        const bar = this.wviz.barricadeMeshes.get(key);
        if (bar && bar.visible) { bar.visible = false; this.wviz.setBarricade(key, 0); }
      }
    }
  }

  popBarricades(pos: THREE.Vector3, radius: number): void {
    for (const [key, bar] of this.wviz.barricadeMeshes) {
      if (!bar.visible) continue;
      const d = Math.hypot(bar.position.x - pos.x, bar.position.z - pos.z);
      if (d <= radius) {
        bar.visible = false;
        this.wviz.setBarricade(key.replace(/^w/, ''), 0);
      }
    }
  }

  /** Plant a breach charge on the soft panel being aimed at. */
  plantBreach(
    aimPanelKey: string | undefined,
    pos: THREE.Vector3,
    owner: Unit,
    onBoom: (pos: THREE.Vector3, pierce: boolean) => void,
  ): boolean {
    if (!aimPanelKey) return false;
    const panel = this.world.panels.get(aimPanelKey);
    if (!panel || panel.reinforced || panel.state !== 0) return false;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xff5533 }),
    );
    marker.position.copy(pos);
    this.scene.add(marker);
    setTimeout(() => {
      Sfx.explosion({ pos, maxDist: 80 });
      onBoom(pos, false);
      this.shatterPanels(pos, 1.9, false);
      this.fx.explosion(pos);
      this.scene.remove(marker);
    }, 900);
    void owner;
    return true;
  }
}
