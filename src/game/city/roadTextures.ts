import * as THREE from "three";
import { hash01 } from "./palette";

let roadTex: THREE.CanvasTexture | null = null;
let glowTex: THREE.CanvasTexture | null = null;

// One tile = the full trail width (5 m) by 16 m of length.
function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  return [c, g];
}

function finish(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** A soft pale sandy trail with tiny pebbles and grass leaning in from both edges. */
export function roadTexture(): THREE.CanvasTexture | null {
  if (roadTex) return roadTex;
  const m = makeCanvas();
  if (!m) return null;
  const [c, g] = m;
  g.fillStyle = "#e2d29f";
  g.fillRect(0, 0, 256, 256);
  // Soft warm and pale patches (no dark marks).
  for (let i = 0; i < 700; i++) {
    const x = hash01(i, 1, 51) * 256;
    const y = hash01(i, 2, 52) * 256;
    const s = 4 + hash01(i, 3, 53) * 14;
    g.fillStyle = hash01(i, 4, 54) > 0.5 ? "rgba(240,228,184,0.32)" : "rgba(205,184,128,0.26)";
    g.beginPath();
    g.ellipse(x, y, s, s * 0.7, hash01(i, 5, 55) * 3, 0, Math.PI * 2);
    g.fill();
  }
  // A slightly paler worn strip down the middle.
  const grad = g.createLinearGradient(70, 0, 186, 0);
  grad.addColorStop(0, "rgba(255,246,208,0)");
  grad.addColorStop(0.5, "rgba(255,246,208,0.28)");
  grad.addColorStop(1, "rgba(255,246,208,0)");
  g.fillStyle = grad;
  g.fillRect(70, 0, 116, 256);
  // Tiny pebbles.
  for (let i = 0; i < 70; i++) {
    const x = 30 + hash01(i, 6, 56) * 196;
    const y = hash01(i, 7, 57) * 256;
    const w = 2 + hash01(i, 8, 58) * 4;
    g.fillStyle = hash01(i, 9, 59) > 0.4 ? "#f3ecd2" : "#c8b98c";
    g.beginPath();
    g.ellipse(x, y, w, w * 0.7, hash01(i, 10, 60) * 3, 0, Math.PI * 2);
    g.fill();
  }
  // Grass fringe along both edges.
  for (const edge of [0, 1]) {
    for (let i = 0; i < 300; i++) {
      const y = hash01(i, edge, 61) * 256;
      const reach = 4 + hash01(i, edge, 62) * 26;
      const x = edge === 0 ? hash01(i, edge, 63) * reach : 256 - hash01(i, edge, 63) * reach;
      const pick = hash01(i, edge, 64);
      g.strokeStyle = pick > 0.66 ? "#7aa83a" : pick > 0.33 ? "#8fb843" : "#a8c24a";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (edge === 0 ? 1 : -1) * 6, y - 9 - hash01(i, edge, 65) * 9);
      g.stroke();
    }
  }
  roadTex = finish(c);
  return roadTex;
}

/** Kept for old imports; the trails no longer glow. */
export function roadGlowTexture(): THREE.CanvasTexture | null {
  if (glowTex) return glowTex;
  const m = makeCanvas();
  if (!m) return null;
  const [c, g] = m;
  g.fillStyle = "#000000";
  g.fillRect(0, 0, 256, 256);
  glowTex = finish(c);
  return glowTex;
}
