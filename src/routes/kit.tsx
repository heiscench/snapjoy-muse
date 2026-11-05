import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, useGLTF } from "@react-three/drei";
import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { modelsByCategory, type ModelCategory } from "@/game/assets/manifest";

export const Route = createFileRoute("/kit")({
  head: () => ({ meta: [{ title: "Model kit viewer" }] }),
  component: KitPage,
});

const CATEGORIES: ModelCategory[] = ["buildings", "props", "nature", "characters", "creatures", "vehicles", "weapons"];
const COLS = 5;
const PAGE = 20;
const SP = 3.4;

type Info = { id: string; w: number; h: number; d: number; minY: number; cx: number; cz: number };

class Guard extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? null : this.props.children; }
}

function Piece({ id, url, x, z, onInfo }: { id: string; url: string; x: number; z: number; onInfo: (i: Info) => void }) {
  const gltf = useGLTF(url) as unknown as { scene: THREE.Group };
  const { obj, info } = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const i: Info = { id, w: size.x, h: size.y, d: size.z, minY: box.min.y, cx: c.x, cz: c.z };
    return { obj: o, info: i };
  }, [gltf, id]);
  useEffect(() => { onInfo(info); }, [info, onInfo]);
  return (
    <group position={[x, 0, z]}>
      <primitive object={obj} />
      <Text position={[0, 0.01, 1.35]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color="#ffffff"
        outlineWidth={0.015} outlineColor="#000000" anchorX="center" anchorY="middle">
        {`${id}\n${info.w.toFixed(2)} x ${info.h.toFixed(2)} x ${info.d.toFixed(2)}`}
      </Text>
    </group>
  );
}

function Viewer() {
  const [cat, setCat] = useState<ModelCategory>("buildings");
  const [page, setPage] = useState(0);
  const [showList, setShowList] = useState(false);
  const [infos, setInfos] = useState<Record<string, Info>>({});
  const all = useMemo(() => modelsByCategory(cat).filter((m) => m.format === "glb"), [cat]);
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const items = all.slice(page * PAGE, (page + 1) * PAGE);
  const rows = Math.ceil(items.length / COLS);
  const onInfo = useCallback((i: Info) => setInfos((p) => (p[i.id] ? p : { ...p, [i.id]: i })), []);

  const btn = (active: boolean): React.CSSProperties => ({
    padding: "6px 10px", borderRadius: 6, border: "1px solid #555", fontSize: 13,
    background: active ? "#b49a60" : "#222", color: active ? "#000" : "#eee",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#15131a" }}>
      <Canvas camera={{ position: [(COLS - 1) / 2 * SP, 11, 8], fov: 50 }}>
        <ambientLight intensity={1.4} />
        <directionalLight position={[5, 10, 8]} intensity={1.2} />
        <axesHelper args={[2]} />
        <gridHelper args={[60, 60, "#666666", "#2a2a2a"]} position={[(COLS - 1) / 2 * SP, -0.001, -4]} />
        <OrbitControls makeDefault target={[(COLS - 1) / 2 * SP, 0, -((rows - 1) / 2) * SP]} />
        <group key={`${cat}-${page}`}>
          {items.map((m, i) => (
            <Guard key={m.id}>
              <Suspense fallback={null}>
                <Piece id={m.id} url={m.url} x={(i % COLS) * SP} z={-Math.floor(i / COLS) * SP} onInfo={onInfo} />
              </Suspense>
            </Guard>
          ))}
        </group>
      </Canvas>

      <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <button key={c} style={btn(c === cat)} onClick={() => { setCat(c); setPage(0); }}>{c}</button>
        ))}
        <button style={btn(false)} disabled={page === 0} onClick={() => setPage(page - 1)}>prev</button>
        <span style={{ color: "#eee", alignSelf: "center", fontSize: 13 }}>{page + 1} / {pages}</span>
        <button style={btn(false)} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>next</button>
        <button style={btn(showList)} onClick={() => setShowList(!showList)}>sizes</button>
      </div>

      {showList && (
        <pre style={{ position: "absolute", left: 8, bottom: 8, maxHeight: "55%", overflow: "auto", margin: 0,
          background: "rgba(0,0,0,0.8)", color: "#9f9", fontSize: 10, padding: 8, borderRadius: 6 }}>
          {items.map((m) => infos[m.id]).filter(Boolean).map((i) =>
            `${i.id}  ${i.w.toFixed(2)}x${i.h.toFixed(2)}x${i.d.toFixed(2)}  y0=${i.minY.toFixed(2)}  c=(${i.cx.toFixed(2)},${i.cz.toFixed(2)})`,
          ).join("\n")}
        </pre>
      )}
      <div style={{ position: "absolute", right: 8, bottom: 8, color: "#bbb", fontSize: 11 }}>
        red = +X, green = +Y, blue = +Z (toward you)
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