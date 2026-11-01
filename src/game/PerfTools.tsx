import { useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useEffect, useRef } from "react";

/** Shows FPS, draw calls and triangles when the page address contains ?perf=1 */
export function PerfOverlay() {
  const gl = useThree((s) => s.gl);
  const el = useRef<HTMLDivElement | null>(null);
  const acc = useRef({ frames: 0, t: 0 });
  const enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf");

  useEffect(() => {
    if (!enabled) return;
    const d = document.createElement("div");
    d.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:60;padding:4px 8px;background:rgba(0,0,0,.7);color:#7CFF9B;font:11px/1.3 monospace;pointer-events:none;white-space:pre";
    document.body.appendChild(d);
    el.current = d;
    return () => {
      d.remove();
      el.current = null;
    };
  }, [enabled]);

  useFrame((_, dt) => {
    if (!enabled || !el.current) return;
    acc.current.frames++;
    acc.current.t += dt;
    if (acc.current.t >= 0.5) {
      const fps = acc.current.frames / acc.current.t;
      const i = gl.info;
      el.current.textContent =
        `${fps.toFixed(0)} fps\n${i.render.calls} draws\n${(i.render.triangles / 1000).toFixed(0)}k tris\n` +
        `${i.memory.geometries} geo ${i.memory.textures} tex\nres ${gl.getPixelRatio().toFixed(2)}`;
      acc.current = { frames: 0, t: 0 };
    }
  });
  return null;
}

/** Watches the frame rate. When the phone struggles it lowers the resolution and asks for lighter effects. */
export function AdaptiveQuality({ onLow }: { onLow: () => void }) {
  const setDpr = useThree((s) => s.setDpr);
  return (
    <PerformanceMonitor
      ms={300}
      iterations={6}
      threshold={0.7}
      flipflops={2}
      onDecline={() => {
        setDpr(0.8);
        onLow();
      }}
      onFallback={() => {
        setDpr(0.65);
        onLow();
      }}
    />
  );
}