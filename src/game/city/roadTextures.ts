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

/** Cracked paving stones with worn curbs. */
export function roadTexture(): THREE.CanvasTexture | null {
  if (roadTex) return roadTex;
  const m = makeCanvas();
  if (!m) return null;
  const [c, g] = m;
  g.fillStyle = "#4a4553";
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    let x = row % 2 ? -12 : 0;
    let i = 0;
    while (x < 256) {
      const w = 22 + hash01(row, i, 91) * 26;
      const s = 0.82 + hash01(row, i, 92) * 0.3;
      g.fillStyle = `rgb(${Math.round(88 * s)},${Math.round(80 * s)},${Math.round(100 * s)})`;
      g.fillRect(x + 1, row * 16 + 1, w - 2, 14);
      x += w;
      i++;
    }
  }
  g.fillStyle = "#2c2835";
  g.fillRect(0, 0, 22, 256);
  g.fillRect(234, 0, 22, 256);
  g.fillStyle = "#6a6178";
  g.fillRect(21, 0, 2, 256);
  g.fillRect(233, 0, 2, 256);
  g.strokeStyle = "rgba(15,12,22,0.55)";
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

/** Glowing rune line down the middle plus faint curb marks (used as an emissive map). */
export function roadGlowTexture(): THREE.CanvasTexture | null {
  if (glowTex) return glowTex;
  const m = makeCanvas();
  if (!m) return null;
  const [c, g] = m;
  g.fillStyle = "#000000";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#d9b86a";
  for (let y = 8; y < 256; y += 64) g.fillRect(124, y, 8, 36);
  g.strokeStyle = "#a98cff";
  g.lineWidth = 2;
  for (let y = 52; y < 256; y += 128) {
    g.strokeRect(120, y, 16, 16);
    g.beginPath();
    g.moveTo(128, y);
    g.lineTo(128, y + 16);
    g.stroke();
  }
  g.fillStyle = "#6a58b0";
  for (let y = 0; y < 256; y += 32) {
    g.fillRect(24, y, 2, 18);
    g.fillRect(230, y, 2, 18);
  }
  glowTex = finish(c);
  return glowTex;
}