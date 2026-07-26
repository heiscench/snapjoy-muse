
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useCallback, useRef, useState } from "react";
import { City } from "./City";
import { Player } from "./Player";
import { Joystick } from "./Joystick";
import { NPCs } from "./NPCs";
import { Vehicles } from "./Vehicles";
import { DayNight } from "./DayNight";
import { GANGS, PLAYER_GANG } from "./gangs";
import { input } from "./input";

// Full-screen drag layer for free camera look. Sits under the joystick/buttons
// (which have a higher z-index and their own pointer handlers), so it only
// receives touches on empty screen space.
function LookPad() {
  const active = useRef<number | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    active.current = e.pointerId;
    last.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !last.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    input.mouseDX += dx;
    input.mouseDY += dy;
  };
  const onUp = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    last.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-10 touch-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}

export function GameScene() {
  const [running, setRunning] = useState(false);
  const [aiming, setAiming] = useState(false);
  const gang = GANGS[PLAYER_GANG];

  const onMove = useCallback((v: { x: number; y: number }) => {
    input.move.x = v.x;
    input.move.y = v.y;
  }, []);

  const requestLock = () => {
    const el = document.querySelector("canvas");
    if (el && !document.pointerLockElement) (el as HTMLCanvasElement).requestPointerLock?.();
  };

  return (
    <div className="fixed inset-0 bg-black" onClick={requestLock}>
      <Canvas
        dpr={[1, 1.25]}
        camera={{ fov: 66, position: [0, 5, 10], near: 0.1, far: 400 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <fog attach="fog" args={["#05060a", 60, 260]} />
        <DayNight />
        <Stars radius={220} depth={30} count={220} factor={3} fade speed={0.2} />
        <City />
        <Vehicles />
        <NPCs />
        <Player />
      </Canvas>

      <LookPad />

      {/* Top HUD */}
      <div className="pointer-events-none fixed left-4 top-4 z-20 flex gap-2">
        <div
          className="rounded px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur border"
          style={{ backgroundColor: `${gang.color}cc`, borderColor: gang.accent }}
        >
          {gang.name}
        </div>
        <div className="rounded bg-black/50 px-3 py-1 text-xs text-white/70 backdrop-blur">
          District: Downtown
        </div>
      </div>

      {aiming && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="h-3 w-3 rounded-full border-2 border-white/80" />
        </div>
      )}

      <Joystick side="left" onChange={onMove} label="Move" />

      <div className="fixed bottom-40 left-8 z-20 flex flex-col gap-3">
        <button
          onPointerDown={() => { input.aim = true; setAiming(true); }}
          onPointerUp={() => { input.aim = false; setAiming(false); }}
          onPointerCancel={() => { input.aim = false; setAiming(false); }}
          className={`h-14 w-14 rounded-full border text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur ${
            aiming ? "border-cyan-300 bg-cyan-500/40" : "border-white/20 bg-black/40"
          }`}
        >
          Aim
        </button>
      </div>

      <div className="fixed bottom-40 right-8 z-20 flex flex-col gap-3">
        <button
          onPointerDown={() => (input.jump = true)}
          className="h-14 w-14 rounded-full border border-white/20 bg-black/40 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur active:bg-white/20"
        >
          Jump
        </button>
        <button
          onPointerDown={() => {
            input.run = !input.run;
            setRunning(input.run);
          }}
          className={`h-14 w-14 rounded-full border text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur ${
            running ? "border-yellow-300 bg-yellow-500/40" : "border-white/20 bg-black/40"
          }`}
        >
          Run
        </button>
        <button
          onPointerDown={() => (input.fire = true)}
          onPointerUp={() => (input.fire = false)}
          onPointerCancel={() => (input.fire = false)}
          className="h-14 w-14 rounded-full border border-red-400/60 bg-red-600/40 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur active:bg-red-500/60"
        >
          Fire
        </button>
      </div>

      <div className="pointer-events-none fixed right-4 top-4 z-20 rounded bg-black/50 px-3 py-1 text-[10px] text-white/60 backdrop-blur">
        Drag anywhere to look · Right-click to aim (desktop)
      </div>
    </div>
  );
}