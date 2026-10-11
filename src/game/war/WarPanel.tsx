import { useEffect, useState } from "react";
import { PLAYER_GANG } from "../gangs";
import { THEMES } from "../city/palette";
import { startWarSync, warNow, warOrder, warRank, warRoleOf, warState } from "./warState";

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const card: React.CSSProperties = {
  background: "rgba(14,11,22,0.96)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 4,
  color: "#e9e4d8",
  boxShadow: "0 0 40px rgba(0,0,0,0.6)",
};

function untilReset(): string {
  const ms = Math.max(0, warState.weekEndMs - warNow());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

export function WarPanel() {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => startWarSync(), []);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => (v + 1) % 1_000_000), 1000);
    return () => clearInterval(id);
  }, []);

  const rank = warRank(PLAYER_GANG);
  const order = warOrder();
  const max = Math.max(1, ...warState.scores.map((s) => s.score));
  const myRole = warRoleOf(PLAYER_GANG);

  return (
    <>
      <button
        type="button"
        aria-label="Open the war standings"
        onPointerDown={stop}
        onPointerMove={stop}
        onPointerUp={stop}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{
          position: "fixed",
          top: "var(--hud-top)",
          right: "calc(var(--hud-right) + var(--hud-map) + var(--hud-gap) * 3 + 88px)",
          height: 44,
          minWidth: 44,
          padding: "0 10px",
          borderRadius: 22,
          border: `1px solid ${myRole === "ascendant" ? "#f3e2b3" : myRole === "humbled" ? "#ff4d5e" : "rgba(255,255,255,0.25)"}`,
          background: "rgba(14,11,22,0.8)",
          color: "#f3e2b3",
          fontSize: 13,
          fontWeight: 700,
          zIndex: 30,
        }}
      >
        ⚔ {warState.synced ? `#${rank}` : "–"}
      </button>

      {open && (
        <div
          onPointerDown={stop}
          onPointerMove={stop}
          onPointerUp={stop}
          onClick={stop}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(5,4,10,0.7)", display: "grid", placeItems: "center", padding: 16 }}
        >
          <div style={{ ...card, width: "min(520px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ letterSpacing: "0.2em", fontSize: 12 }}>WAR OF THE FOUR REALMS</strong>
              <button type="button" onClick={() => setOpen(false)} style={{ color: "#e9e4d8", fontSize: 18, padding: "0 8px" }}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: "#a79fb8", margin: "4px 0 12px" }}>
              The standings reset in {untilReset()} (every Monday, 00:00 UTC). No realm can ever be destroyed.
            </div>

            {order.map((k, i) => {
              const row = warState.scores[k];
              const role = warRoleOf(k);
              const t = THEMES[k];
              return (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: t.trim }}>
                      #{i + 1} The {t.name}
                      {k === PLAYER_GANG ? " · YOU" : ""}
                    </span>
                    <span>{row.score}</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", margin: "4px 0" }}>
                    <div style={{ width: `${(row.score / max) * 100}%`, height: "100%", background: t.trim }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#a79fb8" }}>
                    <span>{row.player_kills} players · {row.captures} districts · {row.raids} raids</span>
                    {role === "ascendant" && <span style={{ color: "#f3e2b3" }}>✦ ASCENDANT · +10% Echoes</span>}
                    {role === "humbled" && <span style={{ color: "#ff8a96" }}>☠ HUMBLED · −10% Echoes · −15% damage taken</span>}
                  </div>
                </div>
              );
            })}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 10, marginTop: 4, fontSize: 11, lineHeight: 1.6, color: "#cfc8d9" }}>
              <div><strong>How points are earned:</strong> +10 unmake an enemy player · +1 unmake an enemy being · +25 reclaim a district · +15 raid a vault.</div>
              <div><strong>Death tax:</strong> falling costs 10% of your Echoes (50 to 300). The player who unmakes you takes half.</div>
              <div style={{ marginTop: 6, color: "#f3e2b3" }}>Your points this week: {warState.myPoints}</div>
            </div>

            {warState.top.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11 }}>
                <div style={{ letterSpacing: "0.2em", color: "#a79fb8", marginBottom: 4 }}>TOP FIGHTERS THIS WEEK</div>
                {warState.top.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", color: THEMES[p.kingdom]?.trim ?? "#e9e4d8" }}>
                    <span>{i + 1}. {p.username}</span>
                    <span>{p.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}