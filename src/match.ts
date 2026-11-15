// ============ Breach Point — match orchestration & game loop ============
import * as THREE from 'three';
import {
  ATK_SPAWNS, CELL, DEF_SPAWNS, MAP_COLS, MAP_ROWS, SITES, WALL_H,
} from './data';
import { GridWorld } from './physics';
import { NavGrid } from './nav';
import { World, cellToWorld, worldToCell } from './world';
import { Effects } from './effects';
import { Gadgets } from './gadgets';
import { Unit } from './units';
import { fireWeapon } from './weapons';
import { Sfx } from './audio';
import { HUD } from './hud';
import { opById, SIGHTS, SKINS, WEAPONS } from './data';
import type { Loadout, MatchPhase } from './types';
import { BotBrain, nearestEnemyTo } from './bots';
import { PlayerCtl } from './player';
import { DroneCtl } from './drone';

export interface MatchOpts {
  playerSide: 'atk' | 'def';
  playerOpId: string;
  loadout: Loadout;
  onMatchOver: (won: boolean, kills: number, deaths: number) => void;
}

export class Match {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  world: GridWorld;
  nav: NavGrid;
  wviz: World;
  fx: Effects;
  gadgets: Gadgets;
  hud: HUD;
  units: Unit[] = [];
  bots: BotBrain[] = [];
  player: Unit;
  playerCtl: PlayerCtl;
  drone: DroneCtl | null = null;
  droneUsed = false;
  phase: MatchPhase;
  phaseT: number;
  capture01 = 0;
  siteIndex: number;
  playerKills = 0;
  playerDeaths = 0;
  over = false;
  keys: Set<string> = new Set();
  lean = 0;
  recoil = 0;
  ads = false;
  currentWeapon: 'primary' | 'secondary' = 'primary';
  aimPanelKey: string | undefined;
  gunT = 0;
  fireCd = 0;
  reloading = 0;
  ammo: Record<string, { mag: number; reserve: number }>;
  locked = false;
  holdFire = false;
  onMatchOver: MatchOpts['onMatchOver'];

  constructor(private opts: MatchOpts, renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement) {
    this.onMatchOver = opts.onMatchOver;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.Fog(0x0d1117, 30, 70);
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 120);

    this.world = new GridWorld(MAP_COLS, MAP_ROWS, CELL);
    this.nav = new NavGrid(this.world);
    this.siteIndex = Math.floor(Math.random() * SITES.length);
    this.wviz = new World(this.scene, this.world, this.siteIndex);
    this.fx = new Effects(this.scene);
    this.gadgets = new Gadgets(this.scene, this.world, this.wviz, this.fx);
    this.gadgets.cellBroken = (x, y) => this.onCellBroken(x, y);
    this.gadgets.damageUnit = (u, dmg, from, head) => {
      u.takeDamage(dmg, from, head);
      if (u === this.player && u.dead) this.playerDeaths++;
    };
    this.hud = new HUD();
    this.phase = opts.playerSide === 'def' ? 'setup' : 'drone';
    this.phaseT = this.phase === 'setup' ? 45 : 20;

    // lighting
    const hemi = new THREE.HemisphereLight(0x9fb4cc, 0x1a1d24, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe7c4, 1.1);
    sun.position.set(18, 30, -12);
    this.scene.add(sun);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.PointLight(0xffe0b0, 6, 14, 2);
      const c = cellToWorld(6 + i * 6, 8 + (i % 3) * 8);
      p.position.set(c.x, WALL_H - 0.4, c.z);
      this.scene.add(p);
    }

    // units
    const atkOps = ['ram', 'ember'];
    const defOps = ['bastion', 'aegis'];
    const playerOp = opById(opts.playerOpId);
    const skin = SKINS.find((s) => s.id === opts.loadout.skin) ?? SKINS[0];
    const spawns = opts.playerSide === 'atk' ? ATK_SPAWNS : DEF_SPAWNS;
    const spawnIdx = Math.floor(Math.random() * spawns.length);
    this.player = new Unit({
      side: opts.playerSide, opId: playerOp.id, opName: playerOp.name,
      pos: this.spawnWorld(spawns[spawnIdx]), yaw: opts.playerSide === 'atk' ? Math.PI : 0,
      isBot: false, skinTint: skin.tint, speed: 4.6, maxHp: 100,
      weaponName: playerOp.primary.name,
    });
    this.scene.add(this.player.group);
    this.units.push(this.player);
    this.playerCtl = new PlayerCtl(this, canvas);

    const mateOpIds = (opts.playerSide === 'atk' ? atkOps : defOps).filter((id) => id !== opts.playerOpId);
    const foeOpIds = opts.playerSide === 'atk' ? defOps : atkOps;
    let bi = 0;
    for (const id of mateOpIds) {
      this.spawnBot(id, opts.playerSide, spawns[(spawnIdx + 1 + bi) % spawns.length]);
      bi++;
    }
    const foeSpawns = opts.playerSide === 'atk' ? DEF_SPAWNS : ATK_SPAWNS;
    for (const id of foeOpIds) {
      this.spawnBot(id, opts.playerSide === 'atk' ? 'def' : 'atk', foeSpawns[bi % foeSpawns.length]);
      bi++;
    }

    this.ammo = {};
    for (const u of this.units) {
      const op = opById(u.opId);
      this.ammo[u.opId + u.side] = { mag: op.primary.magSize, reserve: op.primary.reserve };
    }
    const p92 = WEAPONS.p92;
    this.ammo['p92' + opts.playerSide] = { mag: p92.magSize, reserve: p92.reserve };


    this.hud.bindPointerLock(canvas, () => { this.locked = true; }, () => { this.locked = false; });
    this.hud.showMatchUI();
    if (this.phase === 'setup') this.hud.showSetupTasks();
    if (this.phase === 'drone') this.deployDrone();
  }

  private spawnWorld(s: { x: number; y: number }): THREE.Vector3 {
    const c = cellToWorld(s.x, s.y);
    return new THREE.Vector3(c.x, 0, c.z);
  }

  private spawnBot(opId: string, side: 'atk' | 'def', spawn: { x: number; y: number }): void {
    const op = opById(opId);
    const bot = new Unit({
      side, opId, opName: op.name,
      pos: this.spawnWorld(spawn),
      yaw: side === 'atk' ? Math.PI : 0,
      isBot: true, skinTint: side === 'atk' ? 0x6e4a3a : 0x3a5a78, speed: 3.9, maxHp: 100,
      weaponName: op.primary.name,
    });
    this.scene.add(bot.group);
    this.units.push(bot);
    this.bots.push(new BotBrain(this, bot));
  }

  onCellBroken(x: number, y: number): void {
    this.nav.notifyDestroyed(x, y);
    Sfx.wallBreak({ pos: cellToWorld(x, y), maxDist: 60 });
  }

  solidAtWorld(x: number, z: number): boolean {
    const c = worldToCell(x, z);
    return this.world.isWall(c.x, c.y);
  }

  nearestEnemy(unit: Unit): Unit | null {
    return nearestEnemyTo(unit, this.units);
  }

  playerFire(): void {
    const op = opById(this.player.opId);
    const wpn = this.currentWeapon === 'primary' ? op.primary : WEAPONS.p92;
    const key = this.currentWeapon === 'primary'
      ? this.player.opId + this.player.side
      : 'p92' + this.player.side;
    const a = this.ammo[key];
    if (!a || this.reloading > 0) return;
    if (a.mag <= 0) { Sfx.dryFire(); return; }
    const now = performance.now() / 1000;
    if (now - this.fireCd < 60 / wpn.rpm) return;
    this.fireCd = now;
    a.mag--;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const origin = this.camera.position.clone();
    const spread = this.ads ? wpn.adsSpreadDeg : wpn.spreadDeg;
    fireWeapon({
      scene: this.scene, world: this.world, wviz: this.wviz, fx: this.fx,
      units: this.units, shooter: this.player, origin, dir, spec: wpn,
      spreadDeg: spread,
      blockedBySmoke: (a2, b2) => this.fx.blockedBySmoke(a2, b2),
      cellBroken: (x, y) => this.onCellBroken(x, y),
      soundKind: this.currentWeapon === 'primary' ? this.gunSoundKind(wpn.id) : 'pistol',
      listener: { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw },
    });
    this.recoil = Math.min(2.2, this.recoil + wpn.recoilKick);
    this.gunT = 0.08;
  }

  gunSoundKind(id: string): 'rifle' | 'smg' | 'shotgun' | 'pistol' {
    if (id === 'trench12') return 'shotgun';
    if (id === 'vex9' || id === 'anvilp') return 'smg';
    if (id === 'p92') return 'pistol';
    return 'rifle';
  }

  loadoutSafe(): Loadout {
    return this.opts.loadout;
  }

  startReload(): void {
    const op = opById(this.player.opId);
    const wpn = this.currentWeapon === 'primary' ? op.primary : WEAPONS.p92;
    const key = this.currentWeapon === 'primary'
      ? this.player.opId + this.player.side
      : 'p92' + this.player.side;
    const a = this.ammo[key];
    if (!a || this.reloading > 0 || a.mag === wpn.magSize || a.reserve <= 0) return;
    this.reloading = wpn.reloadTime;
    Sfx.reloadClick();
  }

  finishReload(): void {
    const op = opById(this.player.opId);
    const wpn = this.currentWeapon === 'primary' ? op.primary : WEAPONS.p92;
    const key = this.currentWeapon === 'primary'
      ? this.player.opId + this.player.side
      : 'p92' + this.player.side;
    const a = this.ammo[key];
    if (!a) return;
    const need = wpn.magSize - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
  }

  useGadget(): void {
    const lo = this.opts.loadout;
    if (lo.gadgets.length === 0) return;
    const kind = lo.gadgets[this.gadgetIdx % lo.gadgets.length];
    const origin = this.camera.position.clone();
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    if (kind === 'breach') {
      const hit = this.aimPanelKey;
      if (hit) {
        const panel = this.world.panels.get(hit);
        if (panel && !panel.reinforced && panel.state === 0) {
          this.gadgets.plantBreach(hit, this.wviz.panels.get(hit)?.position ?? origin, this.player, (pos, pierce) => {
            this.gadgets.shatterPanels(pos, 1.9, pierce);
          });
          this.consumeGadget();
        }
      }
      return;
    }
    this.gadgets.throwGrenade(kind, origin, dir, this.player);
    this.consumeGadget();
  }

  gadgetIdx = 0;

  consumeGadget(): void {
    const lo = this.opts.loadout;
    lo.gadgets.splice(this.gadgetIdx % lo.gadgets.length, 1);
    this.gadgetIdx = 0;
    this.hud.updateWeapon('', 0, 0, 'PRIMARY', lo.gadgets, 0);
  }

  cycleGadget(): void {
    if (this.opts.loadout.gadgets.length > 1) {
      this.gadgetIdx = (this.gadgetIdx + 1) % this.opts.loadout.gadgets.length;
      this.hud.updateWeapon('', 0, 0, 'PRIMARY', this.opts.loadout.gadgets, this.gadgetIdx);
    }
  }

  deployDrone(): void {
    if (this.droneUsed) return;
    this.droneUsed = true;
    this.drone = new DroneCtl(this);
    this.hud.showDrone(true);
  }

  exitDrone(): void {
    if (this.drone) {
      this.drone.dispose();
      this.drone = null;
      this.hud.showDrone(false);
    }
  }

  doAbility(): void {
    const op = opById(this.player.opId);
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const origin = this.camera.position.clone();
    if (op.id === 'ram') {
      const key = this.aimPanelKey;
      if (key) {
        const panel = this.world.panels.get(key);
        if (panel && !panel.reinforced && panel.state !== 3) {
          this.wviz.destroyPanel(key);
          this.onCellBroken(panel.x, panel.y);
          Sfx.wallBreak({ pos: this.wviz.panels.get(key)?.position, maxDist: 50 });
        } else if (panel?.reinforced) {
          Sfx.dryFire();
        }
      }
      const bar = this.aimBarricadeKey();
      if (bar) this.wviz.setBarricade(bar, 0);
    } else if (op.id === 'ember') {
      const key = this.aimPanelKey;
      if (key) {
        const panel = this.world.panels.get(key);
        if (panel) {
          panel.reinforced = true;
          panel.material = 'reinforced';
          this.wviz.damagePanel(key, 999, true);
          this.onCellBroken(panel.x, panel.y);
          this.fx.explosion(origin.addScaledVector(dir, 2));
          Sfx.explosion({ pos: origin, maxDist: 60 });
        }
      }
    } else if (op.id === 'bastion') {
      this.player.armored = true;
      for (const u of this.units) {
        if (u.side === this.player.side && u.pos.distanceTo(this.player.pos) < 3) u.armored = true;
      }
      Sfx.uiConfirm();
    } else if (op.id === 'aegis') {
      const bar = this.aimBarricadeKey();
      if (bar) this.wviz.setBarricade(bar, 3);
      Sfx.uiConfirm();
    }
  }

  aimBarricadeKey(): string | undefined {
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const origin = this.camera.position.clone();
    const ray = new THREE.Raycaster(origin, dir, 0.1, 2.6);
    const objs: THREE.Object3D[] = [];
    for (const [k, m] of this.wviz.barricadeMeshes) if (m.visible) { m.userData.doorKey = k.replace(/^w/, ''); objs.push(m); }
    const hits = ray.intersectObjects(objs, false);
    if (hits.length > 0) {
      const k = hits[0].object.userData.doorKey as string;
      return k;
    }
    return undefined;
  }

  updateAimPanel(): void {
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const origin = this.camera.position.clone();
    const ray = new THREE.Raycaster(origin, dir, 0.1, 2.4);
    const objs: THREE.Object3D[] = [];
    for (const m of this.wviz.panels.values()) if (m.visible) objs.push(m);
    const hits = ray.intersectObjects(objs, false);
    this.aimPanelKey = hits.length > 0 ? (hits[0].object.userData.panelKey as string) : undefined;
  }

  endRound(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.phase = 'over';
    this.hud.centerMsg(won ? 'ROUND WON' : 'ROUND LOST', '');
    if (won) Sfx.winSting(); else Sfx.lossSting();
    setTimeout(() => this.onMatchOver(won, this.playerKills, this.playerDeaths), 2600);
  }

  checkTeamWipe(): void {
    const atkAlive = this.units.filter((u) => u.side === 'atk' && !u.dead).length;
    const defAlive = this.units.filter((u) => u.side === 'def' && !u.dead).length;
    if (atkAlive === 0) this.endRound(this.player.side === 'def');
    else if (defAlive === 0) this.endRound(this.player.side === 'atk');
  }

  updateCapture(dt: number): void {
    const site = SITES[this.siteIndex];
    const c = cellToWorld(site.canister.x, site.canister.y);
    const atkIn = this.units.some((u) => u.side === 'atk' && !u.dead && Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < 2.6);
    const defIn = this.units.some((u) => u.side === 'def' && !u.dead && Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < 2.6);
    if (this.phase !== 'action') { this.capture01 = 0; this.hud.setCapture(this.capture01, false); return; }
    if (atkIn && !defIn) {
      this.capture01 += dt / 5;
      if (this.capture01 >= 1) this.endRound(this.player.side === 'atk');
    } else {
      this.capture01 = Math.max(0, this.capture01 - dt / 2.5);
    }
    this.hud.setCapture(this.capture01, atkIn && !defIn);
  }

  advancePhase(): void {
    if (this.phase === 'setup') {
      this.phase = 'action';
      this.phaseT = 180;
      this.hud.showSetupTasks(false);
      this.hud.centerMsg('ACTION PHASE', 'Attackers inbound', 2200);
    } else if (this.phase === 'drone') {
      this.exitDrone();
      this.phase = 'action';
      this.phaseT = 180;
      this.hud.centerMsg('ACTION PHASE', 'Find and secure the objective', 2200);
    }
  }

  setupAction(): void {
    // defender setup interactions: reinforce/barricade near aim
    const key = this.aimPanelKey;
    if (key) {
      const panel = this.world.panels.get(key);
      if (panel && !panel.reinforced && panel.state === 0) {
        if (this.wviz.reinforce(key)) {
          Sfx.uiConfirm();
          this.setupReinforced++;
        }
      }
    }
    const bar = this.aimBarricadeKey();
    if (bar) {
      this.wviz.setBarricade(bar, 3);
      this.setupBarricaded++;
      Sfx.uiClick();
    }
  }

  setupReinforced = 0;
  setupBarricaded = 0;

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    if (this.phase !== 'over') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.phase === 'action') this.endRound(this.player.side === 'def');
        else this.advancePhase();
      }
    }

    this.updateAimPanel();
    this.playerCtl.update(dt);
    if (this.drone) this.drone.update(dt);
    for (const b of this.bots) b.update(dt);
    for (const u of this.units) {
      u.group.position.copy(u.pos);
      u.group.rotation.y = u.yaw;
      if (u.blindT > 0) u.blindT -= dt;
    }
    this.gadgets.update(dt);
    this.fx.update(dt);
    this.wviz.update(dt);
    this.updateCapture(dt);
    this.checkTeamWipe();

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(); }
    }
    if (this.keys.has('KeyR')) this.startReload();

    const camUser = this.drone ? this.drone.camera : null;
    const cam = camUser ?? this.camera;
    this.renderer.render(this.scene, cam);
    this.hud.updateTimer(this.phase, Math.max(0, this.phaseT));
    this.hud.updateTeams(
      this.units.filter((u) => u.side === this.player.side).map((u) => !u.dead),
      this.units.filter((u) => u.side !== this.player.side).map((u) => !u.dead),
    );
    this.hud.updateHealth(this.player.hp, this.player.maxHp);
    const op = opById(this.player.opId);
    const wpn = this.currentWeapon === 'primary' ? op.primary : WEAPONS.p92;
    const key = this.currentWeapon === 'primary'
      ? this.player.opId + this.player.side
      : 'p92' + this.player.side;
    const a = this.ammo[key] ?? { mag: 0, reserve: 0 };
    this.hud.updateWeapon(wpn.name, a.mag, a.reserve, this.currentWeapon === 'primary' ? 'PRIMARY' : 'SIDEARM', this.opts.loadout.gadgets, this.gadgetIdx);
    this.hud.setCrosshairVisible(!this.ads && !this.drone);
    this.hud.setScope(this.ads && SIGHTS[this.opts.loadout.sight].overlay === 'scope');
  }

  dispose(): void {
    this.hud.dispose();
    this.playerCtl.dispose();
  }
}
