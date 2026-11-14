import { describe, expect, it } from "vitest";
import {
  DAYLIGHT_FRACTION,
  MIN_AMBIENT_INTENSITY,
  MIN_HEMISPHERE_INTENSITY,
  DUSK_FRACTION,
  daylightWeight,
  MIN_SUN_INTENSITY,
  updateSun,
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

describe("FORGOTTEN Sun path", () => {
  it("is overhead at midday and below the horizon at night", () => {
    expect(updateSun(0.35).altitude).toBeCloseTo(1);
    expect(updateSun(0.85).altitude).toBeCloseTo(-1);
  });

  it("moves continuously across dusk, dawn and the cycle seam", () => {
    const a = updateSun(0.6999);
    const b = updateSun(0.7001);
    expect(Math.abs(a.lightX - b.lightX)).toBeLessThan(0.01);
    expect(Math.abs(a.lightY - b.lightY)).toBeLessThan(0.01);
    const c = updateSun(0.9999);
    const d = updateSun(0.0001);
    expect(Math.abs(c.lightX - d.lightX)).toBeLessThan(0.01);
    expect(Math.abs(c.lightY - d.lightY)).toBeLessThan(0.01);
  });

  it("always lights the world from above the horizon with a unit vector", () => {
    for (let p = 0; p < 1; p += 0.05) {
      const s = updateSun(p);
      expect(s.lightY).toBeGreaterThan(0.2);
      expect(Math.hypot(s.lightX, s.lightY, s.lightZ)).toBeCloseTo(1);
      expect(Math.hypot(s.x, s.y, s.z)).toBeCloseTo(1);
    }
  });
});
