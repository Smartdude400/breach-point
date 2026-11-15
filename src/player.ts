// ============ Breach Point — FPS player controller ============
import * as THREE from 'three';
import { CROUCH_H, EYE_H } from './data';
import type { Match } from './match';

const WALK = 4.6;
const SPRINT = 6.4;
const CROUCH_SPD = 2.4;

export class PlayerCtl {
  match: Match;
  canvas: HTMLCanvasElement;
  velY = 0;
  grounded = true;
  leanCur = 0;
  bobT = 0;
  pitch = 0;
  mouseSens = 0.0022;
  bound: Array<[string, EventListener]> = [];

  constructor(match: Match, canvas: HTMLCanvasElement) {
    this.match = match;
    this.canvas = canvas;
    const md = (e: MouseEvent) => {
      if (!match.locked) return;
      if (e.button === 0) {
        match.playerFire();
        match.holdFire = true;
      }
      if (e.button === 2) match.ads = true;
    };    const mu = (e: MouseEvent) => {
      if (e.button === 0) match.holdFire = false;
      if (e.button === 2) match.ads = false;
    };
    const mm = (e: MouseEvent) => {
      if (!match.locked || match.drone) return;
      const unit = match.player;
      unit.yaw -= e.movementX * this.mouseSens;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * this.mouseSens));
    };
    const key = (e: KeyboardEvent, down: boolean) => {
      if (match.drone) return;
      if (down) match.keys.add(e.code); else match.keys.delete(e.code);
      if (down && e.code === 'KeyG') match.useGadget();
      if (down && e.code === 'KeyF') match.doAbility();
      if (down && e.code === 'KeyQ') match.lean = -1;
      if (down && e.code === 'KeyE') match.lean = 1;
      if (down && e.code === 'KeyX') match.cycleGadget();
      if (down && e.code === 'Digit1') match.currentWeapon = 'primary';
      if (down && e.code === 'Digit2') match.currentWeapon = 'secondary';
      if (down && e.code === 'KeyV') match.deployDrone();
      if (down && e.code === 'Space') e.preventDefault();
      if (down && e.code === 'KeyE' && match.phase === 'setup') match.setupAction();
    };
    const kd = (e: KeyboardEvent) => key(e, true);
    const ku = (e: KeyboardEvent) => key(e, false);
    const ctx = (e: Event) => e.preventDefault();
    window.addEventListener('mousedown', md as EventListener);
    window.addEventListener('mouseup', mu as EventListener);
    window.addEventListener('mousemove', mm as EventListener);
    window.addEventListener('keydown', kd as EventListener);
    window.addEventListener('keyup', ku as EventListener);
    window.addEventListener('contextmenu', ctx);
    this.bound = [
      ['mousedown', md as EventListener], ['mouseup', mu as EventListener], ['mousemove', mm as EventListener],
      ['keydown', kd as EventListener], ['keyup', ku as EventListener], ['contextmenu', ctx],
    ];
  }

  private collides(x: number, z: number): boolean {
    const r = 0.35;
    const m = this.match;
    const pts: Array<[number, number]> = [
      [x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r],
    ];
    for (const [px, pz] of pts) {
      if (m.solidAtWorld(px, pz)) return true;
    }
    return false;
  }

  update(dt: number): void {
    const m = this.match;
    const u = m.player;
    if (u.dead || m.drone) {
      this.updateCamera();
      return;
    }
    const sprint = m.keys.has('ShiftLeft') || m.keys.has('ShiftRight');
    u.crouch = m.keys.has('ControlLeft') || m.keys.has('KeyC');
    let fx = 0;
    let fz = 0;
    if (m.keys.has('KeyW')) fz += 1;
    if (m.keys.has('KeyS')) fz -= 1;
    if (m.keys.has('KeyA')) fx -= 1;
    if (m.keys.has('KeyD')) fx += 1;
    const len = Math.hypot(fx, fz);
    if (len > 0) {
      fx /= len; fz /= len;
      const spd = u.crouch ? CROUCH_SPD : sprint ? SPRINT : WALK;
      const sin = Math.sin(u.yaw);
      const cos = Math.cos(u.yaw);
      const dx = (fx * cos + fz * sin) * spd * dt;
      const dz = (-fx * sin + fz * cos) * spd * dt;
      if (!this.collides(u.pos.x + dx, u.pos.z)) u.pos.x += dx;
      if (!this.collides(u.pos.x, u.pos.z + dz)) u.pos.z += dz;
      this.bobT += dt * (sprint ? 11 : 7);
    }

    // jump / gravity
    if (m.keys.has('Space') && this.grounded) {
      this.velY = 4.6;
      this.grounded = false;
    }
    this.velY -= 12 * dt;
    let ny = u.pos.y + this.velY * dt;
    if (ny <= 0) { ny = 0; this.velY = 0; this.grounded = true; }
    u.pos.y = ny;

    // lean
    const leanTarget = m.keys.has('KeyQ') ? -1 : m.keys.has('KeyE') ? 1 : 0;
    m.lean = leanTarget;
    this.leanCur += (leanTarget - this.leanCur) * Math.min(1, dt * 10);

    // ADS zoom
    const sightFov = 62;
    const targetFov = m.ads ? sightFov : 75;
    m.camera.fov += (targetFov - m.camera.fov) * Math.min(1, dt * 10);
    m.camera.updateProjectionMatrix();

    // recoil recovery
    m.recoil = Math.max(0, m.recoil - dt * 6);
    if (m.holdFire && m.locked) {
      const op = m.loadoutSafe();
      void op;
      const wpnAuto = m.currentWeapon === 'primary';
      if (wpnAuto) m.playerFire();
    }

    this.updateCamera();
  }

  updateCamera(): void {
    const m = this.match;
    const u = m.player;
    const eyeH = u.crouch ? CROUCH_H : EYE_H;
    const side = new THREE.Vector3(Math.cos(u.yaw), 0, -Math.sin(u.yaw));
    const leanOff = side.multiplyScalar(this.leanCur * 0.45);
    m.camera.position.set(
      u.pos.x + leanOff.x,
      u.pos.y + eyeH + Math.sin(this.bobT) * 0.03,
      u.pos.z + leanOff.z,
    );
    m.camera.rotation.order = 'YXZ';
    m.camera.rotation.y = u.yaw;
    m.camera.rotation.x = this.pitch + m.recoil * 0.05;
    m.camera.rotation.z = -this.leanCur * 0.12;
  }

  dispose(): void {
    for (const [ev, fn] of this.bound) window.removeEventListener(ev, fn);
  }
}
