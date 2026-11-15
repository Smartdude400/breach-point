// ============ Breach Point — attacker drone ============
import * as THREE from 'three';
import { Sfx } from './audio';
import type { Match } from './match';

export class DroneCtl {
  match: Match;
  camera: THREE.PerspectiveCamera;
  pos: THREE.Vector3;
  yaw = 0;
  pitch = 0;
  keys: Set<string> = new Set();
  bound: Array<[string, EventListener]> = [];
  mesh: THREE.Group;
  sparkT = 0;
  battery = 20;

  constructor(match: Match) {
    this.match = match;
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 120);
    this.pos = match.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    this.yaw = match.player.yaw;
    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.1, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x30363f, roughness: 0.5 }),
    );
    const cam = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x8affc0 }),
    );
    cam.position.set(0, -0.02, 0.12);
    this.mesh.add(body, cam);
    this.mesh.position.copy(this.pos);
    match.scene.add(this.mesh);

    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') { match.exitDrone(); return; }
      this.keys.add(e.code);
      if (e.code === 'F') {
        // ping nearest visible enemy
        const u = match.player;
        void u;
        let best: import('./units').Unit | null = null;
        let bd = 26;
        for (const t of match.units) {
          if (t.side === match.player.side || t.dead) continue;
          const d = t.pos.distanceTo(this.pos);
          if (d < bd && !match.fx.blockedBySmoke(this.pos, t.eyePos())) { bd = d; best = t; }
        }
        if (best) { Sfx.beep(); match.hud.pingEnemy(best.opName); }
      }
    };
    const ku = (e: KeyboardEvent) => { this.keys.delete(e.code); };
    const mm = (e: MouseEvent) => {
      if (!match.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - e.movementY * 0.0022));
    };
    window.addEventListener('keydown', kd as EventListener);
    window.addEventListener('keyup', ku as EventListener);
    window.addEventListener('mousemove', mm as EventListener);
    this.bound = [['keydown', kd as EventListener], ['keyup', ku as EventListener], ['mousemove', mm as EventListener]];
  }

  private solid(x: number, z: number): boolean {
    return this.match.solidAtWorld(x, z);
  }

  update(dt: number): void {
    this.battery -= dt;
    if (this.battery <= 0) { this.match.exitDrone(); return; }
    const k = this.keys;
    const spd = 5.2;
    let fx = 0;
    let fz = 0;
    let up = 0;
    if (k.has('KeyW')) fz += 1;
    if (k.has('KeyS')) fz -= 1;
    if (k.has('KeyA')) fx -= 1;
    if (k.has('KeyD')) fx += 1;
    if (k.has('KeyR')) up += 1;
    if (k.has('KeyC') || k.has('ControlLeft')) up -= 1;
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const dx = (fx * cos + fz * sin) * spd * dt;
    const dz = (-fx * sin + fz * cos) * spd * dt;
    const ny = this.pos.y + up * 3 * dt;
    if (ny > 0.4 && ny < 3.0) this.pos.y = ny;
    if (!this.solid(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    if (!this.solid(this.pos.x, this.pos.z + dz)) this.pos.z += dz;

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;

    this.camera.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.sparkT -= dt;
    if (this.sparkT <= 0) {
      this.sparkT = 0.5;
      Sfx.blip(1400, 0.03);
    }
    this.match.hud.setDroneBattery(Math.max(0, this.battery));
  }

  dispose(): void {
    this.match.scene.remove(this.mesh);
    for (const [ev, fn] of this.bound) window.removeEventListener(ev, fn);
  }
}
