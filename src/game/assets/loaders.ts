/**
 * Model loading helpers for the FORGOTTEN asset library.
 *
 * Everything here is lazy: models load only when a component asks for them
 * (via suspense), never at app start. All loaders cache by URL, so repeated
 * useModel calls with the same id share one download/parse.
 *
 * This module is browser-only; do not import it from server code or SSR
 * route modules. Wrap consumers in <Suspense>.
 */
import { useGLTF, useFBX } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import type { Object3DNode } from "@react-three/fiber";
import { useMemo, useEffect, type JSX } from "react";
import { getModel, type ModelEntry } from "./manifest";

declare module "@react-three/fiber" {
  interface ThreeElements {
    instancedMesh: Object3DNode<THREE.InstancedMesh, typeof THREE.InstancedMesh>;
  }
}

function entryOrThrow(id: string): ModelEntry {
  const entry = getModel(id);
  if (!entry) throw new Error(`[assets] Unknown model id: ${id}`);
  return entry;
}

/**
 * Loads a model by manifest id. GLB/GLTF go through drei's cached useGLTF,
 * FBX through cached useFBX. Returns the parsed root (Group or Scene).
 */
export function useModel(id: string): THREE.Group {
  const entry = entryOrThrow(id);
  if (entry.format === "fbx") {
    return useFBX(entry.url) as unknown as THREE.Group;
  }
  const gltf = useGLTF(entry.url);
  return gltf.scene as THREE.Group;
}

/** Warms the cache for the given ids without rendering anything. */
export function preloadModels(ids: string[]): void {
  for (const id of ids) {
    const entry = getModel(id);
    if (!entry) {
      if (import.meta.env.DEV) console.warn(`[assets] preloadModels: unknown id ${id}`);
      continue;
    }
    if (entry.format === "fbx") useFBX.preload(entry.url);
    else useGLTF.preload(entry.url);
  }
}

/**
 * Clones a skinned model so several characters can share one loaded file.
 * A naive .clone() breaks skeleton bindings; SkeletonUtils does not.
 */
export function cloneAnimated(source: THREE.Object3D): THREE.Object3D {
  return cloneSkeleton(source, true);
}

/** A static pose instance: position + optional Euler rotation + scale. */
export interface ModelInstance {
  position: [number, number, number];
  rotationY?: number;
  scale?: number | [number, number, number];
}

interface MeshGroup {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

/**
 * Renders many copies of one static model as a handful of InstancedMeshes
 * (one per shared material). Suited to trees, walls, barrels, banners...
 * Do not use with skinned/animated models.
 */
export function InstancedModel({
  id,
  instances,
  castShadow = false,
  receiveShadow = false,
}: {
  id: string;
  instances: ModelInstance[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}): JSX.Element | null {
  const source = useModel(id);
  const entry = entryOrThrow(id);

  const instancedMeshes = useMemo(() => {
    if (instances.length === 0) return null;

    // Bake each source mesh's local transform into its geometry, then group
    // the baked geometries by material so each group becomes one InstancedMesh.
    const byMaterial = new Map<string, MeshGroup>();
    const dummy = new THREE.Matrix4();
    const normalMatrix = new THREE.Matrix3();

    source.updateMatrixWorld(true);
    source.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as THREE.Mesh).isMesh) return;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      if (geometry.attributes.normal) {
        normalMatrix.getNormalMatrix(mesh.matrixWorld);
        geometry.attributes.normal.applyNormalMatrix(normalMatrix);
      }
      const material = mesh.material as THREE.Material | THREE.Material[];
      const key = Array.isArray(material)
        ? material.map((m) => m.uuid).join("|")
        : material.uuid;
      const existing = byMaterial.get(key);
      if (existing) {
        existing.geometry = mergeGeometries([existing.geometry, geometry]);
      } else {
        byMaterial.set(key, { geometry, material });
      }
    });
    void dummy;

    const count = instances.length;
    const meshes: THREE.InstancedMesh[] = [];
    for (const group of byMaterial.values()) {
      const inst = new THREE.InstancedMesh(group.geometry, group.material, count);
      inst.castShadow = castShadow;
      inst.receiveShadow = receiveShadow;
      inst.frustumCulled = false;
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const axisY = new THREE.Vector3(0, 1, 0);
      instances.forEach((instance, i) => {
        pos.set(instance.position[0], instance.position[1], instance.position[2]);
        quat.setFromAxisAngle(axisY, instance.rotationY ?? 0);
        if (typeof instance.scale === "number") scale.setScalar(instance.scale);
        else if (instance.scale) scale.set(instance.scale[0], instance.scale[1], instance.scale[2]);
        else scale.set(1, 1, 1);
        m.compose(pos, quat, scale);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      meshes.push(inst);
    }
    return meshes;
  }, [source, instances, castShadow, receiveShadow]);

  useEffect(() => {
    if (import.meta.env.DEV && entry.format === "fbx") {
      // FBX is fine for static props too, just noting skinning is not instanced.
    }
  }, [entry]);

  if (!instancedMeshes) return null;
  return (
    <>
      {instancedMeshes.map((mesh, i) => (
        <primitive key={`${entry.id}-inst-${i}`} object={mesh} />
      ))}
    </>
  );
}

/** Merge buffer geometries, tolerating mismatched attribute sets. */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const { mergeGeometries: merge } = require("three/examples/jsm/utils/BufferGeometryUtils.js") as {
    mergeGeometries: (geos: THREE.BufferGeometry[], useGroups?: boolean) => THREE.BufferGeometry;
  };
  const merged = merge(list, false);
  if (merged) return merged;
  // Attributes didn't line up; fall back to the largest geometry so the
  // instanced mesh still renders instead of throwing.
  return list.reduce((a, b) => (a.attributes.position && b.attributes.position && a.attributes.position.count > b.attributes.position.count ? a : b));
}
