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
        shadows="basic"
        dpr={[1, 1.5]}
        camera={{ fov: 65, position: [0, 5, 10], near: 0.1, far: 400 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#06070b"]} />
        <fog attach="fog" args={["#06070b", 50, 220]} />
        <hemisphereLight args={["#4a5a80", "#08080f", 0.35]} />
        <directionalLight
          position={[40, 70, 20]}
          intensity={0.55}
          color="#a9b8ff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />
        <Stars radius={220} depth={40} count={800} factor={4} fade speed={0.3} />
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
