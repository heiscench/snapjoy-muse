/**
 * Asset library checker panel — shown on /assets?dev=1 only.
 *
 * Lists every model in the manifest with its size and format, previews the
 * selected model in a small 3D viewport, surfaces red flags (oversized files,
 * animation skeleton mismatches) and can copy the whole report as text.
 * Browser-only; loaded lazily from the route.
 */
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useFBX } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useState, type JSX } from "react";
import * as THREE from "three";
import { MODELS, modelsByCategory, type ModelCategory, type ModelEntry } from "./manifest";
import {
  collectAnimationMismatches,
  subscribeAnimationMismatches,
  type AnimationMismatch,
} from "./animations";

const CATEGORY_ORDER: ModelCategory[] = [
  "buildings", "nature", "characters", "creatures", "vehicles", "weapons", "props", "animations",
];

/** A model above this size is flagged as heavy for mobile loading. */
const LARGE_FILE_KB = 10_000;

export function CheckerPanel() {
  const [category, setCategory] = useState<ModelCategory>("characters");
  const [selected, setSelected] = useState<ModelEntry | null>(null);
  const [mismatches, setMismatches] = useState<AnimationMismatch[]>(collectAnimationMismatches());
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeAnimationMismatches(() => setMismatches(collectAnimationMismatches())), []);

  const flags = useMemo(() => {
    const out: string[] = [];
    for (const m of MODELS) {
      if (m.sizeKb > LARGE_FILE_KB) out.push(`${m.id}: ${(m.sizeKb / 1024).toFixed(1)} MB — large download`);
    }
    for (const mm of mismatches) {
      out.push(`animation: ${mm.animationId} -> ${mm.characterId} (${mm.action}) — ${mm.reason}`);
    }
    return out;
  }, [mismatches]);

  const entries = modelsByCategory(category);

  function copyReport() {
    const report = {
      total: MODELS.length,
      byCategory: CATEGORY_ORDER.map((c) => ({ category: c, count: modelsByCategory(c).length })),
      redFlags: flags,
      animationMismatches: mismatches,
      models: MODELS.map((m) => ({ id: m.id, url: m.url, format: m.format, sizeKb: m.sizeKb })),
    };
    navigator.clipboard?.writeText(JSON.stringify(report, null, 2)).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground p-4 text-sm">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-serif text-2xl text-amber-100">Model library</h1>
        <span className="text-muted-foreground">{MODELS.length} entries</span>
        <button onClick={copyReport} className="ml-auto rounded border border-border px-3 py-1 text-xs hover:bg-muted">
          {copied ? "Copied" : "Copy report"}
        </button>
      </header>

      <nav className="mt-3 flex flex-wrap gap-2">
        {CATEGORY_ORDER.map((c) => (
          <button key={c}
            onClick={() => { setCategory(c); setSelected(null); }}
            className={`rounded-full px-3 py-1 text-xs ${category === c ? "bg-amber-200/20 text-amber-100" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {c} ({modelsByCategory(c).length})
          </button>
        ))}
      </nav>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section className="rounded border border-border p-2">
          <ul className="max-h-[70dvh] divide-y divide-border overflow-auto">
            {entries.map((m) => (
              <li key={m.id}>
                <button onClick={() => setSelected(m)}
                  className={`flex w-full items-center gap-3 px-2 py-1.5 text-left hover:bg-muted ${selected?.id === m.id ? "bg-amber-200/10" : ""}`}>
                  <span className="font-mono text-xs">{m.id}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{m.format} · {m.sizeKb >= 1024 ? `${(m.sizeKb / 1024).toFixed(1)} MB` : `${m.sizeKb} KB`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded border border-border p-3">
          {selected ? (
            <>
              <p className="font-mono text-xs text-amber-100">{selected.id}</p>
              <p className="text-xs text-muted-foreground">{selected.url} · {selected.sizeKb} KB</p>
              <div className="mt-2 h-[320px] overflow-hidden rounded bg-black/40">
                <Canvas camera={{ position: [1.6, 1.2, 2.4], fov: 45 }} dpr={[1, 1.5]}>
                  <ambientLight intensity={0.9} />
                  <directionalLight position={[3, 6, 4]} intensity={1.4} />
                  <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#8bb" />
                  <Suspense fallback={null}>
                    <PreviewSwapper key={selected.id} entry={selected} />
                  </Suspense>
                  <gridHelper args={[8, 16, "#444", "#222"]} />
                  <OrbitControls target={[0, 0.8, 0]} />
                </Canvas>
              </div>
              <ClipList entry={selected} />
            </>
          ) : (
            <p className="text-muted-foreground">Select a model on the left to preview it.</p>
          )}

          <h2 className="mt-4 font-serif text-lg text-amber-100/90">Red flags ({flags.length})</h2>
          {flags.length === 0
            ? <p className="text-muted-foreground">None detected.</p>
            : (
              <ul className="mt-1 max-h-[220px] space-y-1 overflow-auto text-xs text-red-200/90">
                {flags.map((f, i) => <li key={i}>⚠ {f}</li>)}
              </ul>
            )}
        </section>
      </div>
    </div>
  );
}

/** Re-mounts on selection change so each model loads fresh. */
function PreviewSwapper({ entry }: { entry: ModelEntry }) {
  return entry.format === "fbx" ? <FBXPreview entry={entry} /> : <GLTFPreview entry={entry} />;
}

function GLTFPreview({ entry }: { entry: ModelEntry }) {
  const gltf = useGLTF(entry.url);
  return <Fitted model={gltf.scene} />;
}

function FBXPreview({ entry }: { entry: ModelEntry }) {
  const obj = useFBX(entry.url);
  return <Fitted model={obj} />;
}

/** Centers and scales any model into a ~1.6 m tall preview slot. */
function Fitted({ model }: { model: THREE.Object3D }) {
  const fitted = useMemo(() => {
    const clone = model.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const scale = size.y > 0.0001 ? 1.6 / size.y : 1;
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);
    return clone;
  }, [model]);
  return <primitive object={fitted} />;
}

/** Lists the animation clips inside the selected file, when the format carries them. */
function ClipList({ entry }: { entry: ModelEntry }) {
  const [clips, setClips] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setClips(null);
    (async () => {
      try {
        if (entry.format === "fbx") {
          const obj = await useFBXLoaderPromise(entry.url);
          if (!cancelled) setClips(obj.animations.map((c: THREE.AnimationClip) => c.name));
        } else {
          const gltf = await useGLTFLoaderPromise(entry.url);
          if (!cancelled) setClips(gltf.animations.map((c) => c.name));
        }
      } catch {
        if (!cancelled) setClips([]);
      }
    })();
    return () => { cancelled = true; };
  }, [entry]);

  return (
    <div className="mt-2">
      <p className="text-xs text-muted-foreground">
        {clips === null ? "Reading clips…" : clips.length === 0 ? "No animation clips" : `Clips (${clips.length}):`}
      </p>
      {clips !== null && clips.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {clips.map((c) => (
            <span key={c} className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

async function useGLTFLoaderPromise(url: string) {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  return new Promise<{ animations: THREE.AnimationClip[] }>((resolve, reject) =>
    loader.load(url, (gltf) => resolve(gltf), undefined, reject));
}

async function useFBXLoaderPromise(url: string) {
  const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
  const loader = new FBXLoader();
  return new Promise<{ animations: THREE.AnimationClip[] }>((resolve, reject) =>
    loader.load(url, (obj) => resolve(obj as unknown as { animations: THREE.AnimationClip[] }), undefined, reject));
}

export type { JSX };
