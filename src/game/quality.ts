// Shared graphics switches.
// Real-time shadows cost a second render pass, so they start on only where the device can afford it:
// desktops and laptops. Phones stay on the lighter look. Override with ?shadows=1 or ?shadows=0.
// ?lowfx=1 turns them off, and the adaptive-quality watchdog turns them off if the frame rate drops.

const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
const touch =
  typeof window !== "undefined" && ("ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0);

function initialShadows(): boolean {
  const v = search?.get("shadows");
  if (v === "1") return true;
  if (v === "0") return false;
  if (search?.has("lowfx")) return false;
  return !touch;
}

export const quality = { shadows: initialShadows() };

/** Called when the game detects it is struggling. */
export function lowerQuality() {
  quality.shadows = false;
}
