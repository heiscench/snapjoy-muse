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

// Looping engine hum — call startEngine() once on entering a vehicle,
// updateEngine(speedFraction 0..1) each frame while driving, stopEngine() on exit.
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

// Helicopter engine — distinct from the car engine: a steady turbine tone
// with a low-frequency oscillator amplitude-modulating it to create the
// rhythmic rotor "whop-whop" instead of a car-like growl.
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