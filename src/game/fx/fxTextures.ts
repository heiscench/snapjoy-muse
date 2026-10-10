import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

function make(
  key: string,
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
  repeatX = false,
): THREE.CanvasTexture | null {
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return null;
  draw(c);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX) tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

function blobs(c: CanvasRenderingContext2D, list: number[][], alpha: number) {
  for (const [x, y, r] of list) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
}

/** Soft round dot for ash and embers. */
export function softDotTexture() {
  return make("dot", 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

/** Lumpy cloud / smoke puff. */
export function puffTexture() {
  return make("puff", 128, 128, (c) => {
    blobs(c, [[64, 64, 50], [38, 72, 32], [90, 60, 34], [60, 38, 28], [78, 92, 28], [28, 52, 22], [100, 84, 22]], 0.55);
  });
}

/** Big soft patches for ground mist. */
export function mistTexture() {
  return make("mist", 128, 128, (c) => {
    blobs(c, [[64, 64, 62], [30, 40, 40], [98, 50, 38], [48, 100, 36], [100, 96, 34]], 0.4);
  });
}

/** Border wall: bright rune line at the base fading up, with faint vertical runes. */
export function borderTexture() {
  return make(
    "border",
    256,
    256,
    (c) => {
      const g = c.createLinearGradient(0, 256, 0, 0);
      g.addColorStop(0, "rgba(200,160,255,0.95)");
      g.addColorStop(0.18, "rgba(150,110,230,0.5)");
      g.addColorStop(0.6, "rgba(120,90,200,0.16)");
      g.addColorStop(1, "rgba(120,90,200,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = "rgba(255,255,255,0.28)";
      c.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const x = 16 + i * 32;
        const top = 96 + (i % 3) * 32;
        c.beginPath();
        c.moveTo(x, 256);
        c.lineTo(x, top);
        c.stroke();
        c.strokeRect(x - 5, top - 10, 10, 10);
      }
      c.fillStyle = "rgba(240,225,255,0.95)";
      c.fillRect(0, 248, 256, 8);
    },
    true,
  );
}