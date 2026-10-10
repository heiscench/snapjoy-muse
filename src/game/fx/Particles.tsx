import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { playerState } from "../playerState";
import { softDotTexture } from "./fxTextures";

type MoteProps = {
  count: number;
  size: number;
  opacity: number;
  additive: boolean;
  palette: string[];
  vyMin: number;
  vyMax: number;
  wind: number;
  radius: number;
  height: number;
};

/** Particles live in world space and wrap around the player, so you fly past them. */
function Motes({ count, size, opacity, additive, palette, vyMin, vyMax, wind, radius, height }: MoteProps) {
  const inited = useRef(false);

  const data = useMemo(() => {
    const world = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    const phase = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      vel[i] = vyMin + Math.random() * (vyMax - vyMin);
      phase[i] = Math.random() * 6.28;
      c.set(palette[i % palette.length]);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return { world, vel, phase, geo };
  }, [count, vyMin, vyMax, palette]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const px = playerState.pos.x;
    const pz = playerState.pos.z;
    const { world, vel, phase, geo } = data;

    if (!inited.current) {
      for (let i = 0; i < count; i++) {
        world[i * 3] = px + (Math.random() * 2 - 1) * radius;
        world[i * 3 + 1] = Math.random() * height;
        world[i * 3 + 2] = pz + (Math.random() * 2 - 1) * radius;
      }
      inited.current = true;
    }

    const attr = geo.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      let x = world[k] + (wind + Math.sin(t * 0.6 + phase[i]) * 0.8) * dt;
      let y = world[k + 1] + vel[i] * dt;
      let z = world[k + 2] + Math.cos(t * 0.5 + phase[i]) * 0.6 * dt;
      const dx = x - px;
      const dz = z - pz;
      if (dx > radius) x -= radius * 2;
      else if (dx < -radius) x += radius * 2;
      if (dz > radius) z -= radius * 2;
      else if (dz < -radius) z += radius * 2;
      if (y > height) y -= height;
      else if (y < 0) y += height;
      world[k] = x;
      world[k + 1] = y;
      world[k + 2] = z;
      arr[k] = x;
      arr[k + 1] = y;
      arr[k + 2] = z;
    }
    attr.needsUpdate = true;
  });

  return (
    <points geometry={data.geo} frustumCulled={false}>
      <pointsMaterial
        map={softDotTexture() ?? undefined}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        vertexColors
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  );
}

const ASH = ["#cfc8d9", "#b9b2c9", "#d9d2c6"];
const EMBERS = ["#ff8a3c", "#ffb347", "#ff5a36", "#b98cff"];

export function Particles() {
  return (
    <>
      <Motes count={240} size={0.26} opacity={0.5} additive={false} palette={ASH}
        vyMin={-1.3} vyMax={-0.4} wind={1.1} radius={65} height={42} />
      <Motes count={90} size={0.34} opacity={0.9} additive palette={EMBERS}
        vyMin={0.8} vyMax={2.2} wind={0.7} radius={55} height={34} />
    </>
  );
}