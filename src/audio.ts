// ============ Breach Point — procedural audio ============

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio(): void {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

export function setMasterVolume(v: number): void {
  const c = ac();
  if (c && master) master.gain.value = v;
}

/** Default spatial params. Pass position for world-space sounds. */
export interface SoundOpts {
  pos?: { x: number; z: number };
  listener?: { x: number; z: number };
  listenerYaw?: number;
  maxDist?: number;
}

function spatial(o: SoundOpts): { vol: number; pan: number } {
  const maxDist = o.maxDist ?? 40;
  if (!o.pos || !o.listener) return { vol: 1, pan: 0 };
  const dx = o.pos.x - o.listener.x;
  const dz = o.pos.z - o.listener.z;
  const d = Math.hypot(dx, dz);
  const vol = Math.max(0, 1 - d / maxDist) ** 1.6;
  // pan by listener-relative direction
  const yaw = o.listenerYaw ?? 0;
  const cos = Math.cos(-yaw);
  const sin = Math.sin(-yaw);
  const rx = dx * cos - dz * sin;
  const pan = Math.max(-1, Math.min(1, rx / Math.max(3, d)));
  return { vol, pan };
}

function env(g: GainNode, c: AudioContext, a: number, peak: number, dur: number): void {
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function noiseBuf(c: AudioContext, dur: number): AudioBuffer {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let v = 0;
  for (let i = 0; i < len; i++) {
    v = v * 0.94 + (Math.random() * 2 - 1) * 0.35;
    d[i] = v * 0.9;
  }
  return buf;
}

export const Sfx = {
  shot(spec: { pos?: { x: number; z: number }; listener?: { x: number; z: number }; listenerYaw?: number; kind?: 'rifle' | 'smg' | 'shotgun' | 'pistol' }): void {
    const c = ac(); if (!c || !master) return;
    const { vol, pan } = spatial(spec);
    if (vol <= 0.01) return;
    const kind = spec.kind ?? 'rifle';
    const dur = kind === 'shotgun' ? 0.32 : kind === 'pistol' ? 0.13 : 0.16;
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf(c, dur);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = kind === 'smg' ? 2100 : kind === 'shotgun' ? 700 : 1300;
    bp.Q.value = 0.8;
    const g = c.createGain();
    env(g, c, 0.004, 0.55 * vol, dur);
    const p = c.createStereoPanner(); p.pan.value = pan;
    const osc = c.createOscillator(); osc.type = 'triangle';
    const f0 = kind === 'shotgun' ? 90 : kind === 'pistol' ? 170 : 120;
    osc.frequency.setValueAtTime(f0, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.4, c.currentTime + dur);
    const og = c.createGain(); env(og, c, 0.003, 0.5 * vol, dur * 0.7);
    noise.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
    osc.connect(og); og.connect(p);
    noise.start(); osc.start(); noise.stop(c.currentTime + dur + 0.05); osc.stop(c.currentTime + dur + 0.05);
  },

  impact(spec: SoundOpts): void {
    const c = ac(); if (!c || !master) return;
    const { vol, pan } = spatial(spec);
    if (vol <= 0.01) return;
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf(c, 0.08);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    const g = c.createGain(); env(g, c, 0.002, 0.25 * vol, 0.09);
    const p = c.createStereoPanner(); p.pan.value = pan;
    noise.connect(hp); hp.connect(g); g.connect(p); p.connect(master);
    noise.start();
  },

  explosion(spec: SoundOpts): void {
    const c = ac(); if (!c || !master) return;
    const { vol, pan } = spatial(spec);
    const v = Math.max(vol, 0.25);
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf(c, 0.9);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = c.createGain(); env(g, c, 0.005, 0.9 * v, 0.9);
    const p = c.createStereoPanner(); p.pan.value = pan;
    noise.connect(lp); lp.connect(g); g.connect(p); p.connect(master);
    noise.start();
  },

  wallBreak(spec: SoundOpts): void {
    const c = ac(); if (!c || !master) return;
    const { vol, pan } = spatial(spec);
    const v = Math.max(vol, 0.2);
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf(c, 0.5);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.5;
    const g = c.createGain(); env(g, c, 0.005, 0.7 * v, 0.5);
    const p = c.createStereoPanner(); p.pan.value = pan;
    noise.connect(bp); bp.connect(g); g.connect(p); p.connect(master);
    noise.start();
  },

  blip(freq = 880, vol = 0.2): void {
    const c = ac(); if (!c || !master) return;
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const g = c.createGain(); env(g, c, 0.002, vol, 0.09);
    o.connect(g); g.connect(master);
    o.start(); o.stop(c.currentTime + 0.12);
  },

  flashPop(spec: SoundOpts): void {
    const c = ac(); if (!c || !master) return;
    const { vol, pan } = spatial(spec);
    const v = Math.max(vol, 0.3);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(3200, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.5);
    const g = c.createGain(); env(g, c, 0.004, 0.6 * v, 0.6);
    const p = c.createStereoPanner(); p.pan.value = pan;
    o.connect(g); g.connect(p); p.connect(master);
    o.start(); o.stop(c.currentTime + 0.7);
  },

  smokePop(spec: SoundOpts): void {
    this.blip(220, 0.3);
    this.impact({ ...spec, maxDist: 50 });
  },

  reloadClick(): void { this.blip(300, 0.15); },
  dryFire(): void { this.blip(180, 0.12); },
  uiClick(): void { this.blip(660, 0.12); },
  uiConfirm(): void { this.blip(880, 0.15); setTimeout(() => this.blip(1170, 0.12), 70); },
  winSting(): void { this.blip(523, 0.2); setTimeout(() => this.blip(659, 0.2), 120); setTimeout(() => this.blip(784, 0.22), 240); },
  lossSting(): void { this.blip(392, 0.2); setTimeout(() => this.blip(311, 0.2), 140); setTimeout(() => this.blip(233, 0.24), 280); },
  beep(): void { this.blip(1240, 0.2); },
};
