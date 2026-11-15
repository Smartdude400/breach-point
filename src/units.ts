// ============ Breach Point — units: player + bots share movement/combat ============
import * as THREE from 'three';
import { EYE_H } from './data';
export interface UnitInit {
  side: 'atk' | 'def';
  opName: string;
  opId: string;
  pos: THREE.Vector3;
  yaw: number;
  isBot: boolean;
  skinTint: number;
  speed: number;
  maxHp: number;
  weaponName: string;
}

export class Unit {
  side: 'atk' | 'def';
  opName: string;
  opId: string;
  pos: THREE.Vector3;
  yaw: number;
  isBot: boolean;
  speed: number;
  hp: number;
  maxHp: number;
  dead = false;
  crouch = false;
  blindT = 0;
  armored = false;
  kills = 0;
  weaponName: string;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;

  constructor(init: UnitInit) {
    this.side = init.side;
    this.opName = init.opName;
    this.opId = init.opId;
    this.pos = init.pos.clone();
    this.yaw = init.yaw;
    this.isBot = init.isBot;
    this.speed = init.speed;
    this.maxHp = init.maxHp;
    this.hp = init.maxHp;
    this.weaponName = init.weaponName;

    this.group = new THREE.Group();
    const tint = new THREE.Color(init.skinTint);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 4, 8), this.bodyMat);
    body.position.y = 0.95;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9a184, roughness: 0.6 }),
    );
    head.position.y = 1.62;
    this.hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 1.85, 6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.hitMesh.position.y = 0.92;
    this.hitMesh.userData.unitRef = this;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.1, 0.06),
      new THREE.MeshBasicMaterial({ color: init.side === 'atk' ? 0xff8a50 : 0x58b6ff }),
    );
    visor.position.set(0, 1.64, -0.19);
    this.group.add(body, head, visor, this.hitMesh);
    this.group.position.copy(this.pos);
  }

  /** Matches the three.js camera convention: yaw = camera.rotation.y. */
  forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  eyePos(): THREE.Vector3 {
    const h = this.crouch ? EYE_H * 0.62 : EYE_H;
    return new THREE.Vector3(this.pos.x, h, this.pos.z);
  }

  takeDamage(dmg: number, from: Unit, head: boolean): void {
    if (this.dead) return;
    if (this.armored) dmg *= 0.7;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.group.visible = false;
      from.kills++;
    }
    void head;
  }

  blind(t: number): void {
    this.blindT = Math.max(this.blindT, t);
  }

  healFull(): void { this.hp = this.maxHp; }
}
