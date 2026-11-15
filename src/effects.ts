// ============ Breach Point — visual effects & smoke volumes ============
import * as THREE from 'three';

interface Tracer { mesh: THREE.Mesh; life: number }
interface Spark { vel: THREE.Vector3; mesh: THREE.Mesh; life: number }
interface SmokeCloud { pos: THREE.Vector3; r: number; life: number; group: THREE.Group }

export class Effects {
  scene: THREE.Scene;
  tracers: Tracer[] = [];
  sparks: Spark[] = [];
  smokes: SmokeCloud[] = [];
  muzzle: THREE.PointLight;
  muzzleT = 0;
  private tracerGeo = new THREE.BoxGeometry(0.03, 0.03, 1);
  private tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd68a, transparent: true, opacity: 0.9 });
  private sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  private debrisMats: THREE.MeshBasicMaterial[] = [];
  private smokeMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.muzzle = new THREE.PointLight(0xffc36b, 0, 9, 2);
    scene.add(this.muzzle);
    for (const c of [0x8f8469, 0x6e6552, 0x5a6270]) {
      this.debrisMats.push(new THREE.MeshBasicMaterial({ color: c }));
    }
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0xb9bcc2, transparent: true, opacity: 0.88, depthWrite: false });
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const len = from.distanceTo(to);
    if (len < 0.4) return;
    const m = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    m.scale.z = len;
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.06 });
  }

  impact(p: THREE.Vector3, n: THREE.Vector3): void {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      m.position.copy(p);
      this.scene.add(m);
      const v = n.clone().multiplyScalar(2.5)
        .add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3));
      this.sparks.push({ vel: v, mesh: m, life: 0.35 + Math.random() * 0.2 });
    }
  }

  debris(p: THREE.Vector3, steel = false): void {
    const mats = steel ? [this.debrisMats[2]] : this.debrisMats;
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(this.sparkGeo, mats[i % mats.length]);
      m.scale.setScalar(0.6 + Math.random() * 1.6);
      m.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * WALL_H_Q, (Math.random() - 0.5) * 1.6));
      this.scene.add(m);
      this.sparks.push({
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3.5, (Math.random() - 0.5) * 4),
        mesh: m,
        life: 0.7 + Math.random() * 0.5,
      });
    }
  }

  explosion(p: THREE.Vector3): void {
    const light = new THREE.PointLight(0xffa040, 60, 18, 2);
    light.position.copy(p).setY(1.4);
    this.scene.add(light);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffb054, transparent: true, opacity: 0.85 }),
    );
    ball.position.copy(p).setY(Math.max(0.8, p.y));
    this.scene.add(ball);
    this.tracers.push({ mesh: ball, life: 0.28 });
    const rec = { mesh: light as unknown as THREE.Mesh, life: 0.2 };
    this.tracers.push(rec);
    // remove light when its "life" expires — handled in update by name check
    (light as unknown as { isFxLight?: boolean }).isFxLight = true;
    this.debris(p, true);
  }

  smokeCloud(p: THREE.Vector3): void {
    const group = new THREE.Group();
    const puffs = 9;
    for (let i = 0; i < puffs; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), this.smokeMat);
      s.position.set((Math.random() - 0.5) * 2.2, 0.6 + Math.random() * 1.8, (Math.random() - 0.5) * 2.2);
      s.scale.setScalar(0.9 + Math.random() * 0.9);
      group.add(s);
    }
    group.position.copy(p);
    this.scene.add(group);
    this.smokes.push({ pos: p.clone(), r: 2.6, life: 10, group });
  }

  /** LOS check against active smoke clouds (segment vs sphere). */
  blockedBySmoke(a: THREE.Vector3, b: THREE.Vector3): boolean {
    for (const s of this.smokes) {
      const ab = b.clone().sub(a);
      const t = Math.max(0, Math.min(1, s.pos.clone().sub(a).dot(ab) / Math.max(0.0001, ab.lengthSq())));
      const closest = a.clone().add(ab.multiplyScalar(t));
      if (closest.distanceTo(s.pos) < s.r) return true;
    }
    return false;
  }

  update(dt: number): void {
    for (const t of this.tracers) {
      t.life -= dt;
      const mat = t.mesh.material as THREE.MeshBasicMaterial;
      mat.transparent = true;
      mat.opacity = Math.max(0, mat.opacity - dt * 6);
      if (t.mesh.scale.z === undefined) t.mesh.scale.setScalar(t.life * 14 + 0.5);
      if ((t.mesh as unknown as { isFxLight?: boolean }).isFxLight) {
        const l = t.mesh as unknown as THREE.PointLight;
        l.intensity = Math.max(0, l.intensity - dt * 300);
      } else if (t.mesh.geometry.type === 'SphereGeometry') {
        t.mesh.scale.setScalar((1 - t.life / 0.28) * 2.4 + 0.5);
      }
    }
    this.tracers = this.tracers.filter((t) => {
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        return false;
      }
      return true;
    });

    for (const s of this.sparks) {
      s.life -= dt;
      s.vel.y -= 12 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      if (s.mesh.position.y < 0.03) { s.mesh.position.y = 0.03; s.vel.multiplyScalar(0.4); s.vel.y = Math.abs(s.vel.y) * 0.3; }
    }
    this.sparks = this.sparks.filter((s) => {
      if (s.life <= 0) { this.scene.remove(s.mesh); return false; }
      return true;
    });

    for (const s of this.smokes) {
      s.life -= dt;
      const mat = this.smokeMat;
      mat.opacity = s.life < 1.5 ? Math.max(0, s.life / 1.5) * 0.88 : 0.88;
    }
    this.smokes = this.smokes.filter((s) => {
      if (s.life <= 0) { this.scene.remove(s.group); return false; }
      return true;
    });

    if (this.muzzleT > 0) {
      this.muzzleT -= dt;
      this.muzzle.intensity = Math.max(0, this.muzzleT * 60);
    }
  }

  flashMuzzle(p: THREE.Vector3): void {
    this.muzzle.position.copy(p);
    this.muzzleT = 0.05;
  }
}

const WALL_H_Q = 2.2;
