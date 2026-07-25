import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useCallback, useState } from "react";
import { City } from "./City";
import { Player } from "./Player";
import { Joystick } from "./Joystick";
import { input } from "./input";

export function GameScene() {
  const [running, setRunning] = useState(false);

  const onMove = useCallback((v: { x: number; y: number }) => {
    input.move.x = v.x;
    input.move.y = v.y;
  }, []);
  const onLook = useCallback((v: { x: number; y: number }) => {
    input.look.x = v.x;
    input.look.y = v.y;
  }, []);

  const requestLock = () => {
    const el = document.querySelector("canvas");
    if (el && !document.pointerLockElement) (el as HTMLCanvasElement).requestPointerLock?.();
  };

  return (
    <div className="fixed inset-0 bg-black" onClick={requestLock}>
      <Canvas
        dpr={[1, 1.25]}
        camera={{ fov: 68, position: [0, 5, 10], near: 0.1, far: 300 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#05060a"]} />
        <fog attach="fog" args={["#05060a", 40, 180]} />
        <hemisphereLight args={["#5a6a95", "#08080f", 0.6]} />
        <directionalLight position={[40, 70, 20]} intensity={0.5} color="#a9b8ff" />
        <Stars radius={200} depth={30} count={300} factor={3} fade speed={0.2} />
        <City />
        <Player />
      </Canvas>

      {/* Top HUD */}
      <div className="pointer-events-none fixed left-4 top-4 z-20 flex gap-2">
        <div className="rounded bg-black/50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
          Gang Wars
        </div>
        <div className="rounded bg-black/50 px-3 py-1 text-xs text-white/70 backdrop-blur">
          District: Downtown
        </div>
      </div>

      {/* Controls */}
      <Joystick side="left" onChange={onMove} label="Move" />
      <Joystick side="right" onChange={onLook} label="Look" />

      {/* Action buttons */}
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
      </div>

      {/* Orientation hint */}
      <div className="pointer-events-none fixed right-4 top-4 z-20 rounded bg-black/50 px-3 py-1 text-[10px] text-white/60 backdrop-blur">
        Rotate to landscape
      </div>
    </div>
  );
}
