import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls, useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ModelCategory } from "@/game/assets/manifest";
import { ALL_MODELS } from "@/game/assets/manifestExtra";

export const Route = createFileRoute("/kit")({
  head: () => ({ meta: [{ title: "Model kit viewer" }] }),
  component: KitPage,
});

const CATEGORIES: ModelCategory[] = ["buildings", "props", "nature", "characters", "creatures", "vehicles", "weapons"];
const NORMAL_MAT = new THREE.MeshNormalMaterial();

type Info = {
  w: number; h: number; d: number; minY: number; cx: number; cz: number;
  tris: number; meshes: number; skinned: number; bones: number; mats: string[]; clips: string[];
};

class Guard extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? null : this.props.children; }
}

function inspect(root: THREE.Object3D, anims: THREE.AnimationClip[]): Info {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  let tris = 0, meshes = 0, skinned = 0, bones = 0;
  const mats = new Set<string>();
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (m.isSkinnedMesh) { skinned++; bones = Math.max(bones, m.skeleton.bones.length); }
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => {
      const bm = mt as THREE.MeshStandardMaterial;
      mats.add(`${mt.name || "?"}${bm.map ? " [tex]" : ""}`);
    });
  });
  return {
    w: size.x, h: size.y, d: size.z, minY: box.min.y, cx: c.x, cz: c.z,
    tris: Math.round(tris), meshes, skinned, bones, mats: [...mats], clips: anims.map((a) => `${a.name} ${a.duration.toFixed(1)}s`),
  };
}

function Piece({ url, normals, onInfo }: { url: string; normals: boolean; onInfo: (i: Info) => void }) {
  const gltf = useGLTF(url) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const { obj, info } = useMemo(() => {
    const o = cloneSkinned(gltf.scene) as THREE.Group;
    if (normals) o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.material = NORMAL_MAT; });
    return { obj: o, info: inspect(o, gltf.animations ?? []) };
  }, [gltf, normals]);
  useEffect(() => { onInfo(info); }, [info, onInfo]);
  return <primitive object={obj} />;
}

function Viewer() {
  const [cat, setCat] = useState<ModelCategory>("buildings");
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [normals, setNormals] = useState(false);
  const [spin, setSpin] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);

  const list = useMemo(
    () => ALL_MODELS.filter((m) => m.category === cat && m.format === "glb" && m.id.includes(q.trim().toLowerCase())),
    [cat, q],
  );
  const cur = list.length ? list[Math.min(idx, list.length - 1)] : undefined;
  const step = (d: number) => { setInfo(null); setIdx((i) => (list.length ? (i + d + list.length) % list.length : 0)); };

  const btn = (active = false): React.CSSProperties => ({
    padding: "6px 10px", borderRadius: 6, border: "1px solid #555", fontSize: 13, flex: "0 0 auto",
    background: active ? "#b49a60" : "#222", color: active ? "#000" : "#eee",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#15131a" }}>
      <Canvas camera={{ position: [3, 2.2, 5], fov: 45 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 8]} intensity={1.2} />
        <gridHelper args={[20, 20, "#777777", "#2c2c2c"]} />
        <axesHelper args={[1]} />
        <OrbitControls makeDefault autoRotate={spin} autoRotateSpeed={2} />
        {cur && (
          <Guard key={cur.id + String(normals)}>
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.5}>
                <Piece url={cur.url} normals={normals} onInfo={setInfo} />
              </Bounds>
            </Suspense>
          </Guard>
        )}
      </Canvas>

      <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {CATEGORIES.map((c) => (
            <button key={c} style={btn(c === cat)} onClick={() => { setCat(c); setIdx(0); setInfo(null); }}>{c}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); setInfo(null); }} placeholder="search (roof, door...)"
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #555", background: "#111", color: "#eee", fontSize: 13, width: 150 }} />
          <button style={btn()} onClick={() => step(-1)}>prev</button>
          <span style={{ color: "#eee", fontSize: 13 }}>{list.length ? Math.min(idx, list.length - 1) + 1 : 0} / {list.length}</span>
          <button style={btn()} onClick={() => step(1)}>next</button>
          <button style={btn(normals)} onClick={() => setNormals(!normals)}>shape</button>
          <button style={btn(spin)} onClick={() => setSpin(!spin)}>spin</button>
        </div>
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 600, textShadow: "0 0 4px #000" }}>{cur?.id ?? "no match"}</div>
      </div>

      {info && (
        <pre style={{ position: "absolute", left: 8, bottom: 8, right: 8, margin: 0, maxHeight: "40%", overflow: "auto",
          background: "rgba(0,0,0,0.78)", color: "#9f9", fontSize: 11, padding: 8, borderRadius: 6, whiteSpace: "pre-wrap" }}>
{`size   ${info.w.toFixed(2)} x ${info.h.toFixed(2)} x ${info.d.toFixed(2)}   (w x h x d)
base   y0=${info.minY.toFixed(2)}   centre x=${info.cx.toFixed(2)} z=${info.cz.toFixed(2)}
mesh   ${info.meshes} meshes, ${info.tris} tris, ${info.skinned} skinned, ${info.bones} bones
mats   ${info.mats.join(", ") || "none"}
anim   ${info.clips.length ? info.clips.join(", ") : "none"}`}
        </pre>
      )}
      <div style={{ position: "absolute", right: 8, bottom: info ? "42%" : 8, color: "#bbb", fontSize: 11 }}>
        red +X, green +Y, blue +Z (toward you). Grid = 1 m.
      </div>
    </div>
  );
}

function KitPage() {
  return (
    <ClientOnly fallback={<div style={{ position: "fixed", inset: 0, background: "#15131a" }} />}>
      <Viewer />
    </ClientOnly>
  );
}
