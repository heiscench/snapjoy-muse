import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const KEEP = new Set(["position", "normal", "uv"]);

type Bucket = { material: THREE.Material; geos: THREE.BufferGeometry[] };

/**
 * Bakes the plain meshes under it into a few big ones (one per material), so a building that was
 * ~30 draw calls becomes ~8. Only for content that never moves. Anything animated must carry
 * userData={{ noMerge: true }}. Text, instanced meshes and multi-material meshes are left alone.
 * `delayMs` spreads the work out so the game does not freeze while loading.
 */
export function MergeStatic({ children, delayMs = 0 }: { children: React.ReactNode; delayMs?: number }) {
  const ref = useRef<THREE.Group>(null!);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const merged: THREE.Mesh[] = [];
    let hidden: THREE.Mesh[] = [];
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      root.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const buckets = new Map<string, Bucket>();
      const sources: THREE.Mesh[] = [];

      root.traverse((o) => {
        const m = o as THREE.Mesh & { isInstancedMesh?: boolean; text?: unknown };
        if (!m.isMesh || m.isInstancedMesh || m.userData.noMerge || "text" in m) return;
        if (!m.visible || Array.isArray(m.material)) return;
        const a = m.geometry.attributes;
        if (!a.position || !a.normal || !a.uv) return;

        const mat = m.material as THREE.Material;
        let g = m.geometry.clone();
        if (g.index) g = g.toNonIndexed();
        for (const key of Object.keys(g.attributes)) if (!KEEP.has(key)) g.deleteAttribute(key);
        m.updateWorldMatrix(true, false);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));

        const b = buckets.get(mat.uuid) ?? { material: mat, geos: [] };
        b.geos.push(g);
        buckets.set(mat.uuid, b);
        sources.push(m);
      });

      for (const b of buckets.values()) {
        const geo = mergeGeometries(b.geos, false);
        b.geos.forEach((g) => g.dispose());
        if (!geo) continue;
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, b.material);
        mesh.userData.noMerge = true;
        root.add(mesh);
        merged.push(mesh);
      }
      sources.forEach((s) => { s.visible = false; });
      hidden = sources;
    };

    const t = setTimeout(run, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
      merged.forEach((m) => { root.remove(m); m.geometry.dispose(); });
      hidden.forEach((s) => { s.visible = true; });
    };
  }, [delayMs]);

  return <group ref={ref}>{children}</group>;
}