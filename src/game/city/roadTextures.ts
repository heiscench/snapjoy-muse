import * as THREE from "three";
import { hash01 } from "./palette";

let roadTex: THREE.CanvasTexture | null = null;
let glowTex: THREE.CanvasTexture | null = null;

// One tile = the full lane width (8 m) by 16 m of length.
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

/** A worn dirt lane: packed earth, wheel ruts, scattered flat stones and grass along both edges. */
export function roadTexture(): THREE.CanvasTexture | null {
  if (roadTex) return roadTex;
  const m = makeCanvas();
  if (!m) return null;
  const [c, g] = m;
  g.fillStyle = "#92774f";
  g.fillRect(0, 0, 256, 256);
  // Mottled earth.
  for (let i = 0; i < 900; i++) {
    const x = hash01(i, 1, 51) * 256;
    const y = hash01(i, 2, 52) * 256;
    const s = 2 + hash01(i, 3, 53) * 6;
    const light = hash01(i, 4, 54) > 0.5;
    g.fillStyle = light ? "rgba(190,160,110,0.28)" : "rgba(70,50,30,0.22)";
    g.beginPath();
    g.ellipse(x, y, s, s * 0.7, hash01(i, 5, 55) * 3, 0, Math.PI * 2);
    g.fill();
  }
  // Wheel ruts.
  g.fillStyle = "rgba(60,42,26,0.35)";
  g.fillRect(84, 0, 14, 256);
  g.fillRect(158, 0, 14, 256);
  // Flat stones set in the earth.
  for (let i = 0; i < 26; i++) {
    const x = 40 + hash01(i, 6, 56) * 176;
    const y = hash01(i, 7, 57) * 256;
    const w = 8 + hash01(i, 8, 58) * 14;
    const h = 6 + hash01(i, 9, 59) * 9;
    g.fillStyle = "rgba(60,50,40,0.5)";
    g.beginPath(); g.ellipse(x + 1, y + 2, w, h, 0.2, 0, Math.PI * 2); g.fill();
    const s = 0.85 + hash01(i, 10, 60) * 0.3;
    g.fillStyle = `rgb(${Math.round(150 * s)},${Math.round(138 * s)},${Math.round(116 * s)})`;
    g.beginPath(); g.ellipse(x, y, w, h, 0.2, 0, Math.PI * 2); g.fill();
  }
  // Grass fringe along both edges.
  for (const edge of [0, 1]) {
    for (let i = 0; i < 260; i++) {
      const y = hash01(i, edge, 61) * 256;
      const reach = 6 + hash01(i, edge, 62) * 22;
      const x = edge === 0 ? hash01(i, edge, 63) * reach : 256 - hash01(i, edge, 63) * reach;
      g.strokeStyle = hash01(i, edge, 64) > 0.5 ? "#6f9a42" : "#86b04e";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (edge === 0 ? 1 : -1) * 5, y - 8 - hash01(i, edge, 65) * 8);
      g.stroke();
    }
  }
  roadTex = finish(c);
  return roadTex;
}

/** Kept for old imports; the lanes no longer glow. */
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
