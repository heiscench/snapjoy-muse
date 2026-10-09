import * as THREE from "three";
import { hash01 } from "./palette";

/** World units covered by one texture tile. */
export const TILE = 6;

const textures = new Map<number, THREE.CanvasTexture>();
const stoneMats = new Map<string, THREE.MeshStandardMaterial>();
const solidMats = new Map<string, THREE.MeshStandardMaterial>();
const basicMats = new Map<string, THREE.MeshBasicMaterial>();
const clothMats = new Map<string, THREE.MeshStandardMaterial>();

function drawStone(variant: number): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext("2d");
  if (!c) return null;

  const fills = ["#cfc9bb", "#bdb7a9", "#d8d2c5", "#b5afa1"];
  c.fillStyle = "#9d978a";
  c.fillRect(0, 0, 256, 256);

  const bh = 32;
  const bw = 64;
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 === 0 ? 0 : -bw / 2;
    for (let col = -1; col < 5; col++) {
      const x = col * bw + offset;
      const y = row * bh;
      const idx = (((row * 3 + col * 5 + variant * 7) % 4) + 4) % 4;

      c.globalAlpha = 1;
      c.fillStyle = fills[idx];
      c.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);

      c.globalAlpha = 0.16;
      c.fillStyle = "#000000";
      c.fillRect(x + 1.5, y + bh - 6, bw - 3, 4);

      const r = hash01(x, y, 10 + variant);
      if (r > 0.62) {
        c.globalAlpha = 0.5;
        c.strokeStyle = "#5d584e";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(x + 10 + r * 20, y + 3);
        c.lineTo(x + 18 + r * 12, y + 12);
        c.lineTo(x + 13 + r * 16, y + 21);
        c.lineTo(x + 26 + r * 9, y + 29);
        c.stroke();
      }
    }
  }

  // Faint scratched glyphs.
  for (let i = 0; i < 12; i++) {
    const x = hash01(i, variant, 31) * 240;
    const y = hash01(i, variant, 32) * 240;
    c.globalAlpha = 0.22;
    c.strokeStyle = i % 3 === 0 ? "#8a7a4e" : "#7d6fa0";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 4, y + 8);
    c.lineTo(x + 1, y + 13);
    c.moveTo(x + 8, y + 2);
    c.lineTo(x + 12, y + 11);
    c.stroke();
  }

  // Vertical weathering streaks.
  for (let i = 0; i < 6; i++) {
    c.globalAlpha = 0.07;
    c.fillStyle = "#3b372f";
    c.fillRect(hash01(i, variant, 40) * 250, 0, 3 + hash01(i, variant, 41) * 6, 256);
  }

  c.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}

export function stoneTexture(variant: number): THREE.CanvasTexture | null {
  const v = ((variant % 4) + 4) % 4;
  const cached = textures.get(v);
  if (cached) return cached;
  const tex = drawStone(v);
  if (tex) textures.set(v, tex);
  return tex;
}

/** Shared textured stone material tinted by kingdom color. */
export function stoneMaterial(variant: number, tint: string): THREE.MeshStandardMaterial {
  const key = `${variant}:${tint}`;
  let m = stoneMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: stoneTexture(variant) ?? undefined,
      color: tint,
      roughness: 0.95,
      metalness: 0,
    });
    stoneMats.set(key, m);
  }
  return m;
}

export function solidMaterial(color: string): THREE.MeshStandardMaterial {
  let m = solidMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
    solidMats.set(color, m);
  }
  return m;
}

export function basicMaterial(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const key = `${color}:${opacity}`;
  let m = basicMats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
    });
    basicMats.set(key, m);
  }
  return m;
}

export function clothMaterial(color: string): THREE.MeshStandardMaterial {
  let m = clothMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide });
    clothMats.set(color, m);
  }
  return m;
}