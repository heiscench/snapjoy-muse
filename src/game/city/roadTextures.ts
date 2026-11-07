import * as THREE from "three";
import { hash01 } from "./palette";

let roadTex: THREE.CanvasTexture | null = null;
let glowTex: THREE.CanvasTexture | null = null;

// One tile = the full road width (14 m) by 16 m of length.
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

/** Warm cobblestones set in packed earth, with worn dirt curbs. */
export function roadTexture(): THREE.CanvasTexture | null {
  if (roadTex) return roadTex;
  const m = makeCanvas();
  if (!m) return null;
  const [c, g] = m;
  // Packed earth showing between the stones.
  g.fillStyle = "#4b3d2f";
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    let x = row % 2 ? -12 : 0;
    let i = 0;
    while (x < 256) {
      const w = 22 + hash01(row, i, 91) * 26;
      const s = 0.8 + hash01(row, i, 92) * 0.35;
      const warm = hash01(row, i, 97); // some stones greyer, some browner
      const r = Math.round((118 + warm * 18) * s);
      const gg = Math.round((106 + warm * 8) * s);
      const b = Math.round((90 - warm * 10) * s);
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(x + 1, row * 16 + 1, w - 2, 14);
      x += w;
      i++;
    }
  }
  // Worn dirt curbs.
  g.fillStyle = "#3a2e22";
  g.fillRect(0, 0, 22, 256);
  g.fillRect(234, 0, 22, 256);
  g.fillStyle = "#7a6a55";
  g.fillRect(21, 0, 2, 256);
  g.fillRect(233, 0, 2, 256);
  // Cracks.
  g.strokeStyle = "rgba(30,22,14,0.5)";
  g.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    let x = 30 + hash01(i, 1, 93) * 196;
    let y = hash01(i, 2, 94) * 256;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (hash01(i, s, 95) - 0.5) * 26;
      y += 10 + hash01(i, s, 96) * 14;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  roadTex = finish(c);
  return roadTex;
}

/**
 * Emissive map for the road. It used to glow with a gold dashed line down the middle (it read as
 * highway lane markings). The medieval streets have no glowing marks: lanterns light them instead.
 */
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
