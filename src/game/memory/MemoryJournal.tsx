import { useEffect, useState } from "react";
import { THEMES } from "../city/palette";
import { FRAGMENTS, FRAGMENT_COUNT } from "./fragments";
import { LORE } from "./lore";
import { memoryState } from "./memoryState";

// Tune these two numbers if the button overlaps something on your screen.
const BTN_RIGHT = 219;
const BTN_TOP = 22;

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const card: React.CSSProperties = {
  background: "rgba(14,11,22,0.96)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 4,
  color: "#e9e4d8",
  boxShadow: "0 0 40px rgba(0,0,0,0.6)",
};

export function MemoryJournal() {
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [list, setList] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setVersion((v) => (v === memoryState.version ? v : memoryState.version));
      setOpen((o) => (o === memoryState.open ? o : memoryState.open));
    }, 200);
    return () => clearInterval(id);
  }, []);

  void version;
  const found = memoryState.found.size;
  const page = open !== null ? LORE[open - 1] : null;
  const pageFragment = open !== null ? FRAGMENTS[open - 1] : null;

  const closePage = () => {
    memoryState.open = null;
    setOpen(null);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Open the journal of memories"
        onPointerDown={stop}
        onPointerMove={stop}
        onPointerUp={stop}
        onClick={(e) => {
          e.stopPropagation();
          setList((l) => !l);
        }}
        style={{
          position: "fixed",
          top: `calc(env(safe-area-inset-top, 0px) + ${BTN_TOP}px)`,
          right: `calc(env(safe-area-inset-right, 0px) + ${BTN_RIGHT}px)`,
          height: 44,
          minWidth: 44,
          padding: "0 10px",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(14,11,22,0.8)",
          color: "#f3e2b3",
          fontSize: 13,
          fontWeight: 700,
          zIndex: 30,
        }}
      >
        📖 {found}/{FRAGMENT_COUNT}
      </button>

      {list && (
        <div
          onPointerDown={stop}
          onPointerMove={stop}
          onPointerUp={stop}
          onClick={stop}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(5,4,10,0.7)", display: "grid", placeItems: "center", padding: 16 }}
        >
          <div style={{ ...card, width: "min(560px, 100%)", maxHeight: "86vh", overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong style={{ letterSpacing: "0.2em", fontSize: 12 }}>JOURNAL OF MEMORIES · {found}/{FRAGMENT_COUNT}</strong>
              <button type="button" onClick={() => setList(false)} style={{ color: "#e9e4d8", fontSize: 18, padding: "0 8px" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
              {FRAGMENTS.map((f) => {
                const has = memoryState.found.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={!has}
                    onClick={() => {
                      memoryState.open = f.id;
                      setOpen(f.id);
                      setList(false);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 3,
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderLeft: `4px solid ${has ? THEMES[f.kingdom].trim : "#3a3548"}`,
                      background: "rgba(255,255,255,0.04)",
                      color: has ? "#e9e4d8" : "#6a6478",
                      fontSize: 12,
                    }}
                  >
                    {String(f.id).padStart(2, "0")} · {has ? LORE[f.id - 1].title : "???"}
                  </button>
                );
              })}
            </div>
            <p style={{ marginTop: 12, fontSize: 11, color: "#a79fb8" }}>
              Glowing crystals with tall beams hide in the streets and on the rooftops. Walk into one to remember.
            </p>
          </div>
        </div>
      )}

      {page && pageFragment && (
        <div
          onPointerDown={stop}
          onPointerMove={stop}
          onPointerUp={stop}
          onClick={stop}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(5,4,10,0.6)", display: "grid", placeItems: "center", padding: 16 }}
        >
          <div style={{ ...card, width: "min(460px, 100%)", padding: 20, borderTop: `4px solid ${THEMES[pageFragment.kingdom].trim}` }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: THEMES[pageFragment.kingdom].trim }}>
              MEMORY {String(pageFragment.id).padStart(2, "0")} OF {FRAGMENT_COUNT}
            </div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, margin: "6px 0 10px", letterSpacing: "0.04em" }}>{page.title}</h2>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 16, lineHeight: 1.5, color: "#d9d2c6" }}>{page.text}</p>
            <button
              type="button"
              onClick={closePage}
              style={{
                marginTop: 16,
                width: "100%",
                height: 44,
                border: `1px solid ${THEMES[pageFragment.kingdom].trim}`,
                borderRadius: 2,
                color: "#f3e2b3",
                letterSpacing: "0.26em",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              REMEMBERED
            </button>
          </div>
        </div>
      )}
    </>
  );
}