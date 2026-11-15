// ============ Breach Point — world builder: Canal House ============
import * as THREE from 'three';
import { CELL, DOORS, MAP_COLS, MAP_ROWS, ROOMS, SITES, WALL_H, WINDOWS } from './data';
import { GridWorld, KEY } from './physics';
import { Sfx } from './audio';

export function cellToWorld(x: number, y: number, cell = CELL): { x: number; z: number } {
  return { x: (x + 0.5) * cell - (cell * MAP_COLS) / 2, z: (y + 0.5) * cell - (cell * MAP_ROWS) / 2 };
}
export function worldToCell(wx: number, wz: number, cell = CELL): { x: number; y: number } {
  return { x: Math.floor((wx + (cell * MAP_COLS) / 2) / cell), y: Math.floor((wz + (cell * MAP_ROWS) / 2) / cell) };
}

const DRY_A = 0x8f8469;
const DRY_B = 0x7c7259;
const REIN = 0x59616e;
const CRACKED = 0x4a4436;

export class World {
  scene: THREE.Scene;
  world: GridWorld;
  panels = new Map<string, THREE.Mesh>();
  doorMeshes = new Map<string, THREE.Mesh>();
  windowMeshes = new Map<string, THREE.Mesh>();
  barricadeMeshes = new Map<string, THREE.Mesh>();
  canister: THREE.Mesh;
  canisterCell: { x: number; y: number };
  wallMat: THREE.MeshStandardMaterial;
  dryMats: THREE.MeshStandardMaterial[];
  reinMat: THREE.MeshStandardMaterial;
  crackMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, world: GridWorld, siteIndex: number) {
    this.scene = scene;
    this.world = world;
    this.wallMat = new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.95 });
    this.dryMats = [
      new THREE.MeshStandardMaterial({ color: DRY_A, roughness: 0.92 }),
      new THREE.MeshStandardMaterial({ color: DRY_B, roughness: 0.92 }),
    ];
    this.reinMat = new THREE.MeshStandardMaterial({ color: REIN, roughness: 0.5, metalness: 0.4 });
    this.crackMat = new THREE.MeshStandardMaterial({ color: CRACKED, roughness: 1 });

    for (const r of ROOMS) world.carveRoom(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
    for (const d of DOORS) world.carveDoor(d.x, d.y);
    for (const w of WINDOWS) world.addWindow(w.x, w.y);

    this.buildShell();
    this.buildPanels();
    this.buildDoors();
    this.buildWindows();
    this.buildProps();

    const site = SITES[siteIndex % SITES.length];
    this.canisterCell = { ...site.canister };
    const cc = cellToWorld(site.canister.x, site.canister.y);
    this.canister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8a018, emissive: 0x6b4a00, roughness: 0.4 }),
    );
    this.canister.position.set(cc.x, 0.55, cc.z);
    scene.add(this.canister);
  }

  /** Indestructible outer shell (border ring). */
  private buildShell(): void {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const { cols, rows } = this.world;
    const addBox = (i: number, j: number, run: number, along: 'x' | 'z'): void => {
      const c = cellToWorld(i, j);
      const m = new THREE.Mesh(geo, this.wallMat);
      if (along === 'x') {
        m.scale.set(run * CELL, WALL_H, CELL);
        m.position.set(c.x + ((run - 1) * CELL) / 2, WALL_H / 2, c.z);
      } else {
        m.scale.set(CELL, WALL_H, run * CELL);
        m.position.set(c.x, WALL_H / 2, c.z + ((run - 1) * CELL) / 2);
      }
      this.scene.add(m);
    };
    for (let j = 0; j < rows; j++) {
      if (this.world.wall[this.world.idx(0, j)] === 1) addBox(0, j, 1, 'x');
      if (this.world.wall[this.world.idx(cols - 1, j)] === 1) addBox(cols - 1, j, 1, 'x');
    }
    for (let i = 0; i < cols; i++) {
      if (this.world.wall[this.world.idx(i, 0)] === 1) addBox(i, 0, 1, 'z');
      if (this.world.wall[this.world.idx(i, rows - 1)] === 1) addBox(i, rows - 1, 1, 'z');
    }
  }

  /** One destructible panel per interior wall cell. */
  private buildPanels(): void {
    const { cols, rows } = this.world;
    const geoH = new THREE.BoxGeometry(CELL, WALL_H, CELL);
    for (let j = 1; j < rows - 1; j++) {
      for (let i = 1; i < cols - 1; i++) {
        if (!this.world.isWall(i, j)) continue;
        const panel = this.world.addPanel(i, j, 'h', 'soft');
        const mat = this.dryMats[(i + j) % 2];
        const m = new THREE.Mesh(geoH, mat);
        const c = cellToWorld(i, j);
        m.position.set(c.x, WALL_H / 2, c.z);
        m.userData.panelKey = KEY(i, j);
        this.scene.add(m);
        this.panels.set(KEY(i, j), m);
        void panel;
      }
    }
  }

  private buildDoors(): void {
    const doorGeo = new THREE.BoxGeometry(CELL * 0.92, 2.2, 0.12);
    for (const d of DOORS) {
      const c = cellToWorld(d.x, d.y);
      const key = KEY(d.x, d.y);
      const vertical = this.world.isWall(d.x - 1, d.y) && this.world.isWall(d.x + 1, d.y);
      const mesh = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.8 }));
      if (vertical) mesh.rotation.y = Math.PI / 2;
      mesh.position.set(c.x, 1.1, c.z);
      mesh.userData.baseRot = mesh.rotation.y;
      this.scene.add(mesh);
      this.doorMeshes.set(key, mesh);
      const bar = this.makeBarricade(c.x, c.z, vertical);
      this.barricadeMeshes.set(key, bar);
      this.scene.add(bar);
    }
  }

  private buildWindows(): void {
    const winGeo = new THREE.BoxGeometry(CELL, 1.0, 0.12);
    for (const w of WINDOWS) {
      const c = cellToWorld(w.x, w.y);
      const key = 'w' + KEY(w.x, w.y);
      const vertical = w.x === 0 || w.x === MAP_COLS - 1;
      const mesh = new THREE.Mesh(winGeo, new THREE.MeshStandardMaterial({ color: 0x30404a, roughness: 0.25, metalness: 0.3 }));
      if (vertical) mesh.rotation.y = Math.PI / 2;
      mesh.position.set(c.x, 2.2, c.z);
      this.scene.add(mesh);
      this.windowMeshes.set(KEY(w.x, w.y), mesh);
      const bar = this.makeBarricade(c.x, c.z, vertical);
      this.barricadeMeshes.set(key, bar);
      this.scene.add(bar);
    }
  }

  private makeBarricade(x: number, z: number, vertical: boolean): THREE.Mesh {
    const g = vertical
      ? new THREE.BoxGeometry(0.16, 2.2, CELL * 0.94)
      : new THREE.BoxGeometry(CELL * 0.94, 2.2, 0.16);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x7a5c32, roughness: 0.85 }));
    m.position.set(x, 1.1, z);
    m.visible = false;
    return m;
  }

  private buildProps(): void {
    const crateMats = [
      new THREE.MeshStandardMaterial({ color: 0x4a5563, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x3e4a42, roughness: 0.9 }),
    ];
    const crates: Array<[number, number, number, number]> = [
      [4, 11, 1, 0], [5.5, 11.2, 1, 1], [4.3, 12.8, 0.8, 2],
      [19, 11, 1, 1], [22.5, 13.5, 1, 0], [31, 11.5, 1, 2], [33.5, 13, 1, 0],
      [5, 18.5, 1, 2], [8, 20, 1, 0], [19, 18.5, 1, 1], [23, 20.5, 1, 2],
      [31, 18.5, 1, 0], [35, 20, 1, 1], [4, 28.5, 1, 1], [9, 29.5, 1, 0],
      [17, 28.5, 1, 2], [24, 29.5, 1, 1], [31, 28.5, 1, 0], [37, 29.5, 1, 2],
      [17, 3, 1, 0], [22, 4, 1, 2], [32, 3, 1, 1], [38, 4, 1, 0],
    ];
    for (const [x, z, s, mi] of crates) {
      const c = cellToWorld(x, z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMats[mi % crateMats.length]);
      m.position.set(c.x, s / 2, c.z);
      m.rotation.y = ((x * 7 + z * 13) % 4) * Math.PI * 0.25;
      this.scene.add(m);
    }
    const pilMat = new THREE.MeshStandardMaterial({ color: 0x232830, roughness: 0.95 });
    const pilGeo = new THREE.BoxGeometry(0.5, WALL_H, 0.5);
    for (const [x, z] of [[9, 8], [20, 8], [31, 8], [9, 25], [20, 25], [31, 25]]) {
      const c = cellToWorld(x, z);
      const m = new THREE.Mesh(pilGeo, pilMat);
      m.position.set(c.x, WALL_H / 2, c.z);
      this.scene.add(m);
    }
  }

  panelMesh(key: string): THREE.Mesh | undefined { return this.panels.get(key); }

  refreshPanel(key: string): void {
    const mesh = this.panels.get(key);
    const panel = this.world.panels.get(key);
    if (!mesh || !panel) return;
    if (panel.state === 3) { mesh.visible = false; return; }
    mesh.visible = true;
    if (panel.state === 0) {
      mesh.material = panel.reinforced ? this.reinMat : this.dryMats[(panel.x + panel.y) % 2];
      mesh.scale.set(1, 1, 1);
    } else if (panel.state === 1) {
      mesh.material = panel.reinforced ? this.reinMat : this.crackMat;
      mesh.scale.set(1, 0.98, 1);
    } else {
      mesh.material = panel.reinforced ? this.reinMat : this.crackMat;
      mesh.scale.set(0.45, 0.45, 0.45);
      mesh.position.y = WALL_H * 0.22;
    }
  }

  reinforce(key: string): boolean {
    const panel = this.world.panels.get(key);
    if (!panel || panel.material !== 'soft' || panel.reinforced || panel.state !== 0) return false;
    panel.reinforced = true;
    panel.material = 'reinforced';
    this.refreshPanel(key);
    return true;
  }

  damagePanel(key: string, amount: number, pierceSteel: boolean): boolean {
    const panel = this.world.panels.get(key);
    const mesh = this.panels.get(key);
    if (!panel || !mesh) return false;
    if (panel.state === 3) return false;
    if (panel.reinforced && !pierceSteel) return false;
    panel.hp -= amount;
    if (panel.state === 0 && panel.hp <= 70) { panel.state = 1; this.refreshPanel(key); }
    if (panel.state === 1 && panel.hp <= 35) { panel.state = 2; this.refreshPanel(key); }
    if (panel.hp <= 0) { this.destroyPanel(key); return true; }
    return false;
  }

  destroyPanel(key: string): void {
    const panel = this.world.panels.get(key);
    const mesh = this.panels.get(key);
    if (!panel || !mesh || panel.state === 3) return;
    panel.state = 3;
    mesh.visible = false;
    this.world.wall[this.world.idx(panel.x, panel.y)] = 0;
    Sfx.wallBreak({ pos: mesh.position, maxDist: 70 });
  }

  setBarricade(key: string, level: 0 | 1 | 2 | 3): void {
    const bar = this.barricadeMeshes.get(key);
    if (bar) bar.visible = level > 0;
    const door = this.world.doors.get(key);
    if (door) door.barricade = level;
    const win = this.world.windows.get('w' + key) ?? this.world.windows.get(key);
    void win;
  }

  update(dt: number): void {
    void dt;
  }
}
