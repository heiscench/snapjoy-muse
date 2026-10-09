import { useEffect, useRef } from "react";
import { BUILDINGS, HOSPITALS, GANG_HQ, BLOCK_SIZE, GRID } from "./worldData";
import { GANGS, PLAYER_GANG } from "./gangs";
import { playerState } from "./playerState";
import { territoryState } from "./territoryState";

const WORLD_EXTENT = (GRID + 1) * BLOCK_SIZE;
const SIZE = 160;

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      const scale = SIZE / (WORLD_EXTENT * 2);
      const toMap = (x: number, z: number) => ({ mx: SIZE / 2 + x * scale, mz: SIZE / 2 + z * scale });

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "rgba(5,6,10,0.9)";
      ctx.fillRect(0, 0, SIZE, SIZE);

      // District ownership tint — faint overlay behind buildings.
      for (const b of BUILDINGS) {
        const owner = territoryState.owners[b.district];
        if (owner === null || owner === undefined) continue;
        const c = GANGS[owner].accent;
        const { mx, mz } = toMap(b.x, b.z);
        ctx.fillStyle = c + "55";
        ctx.fillRect(mx - (b.w * scale) / 2 - 2, mz - (b.d * scale) / 2 - 2, Math.max(3, b.w * scale) + 4, Math.max(3, b.d * scale) + 4);
      }

      ctx.fillStyle = "rgba(120,140,180,0.7)";
      for (const b of BUILDINGS) {
        const { mx, mz } = toMap(b.x, b.z);
        ctx.fillRect(mx - (b.w * scale) / 2, mz - (b.d * scale) / 2, Math.max(1.5, b.w * scale), Math.max(1.5, b.d * scale));
      }

      ctx.fillStyle = "#ff5a5a";
      for (const h of HOSPITALS) {
        const { mx, mz } = toMap(h.x, h.z);
        ctx.beginPath();
        ctx.arc(mx, mz, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const gid of [0, 1, 2, 3] as const) {
        const hq = GANG_HQ[gid];
        const { mx, mz } = toMap(hq.x, hq.z);
        ctx.fillStyle = GANGS[gid].accent;
        ctx.beginPath();
        ctx.arc(mx, mz, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const { mx, mz } = toMap(playerState.pos.x, playerState.pos.z);
      ctx.save();
      ctx.translate(mx, mz);
      ctx.rotate(playerState.yaw);
      ctx.fillStyle = GANGS[PLAYER_GANG].color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(3.5, 4);
      ctx.lineTo(-3.5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
    };
    draw();
    const id = setInterval(draw, 80); // ~12fps — plenty for a minimap
    return () => clearInterval(id);
  }, []);

  return (
    <div className="game-minimap">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
    </div>
  );
}