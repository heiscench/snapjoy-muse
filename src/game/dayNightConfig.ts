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