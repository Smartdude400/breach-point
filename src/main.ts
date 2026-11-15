// ============ Breach Point — entry point ============
import './style.css';
import * as THREE from 'three';
import { Match } from './match';
import { hideMenus, initMenus, showResults } from './menus';
import { loadSave, writeSave } from './persistence';
import type { Loadout } from './types';
import { Sfx } from './audio';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 10, 26);
camera.lookAt(0, 2, 0);

// idle scene behind the menu
const idleScene = new THREE.Scene();
idleScene.background = new THREE.Color(0x0a0e14);
idleScene.fog = new THREE.Fog(0x0a0e14, 24, 60);
idleScene.add(new THREE.HemisphereLight(0x9fb4cc, 0x14171d, 0.9));
const idleBox = new THREE.Mesh(
  new THREE.TorusKnotGeometry(3, 0.9, 100, 14),
  new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.4, metalness: 0.5 }),
);
idleBox.position.y = 4;
idleScene.add(idleBox);
const idleGlow = new THREE.PointLight(0xffb300, 40, 40, 2);
idleGlow.position.set(6, 7, 6);
idleScene.add(idleGlow);

let match: Match | null = null;
let running = true;
const clock = new THREE.Clock();
const save = loadSave();

function loop(): void {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (match) {
    match.update(dt);
  } else {
    idleBox.rotation.y += dt * 0.25;
    idleBox.rotation.x += dt * 0.1;
    idleGlow.position.x = Math.cos(performance.now() / 2400) * 8;
    renderer.render(idleScene, camera);
  }
}
loop();

initMenus({
  getSave: () => save,
  writeSave: (s) => { Object.assign(save, s); writeSave(save); },
  onStart: (side, opId, loadout: Loadout) => {
    hideMenus();
    match = new Match(
      {
        playerSide: side,
        playerOpId: opId,
        loadout,
        onMatchOver: (won, kills, deaths) => {
          save.stats.roundsPlayed++;
          if (won) save.stats.wins++; else save.stats.losses++;
          save.stats.kills += kills;
          save.stats.deaths += deaths;
          writeSave(save);
          match?.dispose();
          match = null;
          showResults(won, kills, deaths);
        },
      },
      renderer,
      canvas,
    );
  },
});

window.addEventListener('pointerdown', () => Sfx.uiClick, { once: true });
