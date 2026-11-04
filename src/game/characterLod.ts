import * as THREE from "three";

// Distance levels for every being (NPCs, civilians, guards):
//   0 = the full detailed body, 1 = one simple figure (a single draw call), 2 = not drawn.
// LOD_FULL was 38. A full body costs about 28 draw calls, so keeping it close saves a lot on phones.
export const LOD_FULL = 18;
export const LOD_PROXY = 110;

export function lodLevel(distance: number): 0 | 1 | 2 {
  return distance < LOD_FULL ? 0 : distance < LOD_PROXY ? 1 : 2;
}

/** The far-away stand-in for a character: a low-poly capsule about as tall as a person. */
export const PROXY_GEO = new THREE.CapsuleGeometry(0.42, 1.2, 2, 6);
export const PROXY_Y = 1.05;