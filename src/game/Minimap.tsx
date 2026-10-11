import { useEffect, useRef } from "react";
import {
  BUILDINGS, HOSPITALS, GANG_HQ, NEUTRAL_HQS, BLOCK_SIZE, GRID, districtFor,
  type District,
} from "./worldData";
import { GANGS, PLAYER_GANG } from "./gangs";
import { playerState } from "./playerState";
import { territoryState } from "./territoryState";
import { carPilot } from "./carState";
import { NPCS } from "./npcState";
import { remotePlayers } from "./remotePlayerState";
import { themeOf } from "./city/palette";
import { FRAGMENTS } from "./memory/fragments";
import { monsterTarget } from "./monster/monsterState";
import { memoryState } from "./memory/memoryState";
import { ROAD_LINES, ROAD_W, KINGDOM_EDGES } from "./city/layout";

const WORLD = (GRID + 1) * BLOCK_SIZE;
const SIZE = 160;
const VIEW_R = 210; // metres shown from the centre to the edge of the radar
const PX = 0.5; // pixels per metre in the pre-drawn world layer
const STATIC = Math.ceil(WORLD * 2 * PX);
const toS = (v: number) => (v + WORLD) * PX;

const GANG_HQ_DISTRICT: District[] = ["downtown", "industrial", "shopping", "harbor"];
const HQS: { x: number; z: number; district: District }[] = [
  ...([0, 1, 2, 3] as const).map((g) => ({ x: GANG_HQ[g].x, z: GANG_HQ[g].z, district: GANG_HQ_DISTRICT[g] })),
  ...NEUTRAL_HQS,
];

let layer: HTMLCanvasElement | null = null;

/** The whole world drawn once: kingdom land, roads, buildings and glowing border lines. */
function buildLayer(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = STATIC;
  c.height = STATIC;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "#0d0b14";
  g.fillRect(0, 0, STATIC, STATIC);

  g.globalAlpha = 0.55;
  for (let gx = -GRID; gx <= GRID; gx++) {
    for (let gz = -GRID; gz <= GRID; gz++) {
      g.fillStyle = themeOf(districtFor(gx, gz)).ground;
      g.fillRect(toS(gx * BLOCK_SIZE - BLOCK_SIZE / 2), toS(gz * BLOCK_SIZE - BLOCK_SIZE / 2), BLOCK_SIZE * PX, BLOCK_SIZE * PX);
    }
  }
  g.globalAlpha = 1;

  g.fillStyle = "#231f2c";
  for (const p of ROAD_LINES) {
    g.fillRect(toS(p - ROAD_W / 2), 0, ROAD_W * PX, STATIC);
    g.fillRect(0, toS(p - ROAD_W / 2), STATIC, ROAD_W * PX);
  }

  for (const b of BUILDINGS) {
    if (b.type === "plaza") continue;
    g.fillStyle = "rgba(18,14,26,0.92)";
    g.fillRect(toS(b.x - b.w / 2), toS(b.z - b.d / 2), Math.max(2, b.w * PX), Math.max(2, b.d * PX));
    g.strokeStyle = themeOf(b.district).trim;
    g.lineWidth = 0.8;
    g.strokeRect(toS(b.x - b.w / 2), toS(b.z - b.d / 2), Math.max(2, b.w * PX), Math.max(2, b.d * PX));
  }

  g.strokeStyle = "rgba(235,225,255,0.9)";
  g.lineWidth = 2;
  for (const e of KINGDOM_EDGES) {
    g.beginPath();
    if (e.alongX) {
      g.moveTo(toS(e.x - BLOCK_SIZE / 2), toS(e.z));
      g.lineTo(toS(e.x + BLOCK_SIZE / 2), toS(e.z));
    } else {
      g.moveTo(toS(e.x), toS(e.z - BLOCK_SIZE / 2));
      g.lineTo(toS(e.x), toS(e.z + BLOCK_SIZE / 2));
    }
    g.stroke();
  }
  return c;
}

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      if (!layer) layer = buildLayer();

      const px = playerState.pos.x;
      const pz = playerState.pos.z;
      const scale = SIZE / (VIEW_R * 2);
      const mx = (x: number) => SIZE / 2 + (x - px) * scale;
      const mz = (z: number) => SIZE / 2 + (z - pz) * scale;
      const inView = (x: number, z: number, pad = 0) =>
        Math.abs(x - px) < VIEW_R + pad && Math.abs(z - pz) < VIEW_R + pad;

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = "#0d0b14";
      ctx.fillRect(0, 0, SIZE, SIZE);
      const win = VIEW_R * 2 * PX;
      ctx.drawImage(layer, toS(px - VIEW_R), toS(pz - VIEW_R), win, win, 0, 0, SIZE, SIZE);

      // Territory ownership tint on top of the buildings.
      for (const b of BUILDINGS) {
        const owner = territoryState.owners[b.district];
        if (owner === null || owner === undefined || !inView(b.x, b.z, 40)) continue;
        ctx.fillStyle = GANGS[owner].accent + "66";
        ctx.fillRect(mx(b.x - b.w / 2) - 1, mz(b.z - b.d / 2) - 1, Math.max(3, b.w * scale) + 2, Math.max(3, b.d * scale) + 2);
      }

      // Sanctums.
      ctx.strokeStyle = "#c9a8ff";
      ctx.fillStyle = "#c9a8ff";
      ctx.lineWidth = 1.4;
      for (const h of HOSPITALS) {
        if (!inView(h.x, h.z)) continue;
        ctx.beginPath();
        ctx.arc(mx(h.x), mz(h.z), 3.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx(h.x), mz(h.z), 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Halls (HQs) as diamonds in the owner's colour.
      for (const hq of HQS) {
        if (!inView(hq.x, hq.z)) continue;
        const owner = territoryState.owners[hq.district];
        ctx.fillStyle = owner !== null && owner !== undefined ? GANGS[owner].accent : "#e9e4d8";
        ctx.strokeStyle = "#0d0b14";
        ctx.lineWidth = 1;
        const x = mx(hq.x);
        const z = mz(hq.z);
        ctx.beginPath();
        ctx.moveTo(x, z - 5);
        ctx.lineTo(x + 4, z);
        ctx.lineTo(x, z + 5);
        ctx.lineTo(x - 4, z);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Beings: enemies in their faction colour, allies in yours.
      for (const n of NPCS) {
        if (n.dead || !inView(n.pos.x, n.pos.z)) continue;
        ctx.fillStyle = GANGS[n.gang].accent;
        ctx.beginPath();
        ctx.arc(mx(n.pos.x), mz(n.pos.z), n.gang === PLAYER_GANG ? 1.6 : 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const rp of remotePlayers.values()) {
        if (rp.health <= 0 || !inView(rp.x, rp.z)) continue;
        ctx.fillStyle = GANGS[rp.gang as 0 | 1 | 2 | 3].accent;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mx(rp.x), mz(rp.z), 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      
            // Unfound memories pulse; the nearest one off the radar shows a pointer on the rim.
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      let nearest: { x: number; z: number; d: number } | null = null;
      for (const f of FRAGMENTS) {
        if (memoryState.found.has(f.id)) continue;
        const d = Math.hypot(f.x - px, f.z - pz);
        if (!nearest || d < nearest.d) nearest = { x: f.x, z: f.z, d };
        if (!inView(f.x, f.z)) continue;
        ctx.fillStyle = "#fff3b0";
        ctx.beginPath();
        ctx.arc(mx(f.x), mz(f.z), 2.2 + pulse * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (nearest && !inView(nearest.x, nearest.z)) {
        const a = Math.atan2(nearest.z - pz, nearest.x - px);
        const rr = SIZE / 2 - 7;
        ctx.save();
        ctx.translate(SIZE / 2 + Math.cos(a) * rr, SIZE / 2 + Math.sin(a) * rr);
        ctx.rotate(a);
        ctx.fillStyle = "#fff3b0";
        ctx.globalAlpha = 0.6 + pulse * 0.4;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-3, -3.6);
        ctx.lineTo(-3, 3.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
            // The monster: a pulsing red marker, or a pointer on the rim when it is out of range.
      const mon = monsterTarget();
      if (mon) {
        const mp = 0.5 + 0.5 * Math.sin(performance.now() / 200);
        if (inView(mon.x, mon.z)) {
          ctx.strokeStyle = "#ff4d5e";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(mx(mon.x), mz(mon.z), 5 + mp * 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#ff4d5e";
          ctx.beginPath();
          ctx.arc(mx(mon.x), mz(mon.z), 3.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const a = Math.atan2(mon.z - pz, mon.x - px);
          const rr = SIZE / 2 - 8;
          ctx.save();
          ctx.translate(SIZE / 2 + Math.cos(a) * rr, SIZE / 2 + Math.sin(a) * rr);
          ctx.rotate(a);
          ctx.fillStyle = "#ff4d5e";
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(-4, -5);
          ctx.lineTo(-4, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // You: the arrow points the way you are heading (cars use the opposite yaw convention).
      const heading = carPilot.driving ? Math.PI - playerState.yaw : -playerState.yaw;
      ctx.save();
      ctx.translate(SIZE / 2, SIZE / 2);
      ctx.rotate(heading);
      ctx.fillStyle = GANGS[PLAYER_GANG].color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.2, 5);
      ctx.lineTo(0, 2.6);
      ctx.lineTo(-4.2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("N", SIZE / 2 - 3, 11);
    };
    draw();
    const id = setInterval(draw, 80);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="game-minimap" style={{ borderRadius: "50%", overflow: "hidden" }}>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
    </div>
  );
}