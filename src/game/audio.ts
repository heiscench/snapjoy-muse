// Lightweight procedural sound engine using the Web Audio API — no external
// audio files needed. Browsers block audio until a user gesture, so
// unlockAudio() must be called from the first pointerdown in GameScene.tsx.

let ctx: AudioContext | null = null;
let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

// Short filtered noise burst — used for gunshots and hit impacts.
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

  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  src.stop(now() + duration);
}

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
  const p = GUN_PROFILES[weaponId] ?? GUN_PROFILES.pistol;
  noiseBurst(p.duration, p.filterFreq, p.gain);
}

export function playHitMarker() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(900, now());
  osc.frequency.exponentialRampToValueAtTime(300, now() + 0.08);
  gain.gain.setValueAtTime(0.25, now());
  gain.gain.exponentialRampToValueAtTime(0.001, now() + 0.09);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(now() + 0.09);
}

export function playFootstep(running: boolean) {
  if (!ctx) return;
  noiseBurst(running ? 0.05 : 0.045, running ? 900 : 600, running ? 0.12 : 0.08);
}

// ---- Car engine — a car-like growl ----
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;

export function startEngine() {
  if (!ctx || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineGain = ctx.createGain();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 60;
  engineGain.gain.value = 0.0001;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
  engineOsc.start();
}

export function updateEngine(speedFraction: number) {
  if (!engineOsc || !engineGain || !ctx) return;
  const clamped = Math.max(0, Math.min(1, speedFraction));
  engineOsc.frequency.setTargetAtTime(55 + clamped * 140, now(), 0.08);
  engineGain.gain.setTargetAtTime(0.05 + clamped * 0.09, now(), 0.08);
}

export function stopEngine() {
  if (!engineOsc || !engineGain || !ctx) return;
  const o = engineOsc, g = engineGain;
  g.gain.setTargetAtTime(0.0001, now(), 0.05);
  setTimeout(() => { try { o.stop(); } catch { /* already stopped */ } }, 200);
  engineOsc = null;
  engineGain = null;
}

// ---- Helicopter engine — turbine whine + LFO-modulated rotor "whop-whop",
// deliberately distinct from the car growl above ----
let heliOsc: OscillatorNode | null = null;
let heliGain: GainNode | null = null;
let heliLFO: OscillatorNode | null = null;
let heliLFOGain: GainNode | null = null;

export function startHeliEngine() {
  if (!ctx || heliOsc) return;
  heliOsc = ctx.createOscillator();
  heliOsc.type = "sawtooth";
  heliOsc.frequency.value = 90;

  heliGain = ctx.createGain();
  heliGain.gain.value = 0.0001;

  heliLFO = ctx.createOscillator();
  heliLFO.type = "sine";
  heliLFO.frequency.value = 9; // rotor blade-pass rate
  heliLFOGain = ctx.createGain();
  heliLFOGain.gain.value = 0.06;
  heliLFO.connect(heliLFOGain);
  heliLFOGain.connect(heliGain.gain);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;

  heliOsc.connect(filter).connect(heliGain).connect(ctx.destination);
  heliOsc.start();
  heliLFO.start();
}

export function updateHeliEngine(intensity: number) {
  if (!heliOsc || !heliGain || !heliLFO || !ctx) return;
  const clamped = Math.max(0, Math.min(1, intensity));
  heliOsc.frequency.setTargetAtTime(80 + clamped * 60, now(), 0.15);
  heliGain.gain.setTargetAtTime(0.05 + clamped * 0.05, now(), 0.15);
  heliLFO.frequency.setTargetAtTime(7 + clamped * 4, now(), 0.2);
}

export function stopHeliEngine() {
  if (!heliOsc || !heliGain || !heliLFO || !ctx) return;
  const o = heliOsc, g = heliGain, l = heliLFO;
  g.gain.setTargetAtTime(0.0001, now(), 0.05);
  setTimeout(() => {
    try { o.stop(); l.stop(); } catch { /* already stopped */ }
  }, 200);
  heliOsc = null; heliGain = null; heliLFO = null; heliLFOGain = null;
}
// ---- Driving radio — a short procedural synthwave loop, scheduled with a
// lookahead so it stays in time without audio files. Only runs while the
// player is actually in a car. ----
const RADIO_BPM = 104;
const RADIO_STEP = 60 / RADIO_BPM / 2; // eighth notes
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

export function startRadio() {
  if (!ctx || radioTimer) return;
  radioBus = ctx.createGain();
  radioBus.gain.value = 0.0001;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  radioBus.connect(lp).connect(ctx.destination);
  radioBus.gain.setTargetAtTime(0.09, now(), 0.4);

  radioStep = 0;
  radioNextTime = now() + 0.1;
  radioTimer = setInterval(() => {
    if (!ctx) return;
    while (radioNextTime < ctx.currentTime + RADIO_SCHEDULE_AHEAD) {
      const t = radioNextTime;
      radioNote(RADIO_BASS[radioStep % RADIO_BASS.length], t, RADIO_STEP * 0.9, "sawtooth", 0.5);
      radioNote(RADIO_LEAD[radioStep % RADIO_LEAD.length], t, RADIO_STEP * 0.8, "square", 0.16);
      if (radioStep % 4 === 2) noiseBurst(0.05, 5000, 0.06); // hat
      radioStep++;
      radioNextTime += RADIO_STEP;
    }
  }, RADIO_LOOKAHEAD_MS);
}

export function stopRadio() {
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
