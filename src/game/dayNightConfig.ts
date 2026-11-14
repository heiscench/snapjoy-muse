export const CYCLE_SECONDS = 12 * 60;

export const DAYLIGHT_START = 0;
export const DAYLIGHT_END = 0.7;

export const MIN_AMBIENT_INTENSITY = 0.4;
export const MIN_HEMISPHERE_INTENSITY = 0.65;
export const PHASE_BLEND_FRACTION = 0.05;
export const MIN_SUN_INTENSITY = 0.9;
export const MAX_SUN_INTENSITY = 2.4;

export const DAYLIGHT_FRACTION = DAYLIGHT_END - DAYLIGHT_START;
export const DUSK_FRACTION = 1 - DAYLIGHT_FRACTION;

/** Where the day clock starts. 0.35 is midday. */
export const PHASE_OFFSET = 0.35;

/** Position in the day/night cycle (0..1) for a given number of elapsed seconds. */
export function daylightPhase(elapsedSeconds: number) {
  return (elapsedSeconds / CYCLE_SECONDS + PHASE_OFFSET) % 1;
}

/** Periodic, smooth transitions centred on each phase boundary. */
export function daylightWeight(phase: number) {
  const t = ((phase % 1) + 1) % 1;
  const half = PHASE_BLEND_FRACTION / 2;
  const smooth = (x: number) => x * x * (3 - 2 * x);
  if (t < half) return smooth((t + half) / PHASE_BLEND_FRACTION);
  if (t > 1 - half) return smooth((t - 1 + half) / PHASE_BLEND_FRACTION);
  if (t < DAYLIGHT_END - half) return 1;
  if (t > DAYLIGHT_END + half) return 0;
  return 1 - smooth((t - DAYLIGHT_END + half) / PHASE_BLEND_FRACTION);
}

// ---- The sun's path ---------------------------------------------------------------------
// By day the sun climbs from the east, crosses overhead and sets in the west. By night the same
// arc continues below the horizon. The world is lit from that direction, so shading, shadows and
// the sun in the sky all move together. The light itself never drops below MIN_LIGHT_ELEVATION,
// so dawn and dusk stay readable and shadows never stretch out to infinity (at night it acts as
// moonlight, continuing from where the sun set).

/** Lowest the light is allowed to sit (vertical component before normalising). */
export const MIN_LIGHT_ELEVATION = 0.24;
/** The sun's path leans a little to the south so shadows are never straight down at noon. */
const SUN_SOUTH = 0.3;

export type SunState = {
  /** Unit direction to the sun in the sky (y is negative at night). */
  x: number;
  y: number;
  z: number;
  /** Unit direction the world is lit from (always above the horizon). */
  lightX: number;
  lightY: number;
  lightZ: number;
  /** Sine of the sun's true altitude: 1 overhead, 0 on the horizon, negative below it. */
  altitude: number;
};

export function createSunState(): SunState {
  return { x: 0, y: 1, z: 0, lightX: 0, lightY: 1, lightZ: 0, altitude: 1 };
}

export function updateSun(phase: number, out: SunState = createSunState()): SunState {
  const t = ((phase % 1) + 1) % 1;
  const daytime = t < DAYLIGHT_END;
  const u = daytime ? (t - DAYLIGHT_START) / DAYLIGHT_FRACTION : (t - DAYLIGHT_END) / DUSK_FRACTION;
  const a = (daytime ? 0 : Math.PI) + u * Math.PI;
  const east = Math.cos(a);
  const alt = Math.sin(a);

  const skyLen = Math.hypot(east, alt, SUN_SOUTH);
  out.x = east / skyLen;
  out.y = alt / skyLen;
  out.z = SUN_SOUTH / skyLen;
  out.altitude = alt;

  const ly = Math.max(Math.abs(alt), MIN_LIGHT_ELEVATION);
  const lightLen = Math.hypot(east, ly, SUN_SOUTH);
  out.lightX = east / lightLen;
  out.lightY = ly / lightLen;
  out.lightZ = SUN_SOUTH / lightLen;
  return out;
}
