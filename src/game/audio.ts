// FORGOTTEN sound engine (Web Audio). Plays real files from /public/audio when
// they exist and falls back to the original procedural sounds when they don't,
// so a missing file never breaks the game. Browsers block audio until a user
// gesture, so unlockAudio() must run from a click/tap (intro button, first
// pointerdown in GameScene).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

const SOUND_BASE = "/audio/";
const EXTENSIONS = ["mp3", "ogg", "wav"];

// key -> file name (without extension) in /public/audio
const SOUND_NAMES: Record<string, string> = {
  menu: "menu-theme",
  game: "game-theme",
  husk: "husk-engine",
  skiff: "skiff-hover",
  step: "footstep",
  radio: "radio-loop",
  hit: "hit",
  shot_pistol: "shot-pistol",
  shot_smg: "shot-smg",
  shot_rifle: "shot-rifle",
  shot_shotgun: "shot-shotgun",
  shot_sniper: "shot-sniper",
  shot_grenade: "shot-grenade",
  shot_tank: "shot-tank",
};

const buffers = new Map<string, AudioBuffer | null>(); // null = file missing
const loading = new Map<string, Promise<AudioBuffer | null>>();

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
  if (ctx.state === "suspended") ctx.resume();
  for (const key of Object.keys(SOUND_NAMES)) void loadSound(key);
}

export function setMasterVolume(v: number) {
  if (master) master.gain.value = Math.max(0, Math.min(1, v));
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function out(): AudioNode {
  return master as GainNode;
}

async function fetchDecode(c: AudioContext, name: string): Promise<AudioBuffer | null> {
  for (const ext of EXTENSIONS) {
    try {
      const res = await fetch(`${SOUND_BASE}${name}.${ext}`);
      if (!res.ok) continue;
      // SPA hosts answer unknown paths with index.html (status 200): skip those.
      if ((res.headers.get("content-type") ?? "").includes("text/html")) continue;
      return await c.decodeAudioData(await res.arrayBuffer());
    } catch {
      /* try next extension */
    }
  }
  return null;
}

function loadSound(key: string): Promise<AudioBuffer | null> {
  if (buffers.has(key)) return Promise.resolve(buffers.get(key) ?? null);
  const pending = loading.get(key);
  if (pending) return pending;
  if (!ctx || !SOUND_NAMES[key]) return Promise.resolve(null);
  const p = fetchDecode(ctx, SOUND_NAMES[key])
    .then((b) => {
      buffers.set(key, b);
      if (key === "step" && b) analyseSteps(b);
      return b;
    })
    .finally(() => loading.delete(key));
  loading.set(key, p);
  return p;
}

function bufferNow(key: string): AudioBuffer | null {
  return buffers.get(key) ?? null;
}

// One-shot sample with a little pitch variation.
function playSample(key: string, volume: number, rate = 1, jitter = 0.06): boolean {
  const buf = bufferNow(key);
  if (!ctx || !buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(out());
  src.start();
  return true;
}

type Loop = { src: AudioBufferSourceNode; gain: GainNode; volume: number };

function startLoop(buf: AudioBuffer, volume: number, fade = 0.4): Loop {
  const c = ctx as AudioContext;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  src.connect(gain).connect(out());
  src.start();
  gain.gain.setTargetAtTime(volume, now(), fade / 3);
  return { src, gain, volume };
}

function stopLoop(l: Loop, fade = 0.25) {
  l.gain.gain.setTargetAtTime(0.0001, now(), fade / 3);
  setTimeout(() => {
    try { l.src.stop(); } catch { /* already stopped */ }
    try { l.gain.disconnect(); } catch { /* already gone */ }
  }, fade * 1000 + 120);
}

// Short filtered noise burst: procedural fallback for shots, hits, steps.
function noiseBurst(duration: number, filterFreq: number, gainAmt: number) {
  if (!ctx) return;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainAmt, now());
  gain.gain.exponentialRampToValueAtTime(0.001, now() + duration);

  src.connect(filter).connect(gain).connect(out());
  src.start();
  src.stop(now() + duration);
}

// ---------------------------------------------------------------- Weapons
const GUN_PROFILES: Record<string, { duration: number; filterFreq: number; gain: number }> = {
  pistol:  { duration: 0.09, filterFreq: 2200, gain: 0.5 },
  smg:     { duration: 0.06, filterFreq: 2600, gain: 0.4 },
  rifle:   { duration: 0.12, filterFreq: 1800, gain: 0.6 },
  shotgun: { duration: 0.18, filterFreq: 1200, gain: 0.75 },
  sniper:  { duration: 0.22, filterFreq: 1000, gain: 0.7 },
  tank:    { duration: 0.3,  filterFreq: 900,  gain: 0.9 },
};

export function playGunshot(weaponId: string) {
  if (!ctx) return;
  if (playSample(`shot_${weaponId}`, 0.7, 1, 0.04)) return;
  const p = GUN_PROFILES[weaponId] ?? GUN_PROFILES.pistol;
  noiseBurst(p.duration, p.filterFreq, p.gain);
}

export function playHitMarker() {
  if (!ctx) return;
  if (playSample("hit", 0.6, 1, 0.05)) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(900, now());
  osc.frequency.exponentialRampToValueAtTime(300, now() + 0.08);
  gain.gain.setValueAtTime(0.25, now());
  gain.gain.exponentialRampToValueAtTime(0.001, now() + 0.09);
  osc.connect(gain).connect(out());
  osc.start();
  osc.stop(now() + 0.09);
}

// ---- Footsteps: slice single steps out of a long recording --------------
const stepOnsets: number[] = []; // start time (seconds) of each footstep in the file
let stepIndex = 0;

/** Finds the loud hits in the footstep recording so each one can be played alone. */
function analyseSteps(buf: AudioBuffer) {
  stepOnsets.length = 0;
  if (buf.duration < 1.2) return; // already a single step, play it whole
  const data = buf.getChannelData(0);
  const win = Math.max(1, Math.floor(buf.sampleRate * 0.01)); // 10 ms windows
  const env: number[] = [];
  for (let i = 0; i + win < data.length; i += win) {
    let s = 0;
    for (let j = 0; j < win; j++) s += data[i + j] * data[i + j];
    env.push(Math.sqrt(s / win));
  }
  let max = 0;
  for (const v of env) if (v > max) max = v;
  if (max <= 0) return;
  const thr = max * 0.35;
  const minGap = 25; // 0.25 s between detected steps
  let last = -minGap;
  for (let i = 1; i < env.length && stepOnsets.length < 60; i++) {
    if (env[i] >= thr && env[i - 1] < thr && i - last >= minGap) {
      stepOnsets.push(i * 0.01);
      last = i;
    }
  }
  // Too few hits found: fall back to evenly spaced slices.
  if (stepOnsets.length < 3) {
    stepOnsets.length = 0;
    for (let t = 0; t + 0.4 < buf.duration && stepOnsets.length < 24; t += 0.6) stepOnsets.push(t);
  }
}

export function playFootstep(running: boolean) {
  if (!ctx) return;
  const vol = running ? 0.55 : 0.4;
  const rate = running ? 1.2 : 1;
  const buf = bufferNow("step");

  if (buf && buf.duration < 1.2) {
    playSample("step", vol, rate, 0.08); // short single-step file: play it whole
    return;
  }

  if (buf && stepOnsets.length >= 2) {
    const start = Math.max(0, stepOnsets[stepIndex % stepOnsets.length] - 0.03);
    stepIndex++;
    const dur = running ? 0.22 : 0.3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now());
    g.gain.setTargetAtTime(0.0001, now() + dur * 0.6, dur * 0.12); // quick fade-out of the tail
    src.connect(g).connect(out());
    src.start(0, start, dur); // only this one step, never the whole recording
    return;
  }

  // No file: original synthesized step.
  noiseBurst(running ? 0.05 : 0.045, running ? 900 : 600, running ? 0.12 : 0.08);
}
// ------------------------------------------------- Husk engine (vehicles)
let engineWanted = false;
let engineLoop: Loop | null = null;
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;

function startProceduralEngine() {
  if (!ctx || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineGain = ctx.createGain();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 60;
  engineGain.gain.value = 0.0001;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  engineOsc.connect(filter).connect(engineGain).connect(out());
  engineOsc.start();
}

export function startEngine() {
  if (!ctx || engineWanted) return;
  engineWanted = true;
  void loadSound("husk").then((buf) => {
    if (!engineWanted || !ctx) return;
    if (buf) engineLoop = startLoop(buf, 0.35);
    else startProceduralEngine();
  });
}

export function updateEngine(speedFraction: number) {
  if (!ctx) return;
  const clamped = Math.max(0, Math.min(1, speedFraction));
  if (engineLoop) {
    engineLoop.src.playbackRate.setTargetAtTime(0.75 + clamped * 0.85, now(), 0.1);
    engineLoop.gain.gain.setTargetAtTime(0.3 + clamped * 0.4, now(), 0.1);
  } else if (engineOsc && engineGain) {
    engineOsc.frequency.setTargetAtTime(55 + clamped * 140, now(), 0.08);
    engineGain.gain.setTargetAtTime(0.05 + clamped * 0.09, now(), 0.08);
  }
}

export function stopEngine() {
  engineWanted = false;
  if (engineLoop) {
    stopLoop(engineLoop);
    engineLoop = null;
  }
  if (engineOsc && engineGain && ctx) {
    const o = engineOsc, g = engineGain;
    g.gain.setTargetAtTime(0.0001, now(), 0.05);
    setTimeout(() => { try { o.stop(); } catch { /* already stopped */ } }, 200);
    engineOsc = null;
    engineGain = null;
  }
}

// ----------------------------- Relic Skiff hover (was the helicopter engine)
let heliWanted = false;
let heliLoop: Loop | null = null;
let heliOsc: OscillatorNode | null = null;
let heliGain: GainNode | null = null;
let heliLFO: OscillatorNode | null = null;
let heliLFOGain: GainNode | null = null;

function startProceduralHeli() {
  if (!ctx || heliOsc) return;
  heliOsc = ctx.createOscillator();
  heliOsc.type = "sawtooth";
  heliOsc.frequency.value = 90;

  heliGain = ctx.createGain();
  heliGain.gain.value = 0.0001;

  heliLFO = ctx.createOscillator();
  heliLFO.type = "sine";
  heliLFO.frequency.value = 9;
  heliLFOGain = ctx.createGain();
  heliLFOGain.gain.value = 0.06;
  heliLFO.connect(heliLFOGain);
  heliLFOGain.connect(heliGain.gain);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;

  heliOsc.connect(filter).connect(heliGain).connect(out());
  heliOsc.start();
  heliLFO.start();
}

export function startHeliEngine() {
  if (!ctx || heliWanted) return;
  heliWanted = true;
  void loadSound("skiff").then((buf) => {
    if (!heliWanted || !ctx) return;
    if (buf) heliLoop = startLoop(buf, 0.4, 0.6);
    else startProceduralHeli();
  });
}

export function updateHeliEngine(intensity: number) {
  if (!ctx) return;
  const clamped = Math.max(0, Math.min(1, intensity));
  if (heliLoop) {
    heliLoop.src.playbackRate.setTargetAtTime(0.9 + clamped * 0.25, now(), 0.2);
    heliLoop.gain.gain.setTargetAtTime(0.32 + clamped * 0.25, now(), 0.2);
  } else if (heliOsc && heliGain && heliLFO) {
    heliOsc.frequency.setTargetAtTime(80 + clamped * 60, now(), 0.15);
    heliGain.gain.setTargetAtTime(0.05 + clamped * 0.05, now(), 0.15);
    heliLFO.frequency.setTargetAtTime(7 + clamped * 4, now(), 0.2);
  }
}

export function stopHeliEngine() {
  heliWanted = false;
  if (heliLoop) {
    stopLoop(heliLoop, 0.4);
    heliLoop = null;
  }
  if (heliOsc && heliGain && heliLFO && ctx) {
    const o = heliOsc, g = heliGain, l = heliLFO;
    g.gain.setTargetAtTime(0.0001, now(), 0.05);
    setTimeout(() => {
      try { o.stop(); l.stop(); } catch { /* already stopped */ }
    }, 200);
    heliOsc = null; heliGain = null; heliLFO = null; heliLFOGain = null;
  }
}

// ------------------------------------------------------- Start song / menu
let menuWanted = false;
let menuLoop: Loop | null = null;

/** Call right after unlockAudio() from a click (the intro button). */
export function startMenuMusic() {
  if (!ctx || menuWanted) return;
  menuWanted = true;
  void loadSound("menu").then((buf) => {
    if (!menuWanted || !ctx || !buf || menuLoop) return;
    menuLoop = startLoop(buf, 0.55, 2);
  });
}

export function stopMenuMusic(fade = 1.4) {
  menuWanted = false;
  if (menuLoop) {
    stopLoop(menuLoop, fade);
    menuLoop = null;
  }
}

// ------------------------------------------------------------ In-game music
let gameWanted = false;
let gameLoop: Loop | null = null;

/** Quiet background loop for the game world. Plays public/audio/game-theme.* if it exists. */
export function startGameMusic() {
  if (!ctx || gameWanted) return;
  gameWanted = true;
  void loadSound("game").then((buf) => {
    if (!gameWanted || !ctx || !buf || gameLoop) return;
    gameLoop = startLoop(buf, 0.3, 2.5);
  });
}

export function stopGameMusic(fade = 1.2) {
  gameWanted = false;
  if (gameLoop) {
    stopLoop(gameLoop, fade);
    gameLoop = null;
  }
}

// ------------------------------------------------------ Driving radio
// Uses radio-loop if present, otherwise the original procedural loop.
let radioWanted = false;
let radioFileLoop: Loop | null = null;

const RADIO_BPM = 104;
const RADIO_STEP = 60 / RADIO_BPM / 2;
const RADIO_LOOKAHEAD_MS = 90;
const RADIO_SCHEDULE_AHEAD = 0.25;
const RADIO_BASS: number[] = [55, 55, 82.4, 55, 65.4, 65.4, 98, 73.4];
const RADIO_LEAD: number[] = [
  440, 0, 523.25, 587.33, 0, 493.88, 440, 0,
  392, 0, 440, 523.25, 0, 392, 349.23, 0,
];

let radioTimer: ReturnType<typeof setInterval> | null = null;
let radioStep = 0;
let radioNextTime = 0;
let radioBus: GainNode | null = null;

function radioNote(freq: number, at: number, dur: number, type: OscillatorType, level: number) {
  if (!ctx || !radioBus || freq <= 0) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(level, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(radioBus);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function startProceduralRadio() {
  if (!ctx || radioTimer) return;
  radioBus = ctx.createGain();
  radioBus.gain.value = 0.0001;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  radioBus.connect(lp).connect(out());
  radioBus.gain.setTargetAtTime(0.09, now(), 0.4);

  radioStep = 0;
  radioNextTime = now() + 0.1;
  radioTimer = setInterval(() => {
    if (!ctx) return;
    while (radioNextTime < ctx.currentTime + RADIO_SCHEDULE_AHEAD) {
      const t = radioNextTime;
      radioNote(RADIO_BASS[radioStep % RADIO_BASS.length], t, RADIO_STEP * 0.9, "sawtooth", 0.5);
      radioNote(RADIO_LEAD[radioStep % RADIO_LEAD.length], t, RADIO_STEP * 0.8, "square", 0.16);
      if (radioStep % 4 === 2) noiseBurst(0.05, 5000, 0.06);
      radioStep++;
      radioNextTime += RADIO_STEP;
    }
  }, RADIO_LOOKAHEAD_MS);
}

export function startRadio() {
  if (!ctx || radioWanted) return;
  radioWanted = true;
  void loadSound("radio").then((buf) => {
    if (!radioWanted || !ctx) return;
    if (buf) radioFileLoop = startLoop(buf, 0.35, 0.8);
    else startProceduralRadio();
  });
}

export function stopRadio() {
  radioWanted = false;
  if (radioFileLoop) {
    stopLoop(radioFileLoop, 0.5);
    radioFileLoop = null;
  }
  if (radioTimer) {
    clearInterval(radioTimer);
    radioTimer = null;
  }
  if (radioBus && ctx) {
    const bus = radioBus;
    bus.gain.setTargetAtTime(0.0001, now(), 0.15);
    setTimeout(() => { try { bus.disconnect(); } catch { /* already gone */ } }, 700);
  }
  radioBus = null;
}