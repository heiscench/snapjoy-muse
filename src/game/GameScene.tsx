import { Canvas } from "@react-three/fiber";
import { Sky, Stars } from "@react-three/drei";
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

  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        shadows
        camera={{ fov: 65, position: [0, 5, 10] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#08090d"]} />
        <fog attach="fog" args={["#08090d", 40, 180]} />
        <hemisphereLight args={["#5a6a90", "#0a0a12", 0.4]} />
        <directionalLight
          position={[30, 60, 20]}
          intensity={0.6}
          color="#a9b8ff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
        />
        <Stars radius={200} depth={40} count={1200} factor={4} fade speed={0.4} />
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
