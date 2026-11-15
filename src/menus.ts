// ============ Breach Point — DOM menus ============
import { GADGETS, GADGET_ORDER, OPERATORS, SIGHTS, SKINS, opById } from './data';
import type { GadgetKind, Loadout, SightId } from './types';
import type { SaveData } from './persistence';
import { Sfx } from './audio';

export interface MenuHooks {
  onStart(side: 'atk' | 'def', opId: string, loadout: Loadout): void;
  getSave(): SaveData;
  writeSave(s: SaveData): void;
}

const el = document.getElementById('menu-root') as HTMLElement;

function screen(html: string): HTMLElement {
  el.innerHTML = `<div class="menu-screen solid">${html}</div>`;
  const back = el.querySelector('[data-back]') as HTMLElement | null;
  if (back) back.addEventListener('click', () => { Sfx.uiClick(); showMain(); });
  return el.firstElementChild as HTMLElement;
}

export function hideMenus(): void { el.classList.remove('visible'); el.innerHTML = ''; }

function topbar(title: string): string {
  return `<div class="menu-topbar"><div class="title">${title}</div><button class="btn small" data-back>◂ BACK</button></div>`;
}

// ---------- main menu ----------
export function showMain(): void {
  el.classList.add('visible');
  el.innerHTML = `
    <div class="menu-screen">
      <div class="kicker">TACTICAL // CLOSE QUARTERS</div>
      <h1 class="game-title">BREACH<span>POINT</span></h1>
      <div class="menu-buttons">
        <button class="btn primary" id="btn-play">▶ PLAY</button>
        <button class="btn" id="btn-locker">LOCKER</button>
        <button class="btn" id="btn-howto">HOW TO PLAY</button>
      </div>
      <div class="menu-footer">BOTS · 1 ROUND · SECURE THE OBJECTIVE — v1.0</div>
    </div>`;
  (document.getElementById('btn-play') as HTMLButtonElement).onclick = () => { Sfx.uiConfirm(); showSideSelect(); };
  (document.getElementById('btn-locker') as HTMLButtonElement).onclick = () => { Sfx.uiClick(); showLocker(); };
  (document.getElementById('btn-howto') as HTMLButtonElement).onclick = () => { Sfx.uiClick(); showHowTo(); };
}

// ---------- side select ----------
function showSideSelect(): void {
  const s = screen(`
    ${topbar('SELECT SIDE')}
    <div class="sub-screen">
      <div class="head"><h2>Attack or Defense?</h2></div>
      <div class="screen-body">
        <div class="panel-box" style="flex:1;cursor:pointer" id="pick-atk">
          <h3 style="color:var(--atk);letter-spacing:3px">ATTACK</h3>
          <p style="color:var(--muted);font-size:14px;margin-top:8px;line-height:1.6">
            Drone ahead, breach walls, and secure the objective canister before the clock runs out.</p>
        </div>
        <div class="panel-box" style="flex:1;cursor:pointer" id="pick-def">
          <h3 style="color:var(--def);letter-spacing:3px">DEFENSE</h3>
          <p style="color:var(--muted);font-size:14px;margin-top:8px;line-height:1.6">
            Set up during the setup phase: reinforce walls, barricade doors — then hold the site.</p>
        </div>
      </div>
    </div>`);
  (s.querySelector('#pick-atk') as HTMLElement).onclick = () => { Sfx.uiConfirm(); showOperatorSelect('atk'); };
  (s.querySelector('#pick-def') as HTMLElement).onclick = () => { Sfx.uiConfirm(); showOperatorSelect('def'); };
}

// ---------- operator select + loadout ----------
let pickedSide: 'atk' | 'def' = 'atk';
let pickedOp = 'ram';
let pickedSight: SightId = 'reddot';
let pickedGadgets: GadgetKind[] = ['flash', 'smoke'];
let menuHooks: MenuHooks;

export function initMenus(hooks: MenuHooks): void {
  menuHooks = hooks;
  showMain();
}

function showOperatorSelect(side: 'atk' | 'def'): void {
  pickedSide = side;
  const save = menuHooks.getSave();
  const ops = OPERATORS.filter((o) => o.side === side);
  pickedOp = ops[0].id;
  const lo = save.loadouts[pickedOp];
  pickedSight = lo.sight;
  pickedGadgets = [...lo.gadgets];
  render();
  function render(): void {
    const s = screen(`
      ${topbar('OPERATOR SELECT')}
      <div class="sub-screen">
        <div class="head"><h2>${side === 'atk' ? 'Attackers' : 'Defenders'}</h2></div>
        <div class="screen-body">
          <div style="flex:1;display:flex;flex-direction:column;gap:12px">
            <div class="op-grid" style="grid-template-columns:repeat(2,1fr)">
              ${ops.map((o) => `
                <div class="op-card ${o.id === pickedOp ? 'selected' : ''} ${o.side}" data-op="${o.id}">
                  <span class="side-tag">${o.side === 'atk' ? 'ATTACKER' : 'DEFENDER'}</span>
                  <div class="op-portrait"><canvas data-portrait="${o.id}" width="240" height="130"></canvas></div>
                  <h3>${o.name}</h3>
                  <div class="role">${o.role}</div>
                  <div class="gun">Primary: ${o.primary.name}</div>
                  <div class="gadget-line">⚡ ${o.ability}</div>
                </div>`).join('')}
            </div>
            <div class="panel-box" id="op-detail" style="min-height:80px"></div>
          </div>
          <div class="loadout-panel">
            <h4>Sight</h4>
            <div class="opt-row" id="sight-row"></div>
            <h4 style="margin-top:8px">Gadgets (pick 2)</h4>
            <div class="opt-row" id="gadget-row"></div>
            <div class="loadout-footer">
              <button class="btn primary" id="btn-start">DEPLOY ▸</button>
            </div>
          </div>
        </div>
      </div>`);
    // portrait doodles
    for (const c of Array.from(s.querySelectorAll('canvas[data-portrait]')) as HTMLCanvasElement[]) {
      drawPortrait(c, c.dataset.portrait as string);
    }
    const op = opById(pickedOp);
    (s.querySelector('#op-detail') as HTMLElement).innerHTML = `
      <b style="letter-spacing:2px">${op.name} — ${op.role}</b>
      <p style="color:#c6ceda;font-size:14px;margin-top:6px">${op.blurb}</p>
      <p style="color:var(--accent);font-size:13px;margin-top:6px">${op.ability}: ${op.abilityDesc}</p>`;
    const sightRow = s.querySelector('#sight-row') as HTMLElement;
    sightRow.innerHTML = op.primary.sights.map((id) => `
      <button class="opt-chip ${id === pickedSight ? 'selected' : ''}" data-sight="${id}">${SIGHTS[id].name}</button>`).join('');
    sightRow.querySelectorAll('button').forEach((b) => {
      (b as HTMLElement).onclick = () => { pickedSight = (b as HTMLElement).dataset.sight as SightId; Sfx.uiClick(); render(); };
    });
    const gadRow = s.querySelector('#gadget-row') as HTMLElement;
    gadRow.innerHTML = GADGET_ORDER.map((g) => `
      <button class="opt-chip ${pickedGadgets.includes(g) ? 'selected' : ''}" data-g="${g}"
        title="${GADGETS[g].desc}">${GADGETS[g].name}</button>`).join('');
    gadRow.querySelectorAll('button').forEach((b) => {
      (b as HTMLElement).onclick = () => {
        const g = (b as HTMLElement).dataset.g as GadgetKind;
        if (pickedGadgets.includes(g)) pickedGadgets = pickedGadgets.filter((x) => x !== g);
        else if (pickedGadgets.length < 2) pickedGadgets.push(g);
        Sfx.uiClick();
        render();
      };
    });
    s.querySelectorAll('.op-card').forEach((card) => {
      (card as HTMLElement).onclick = () => {
        pickedOp = (card as HTMLElement).dataset.op as string;
        const l = menuHooks.getSave().loadouts[pickedOp];
        pickedSight = l.sight;
        pickedGadgets = [...l.gadgets];
        Sfx.uiClick();
        render();
      };
    });
    (s.querySelector('#btn-start') as HTMLButtonElement).onclick = () => {
      const sv = menuHooks.getSave();
      sv.loadouts[pickedOp] = { sight: pickedSight, gadgets: pickedGadgets, skin: sv.loadouts[pickedOp]?.skin ?? 'default' };
      menuHooks.writeSave(sv);
      Sfx.uiConfirm();
      menuHooks.onStart(pickedSide, pickedOp, { opId: pickedOp, sight: pickedSight, gadgets: [...pickedGadgets], skin: sv.loadouts[pickedOp].skin });
    };
  }
}

// ---------- locker ----------
function showLocker(): void {
  const save = menuHooks.getSave();
  const s = screen(`
    ${topbar('LOCKER')}
    <div class="sub-screen">
      <div class="head"><h2>Locker</h2></div>
      <div class="screen-body">
        <div class="locker-left">
          ${OPERATORS.map((o) => `<div class="locker-item" data-lockerop="${o.id}">${o.name} <span style="color:var(--muted);font-size:11px">${o.side === 'atk' ? 'ATK' : 'DEF'}</span></div>`).join('')}
        </div>
        <div class="locker-right" id="locker-detail"></div>
      </div>
    </div>`);
  let cur = OPERATORS[0].id;
  const detail = s.querySelector('#locker-detail') as HTMLElement;
  function renderDetail(): void {
    const op = opById(cur);
    const skin = save.loadouts[cur]?.skin ?? 'default';
    const st = save.stats;
    detail.innerHTML = `
      <h3 style="letter-spacing:3px">${op.name} <span style="color:var(--muted);font-size:13px">· ${op.role}</span></h3>
      <h4 style="margin-top:14px;letter-spacing:2px;color:var(--muted);font-size:12px">WEAPON FINISH</h4>
      <div class="skin-row">
        ${SKINS.map((sk) => `<button class="skin-chip ${sk.id === skin ? 'selected' : ''}" data-skin="${sk.id}">${sk.name}</button>`).join('')}
      </div>
      <h4 style="margin-top:18px;letter-spacing:2px;color:var(--muted);font-size:12px">CAREER STATS</h4>
      <div class="stat-row"><span>Rounds played</span><b>${st.roundsPlayed}</b></div>
      <div class="stat-row"><span>Wins / Losses</span><b>${st.wins} / ${st.losses}</b></div>
      <div class="stat-row"><span>Kills / Deaths</span><b>${st.kills} / ${st.deaths}</b></div>`;
    detail.querySelectorAll('button[data-skin]').forEach((b) => {
      (b as HTMLElement).onclick = () => {
        save.loadouts[cur] = { ...(save.loadouts[cur] ?? { sight: 'reddot' as SightId, gadgets: [] as GadgetKind[] }), skin: (b as HTMLElement).dataset.skin as string };
        menuHooks.writeSave(save);
        Sfx.uiClick();
        renderDetail();
      };
    });
  }
  s.querySelectorAll('[data-lockerop]').forEach((n) => {
    (n as HTMLElement).onclick = () => {
      cur = (n as HTMLElement).dataset.lockerop as string;
      s.querySelectorAll('[data-lockerop]').forEach((m) => m.classList.remove('selected'));
      n.classList.add('selected');
      Sfx.uiClick();
      renderDetail();
    };
  });
  (s.querySelector(`[data-lockerop="${cur}"]`) as HTMLElement)?.classList.add('selected');
  renderDetail();
}

// ---------- how to play ----------
function showHowTo(): void {
  screen(`
    ${topbar('HOW TO PLAY')}
    <div class="sub-screen">
      <div class="head"><h2>Field Manual</h2></div>
      <div class="howto">
        <h3>Match flow</h3>
        <p>Defense gets a <b>45s setup phase</b>: reinforce walls, barricade doors, grab position.
        Attackers get a <b>20s drone phase</b> to scout. Then the <b>action phase (3:00)</b> begins:
        attackers must stand in the objective zone for 5 seconds to secure the canister. Wipe the enemy team
        to win instantly. If time runs out, defenders win.</p>
        <h3>Controls</h3>
        <table>
          <tr><td>W A S D</td><td>Move</td></tr>
          <tr><td>Mouse</td><td>Aim · LMB fire · RMB aim down sights</td></tr>
          <tr><td>Shift / C</td><td>Sprint / Crouch</td></tr>
          <tr><td>Space</td><td>Jump (exit drone while piloting)</td></tr>
          <tr><td>Q / E</td><td>Lean left / right (E also interacts in setup)</td></tr>
          <tr><td>1 / 2</td><td>Primary / P-92 sidearm</td></tr>
          <tr><td>R</td><td>Reload</td></tr>
          <tr><td>X / G</td><td>Cycle gadget / Use gadget</td></tr>
          <tr><td>F</td><td>Operator ability (hammer, pyro charge, armor crate, barricade kit)</td></tr>
          <tr><td>V</td><td>Deploy drone (attackers, action phase)</td></tr>
        </table>
        <h3>Destruction</h3>
        <p>Every interior wall panel is destructible: shoot it, blow it, hammer it.
        Reinforced panels (silver) only go down to EMBER's Pyro Charge.
        Soft walls show cracks, then holes — bullets, sightlines and paths all change in real time.</p>
      </div>
    </div>`);
}

// ---------- results ----------
export function showResults(won: boolean, kills: number, deaths: number): void {
  el.classList.add('visible');
  el.innerHTML = `
    <div class="menu-screen result-screen">
      <div class="kicker">ROUND COMPLETE</div>
      <div class="verdict ${won ? 'win' : 'loss'}">${won ? 'VICTORY' : 'DEFEAT'}</div>
      <div class="stats">
        <div><b>${kills}</b>KILLS</div>
        <div><b>${deaths}</b>DEATHS</div>
      </div>
      <div class="menu-buttons">
        <button class="btn primary" id="btn-again">▸ PLAY AGAIN</button>
        <button class="btn" id="btn-menu">MAIN MENU</button>
      </div>
    </div>`;
  (document.getElementById('btn-again') as HTMLButtonElement).onclick = () => { Sfx.uiConfirm(); showSideSelect(); };
  (document.getElementById('btn-menu') as HTMLButtonElement).onclick = () => { Sfx.uiClick(); showMain(); };
}

// ---------- portraits ----------
function drawPortrait(canvas: HTMLCanvasElement, opId: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const op = opById(opId);
  const atk = op.side === 'atk';
  ctx.fillStyle = atk ? '#1d1410' : '#10161d';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = atk ? '#2a1c14' : '#16222d';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  // silhouette
  ctx.fillStyle = atk ? '#c96f3f' : '#3f7fc9';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.42, h * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w / 2 - h * 0.26, h * 0.62, h * 0.52, h * 0.5);
  // visor
  ctx.fillStyle = '#0d0f13';
  ctx.fillRect(w / 2 - h * 0.14, h * 0.38, h * 0.28, h * 0.09);
  ctx.fillStyle = atk ? '#ff8a50' : '#58b6ff';
  ctx.fillRect(w / 2 - h * 0.11, h * 0.40, h * 0.22, h * 0.04);
  // initials
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 22px Segoe UI, Arial';
  ctx.textAlign = 'left';
  ctx.fillText(op.name, 10, 26);
}
