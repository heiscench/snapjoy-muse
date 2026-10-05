import { describe, expect, it } from "vitest";
import {
  DAYLIGHT_FRACTION,
  MIN_AMBIENT_INTENSITY,
  MIN_HEMISPHERE_INTENSITY,
  NIGHT_FRACTION,
} from "./dayNightConfig";

describe("day and night balance", () => {
  it("keeps daylight longer than nighttime", () => {
    expect(DAYLIGHT_FRACTION).toBeGreaterThan(NIGHT_FRACTION);
  });

  it("keeps a clear visibility floor throughout the cycle", () => {
    expect(MIN_AMBIENT_INTENSITY + MIN_HEMISPHERE_INTENSITY).toBeGreaterThanOrEqual(0.6);
  });
*** Update File: AGENTS.md
@@
 <!-- LOVABLE:END -->
+
+- Keep day/night timing and visibility thresholds in `src/game/dayNightConfig.ts` so visual tuning remains testable and consistent.