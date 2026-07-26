import { useEffect, useRef } from "react";
import { BUILDINGS, HOSPITALS, GANG_HQ, BLOCK_SIZE, GRID } from "./worldData";
import { GANGS, PLAYER_GANG } from "./gangs";
import { playerState } from "./playerState";

const WORLD_EXTENT = (GRID + 1) * BLOCK_SIZE;
const SIZE = 160;

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf: number;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) {
        const scale = SIZE / (WORLD_EXTENT * 2);
        const toMap = (x: number, z: number) => ({ mx: SIZE / 2 + x * scale, mz: SIZE / 2 + z * scale });

        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = "rgba(5,6,10,0.9)";
        ctx.fillRect(0, 0, SIZE, SIZE);

        ctx.fillStyle = "rgba(120,140,180,0.35)";
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
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed right-4 top-16 z-20 overflow-hidden rounded-lg border border-white/20 shadow-lg">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
    </div>
  );
}