import { describe, expect, it } from "vitest";
import {
  DAYLIGHT_FRACTION,
  MIN_AMBIENT_INTENSITY,
  MIN_HEMISPHERE_INTENSITY,
  DUSK_FRACTION,
  daylightWeight,
  MIN_SUN_INTENSITY,
} from "./dayNightConfig";

describe("FORGOTTEN Daylight and Dusk", () => {
  it("spends 70% in Daylight and 30% in Dusk", () => {
    expect(DAYLIGHT_FRACTION).toBeCloseTo(0.7);
    expect(DUSK_FRACTION).toBeCloseTo(0.3);
  });
  it("has two phases and blends smoothly across the cycle seam", () => {
    expect(daylightWeight(0.35)).toBe(1);
    expect(daylightWeight(0.85)).toBe(0);
    expect(daylightWeight(0)).toBeCloseTo(0.5);
    expect(daylightWeight(0.7)).toBeCloseTo(0.5);
    expect(Math.abs(daylightWeight(0.9999) - daylightWeight(0.0001))).toBeLessThan(0.01);
  });

  it("keeps a clear visibility floor throughout the cycle", () => {
    expect(MIN_AMBIENT_INTENSITY + MIN_HEMISPHERE_INTENSITY).toBeGreaterThanOrEqual(0.6);
    expect(MIN_SUN_INTENSITY).toBeGreaterThanOrEqual(0.9);
  });
});