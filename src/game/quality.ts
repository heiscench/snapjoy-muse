// Shared graphics switches.
// Real-time sun shadows cost a second render pass. They are on by default; phones get a smaller
// shadow map. The adaptive-quality watchdog switches them off if the frame rate drops, and
// ?shadows=0 or ?lowfx=1 turns them off from the start (?shadows=1 forces them on).

const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
const touch =
  typeof window !== "undefined" && ("ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0);

function initialShadows(): boolean {
  const v = search?.get("shadows");
  if (v === "1") return true;
  if (v === "0") return false;
  if (search?.has("lowfx")) return false;
  return true;
}

export const quality = { shadows: initialShadows() };

/** Shadow map resolution: smaller on touch devices. */
export const SHADOW_MAP_SIZE = touch ? 1024 : 2048;

/** Called when the game detects it is struggling. */
export function lowerQuality() {
  quality.shadows = false;
}
