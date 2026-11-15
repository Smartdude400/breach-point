// ============ Breach Point — HUD ============
import { unlockAudio } from './audio';
import type { GadgetKind, MatchPhase } from './types';
import { GADGETS } from './data';

export class HUD {
  root: HTMLElement;
  elHealthFill: HTMLElement;
  elHealthNum: HTMLElement;
  elGunName: HTMLElement;
  elAmmo: HTMLElement;
  elSlots: HTMLElement;
  elGadgets: HTMLElement;
  elTimerTime: HTMLElement;
  elTimerPhase: HTMLElement;
  elObjState: HTMLElement;
  elObjBar: HTMLElement;
  elObjFill: HTMLElement;
  elKillfeed: HTMLElement;
  elTeam: HTMLElement;
  elInteract: HTMLElement;
  elCenter: HTMLElement;
  elSub: HTMLElement;
  elScope: HTMLElement;
  elDrone: HTMLElement;
  elDroneBatt: HTMLElement;
  elSetup: HTMLElement;
  elCrosshair: HTMLElement;
  elHitmarker: HTMLElement;
  locked = false;

  constructor() {
    this.root = document.getElementById('hud-root') as HTMLElement;
    this.root.classList.add('visible');
    this.root.innerHTML = `
      <div id="hud-health" class="hud-corner">
        <div class="opname" id="hud-opname"></div>
        <div class="num" id="hud-hpnum">100</div>
        <div class="bar"><div class="fill" id="hud-hpfill"></div></div>
      </div>
      <div id="hud-weapon" class="hud-corner">
        <div class="gun-name" id="hud-gunname"></div>
        <div class="ammo"><span id="hud-mag">30</span> <span class="reserve">/ <span id="hud-res">120</span></span></div>
        <div class="slots" id="hud-slots"></div>
        <div class="gadget-row" id="hud-gadgets"></div>
      </div>
      <div id="hud-timer" class="hud-corner">
        <div class="time" id="hud-time">3:00</div>
        <div class="phase" id="hud-phase">ACTION</div>
        <div class="obj-state" id="hud-objstate"></div>
      </div>
      <div id="hud-objective-bar"><div class="fill"></div></div>
      <div id="hud-team" class="hud-corner"></div>
      <div id="killfeed"></div>
      <div id="interact-prompt"></div>
      <div id="center-msg"></div>
      <div id="sub-msg"></div>
      <div id="damage-vignette"></div>
      <div id="flash-overlay"></div>
      <div id="scope-overlay"><div class="vignette"></div>
        <div class="reticle"><div class="ring" style="width:110px;height:110px"></div>
        <div class="cross-h"></div><div class="cross-v"></div></div>
      </div>
      <div id="drone-hud">
        <div class="frame"></div>
        <div class="cam-tag">DRONE CAM · <span style="color:#ffb300">F</span> PING</div>
        <div class="batt" id="drone-batt">20s</div>
        <div class="scan"></div>
        <div class="hint">WASD move · R/C up/down · SPACE exit</div>
      </div>
      <div id="setup-hud"></div>
      <div id="pause-hint">CLICK TO PLAY · ESC TO PAUSE</div>
    `;
    const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
    this.elHealthFill = $('hud-hpfill');
    this.elHealthNum = $('hud-hpnum');
    this.elGunName = $('hud-gunname');
    this.elAmmo = $('hud-mag');
    this.elSlots = $('hud-slots');
    this.elGadgets = $('hud-gadgets');
    this.elTimerTime = $('hud-time');
    this.elTimerPhase = $('hud-phase');
    this.elObjState = $('hud-objstate');
    this.elObjBar = $('hud-objective-bar');
    this.elObjFill = this.elObjBar.querySelector('.fill') as HTMLElement;
    this.elKillfeed = $('killfeed');
    this.elTeam = $('hud-team');
    this.elInteract = $('interact-prompt');
    this.elCenter = $('center-msg');
    this.elSub = $('sub-msg');
    this.elScope = $('scope-overlay');
    this.elDrone = $('drone-hud');
    this.elDroneBatt = $('drone-batt');
    this.elSetup = $('setup-hud');
    this.elCrosshair = document.createElement('div');
    this.elCrosshair.id = 'crosshair';
    this.elCrosshair.innerHTML = '<div class="ch" style="left:16px;top:0;width:2px;height:10px"></div><div class="ch" style="left:16px;bottom:0;width:2px;height:10px"></div><div class="ch" style="top:16px;left:0;height:2px;width:10px"></div><div class="ch" style="top:16px;right:0;height:2px;width:10px"></div>';
    this.root.appendChild(this.elCrosshair);
    this.elHitmarker = document.createElement('div');
    this.elHitmarker.id = 'hitmarker';
    this.elHitmarker.innerHTML = '<div class="hm" style="left:10px;top:0;width:2px;height:22px"></div><div class="hm" style="left:0;top:10px;width:22px;height:2px"></div>';
    this.root.appendChild(this.elHitmarker);
  }

  bindPointerLock(canvas: HTMLCanvasElement, onLock: () => void, onUnlock: () => void): void {
    canvas.addEventListener('click', () => {
      unlockAudio();
      if (!this.locked) void canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) onLock(); else onUnlock();
    });
  }

  showMatchUI(): void {
    const pause = document.getElementById('pause-hint');
    if (pause) pause.style.display = 'block';
  }

  updateHealth(hp: number, max: number): void {
    const pct = Math.max(0, (hp / max) * 100);
    this.elHealthFill.style.width = `${pct}%`;
    this.elHealthNum.textContent = String(Math.ceil(hp));
    this.elHealthFill.style.background = pct > 55
      ? 'linear-gradient(90deg,#38e07b,#b7ff5c)'
      : pct > 25 ? 'linear-gradient(90deg,#e0b638,#ffd05c)' : 'linear-gradient(90deg,#e04838,#ff8a5c)';
  }

  updateWeapon(name: string, mag: number, reserve: number, slot: string, gadgets: GadgetKind[], gIdx: number): void {
    this.elGunName.textContent = name;
    this.elAmmo.textContent = String(mag);
    const res = this.root.querySelector('#hud-res') as HTMLElement;
    if (res) res.textContent = String(reserve);
    this.elSlots.innerHTML = `<span class="slot ${slot === 'PRIMARY' ? 'active' : ''}">1 PRIMARY</span> &nbsp; <span class="slot ${slot === 'SIDEARM' ? 'active' : ''}">2 P-92</span>`;
    this.elGadgets.innerHTML = gadgets.length === 0
      ? '<div class="gadget-slot empty">NO GADGETS</div>'
      : gadgets.map((g, i) => `<div class="gadget-slot ${i === gIdx ? 'active' : ''}">${GADGETS[g].name.toUpperCase()}</div>`).join('');
  }

  updateTimer(phase: MatchPhase, t: number): void {
    const mm = Math.floor(t / 60);
    const ss = Math.floor(t % 60);
    this.elTimerTime.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    this.elTimerPhase.textContent = phase === 'setup' ? 'SETUP PHASE' : phase === 'drone' ? 'DRONE PHASE' : phase === 'action' ? 'ACTION PHASE' : 'ROUND OVER';
  }

  updateTeams(allies: boolean[], foes: boolean[]): void {
    const pips = (arr: boolean[], foe: boolean) => arr.map((alive) => `<span class="pip ${foe ? 'foe' : ''} ${alive ? '' : 'dead'}"></span>`).join('');
    this.elTeam.innerHTML = `<span>YOU ${pips(allies, false)}</span> <span style="color:#8a94a6">ENEMY ${pips(foes, true)}</span>`;
  }

  setCapture(v: number, contesting: boolean): void {
    this.elObjBar.style.display = v > 0.01 || contesting ? 'block' : 'none';
    this.elObjFill.style.width = `${Math.min(1, v) * 100}%`;
    this.elObjState.textContent = contesting ? 'SECURING OBJECTIVE' : v > 0.01 ? 'CAPTURE PAUSED' : '';
  }

  killFeed(killer: string, victim: string, killerAtk: boolean, head: boolean): void {
    const div = document.createElement('div');
    div.className = 'kf';
    div.innerHTML = `<span class="${killerAtk ? 'a' : 'd'}">${killer}</span> ${head ? '⌖ ' : ''}▸ <span class="${killerAtk ? 'd' : 'a'}">${victim}</span>`;
    this.elKillfeed.prepend(div);
    setTimeout(() => div.remove(), 6000);
    while (this.elKillfeed.children.length > 5) this.elKillfeed.lastChild?.remove();
  }

  hitmark(head: boolean): void {
    this.elHitmarker.classList.remove('show');
    void this.elHitmarker.offsetWidth;
    this.elHitmarker.style.color = head ? '#ff5252' : '#fff';
    this.elHitmarker.classList.add('show');
  }

  pingEnemy(name: string): void {
    this.elObjState.textContent = `ENEMY TAGGED: ${name}`;
    setTimeout(() => { this.elObjState.textContent = ''; }, 3000);
  }

  centerMsg(main: string, sub: string, ms = 2600): void {
    this.elCenter.textContent = main;
    this.elSub.textContent = sub;
    setTimeout(() => {
      if (this.elCenter.textContent === main) this.elCenter.textContent = '';
      if (this.elSub.textContent === sub) this.elSub.textContent = '';
    }, ms);
  }

  showDrone(on: boolean): void {
    this.elDrone.classList.toggle('visible', on);
    this.elCrosshair.classList.toggle('hidden', on);
  }

  setDroneBattery(t: number): void {
    this.elDroneBatt.textContent = `${Math.ceil(t)}s`;
  }

  setScope(on: boolean): void {
    this.elScope.classList.toggle('visible', on);
  }

  setCrosshairVisible(v: boolean): void {
    this.elCrosshair.classList.toggle('hidden', !v);
  }

  showSetupTasks(on = true): void {
    this.elSetup.classList.toggle('visible', on);
    if (on) {
      this.elSetup.innerHTML = `
        <div class="task">AIM AT A WALL · <kbd>E</kbd> REINFORCE</div>
        <div class="task">AIM AT A DOOR · <kbd>E</kbd> BARRICADE</div>
        <div class="task">SETUP ENDS WHEN TIMER HITS 0</div>`;
    }
  }

  flash(op: number): void {
    const ov = document.getElementById('flash-overlay') as HTMLElement;
    ov.style.opacity = String(op);
  }

  dispose(): void {
    this.root.classList.remove('visible');
    this.root.innerHTML = '';
  }
}
