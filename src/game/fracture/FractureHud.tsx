import { useEffect, useState } from "react";
import { carPilot } from "../carState";
import { playerState } from "../playerState";
import { districtLabel } from "../worldData";
import {
  bitCount, fractureLayout, fractureNow, fractureSchedule, fractureState, glyphAvailable, GLYPH_COUNT,
} from "./fractureState";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const chip: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 3,
  background: "rgba(14,11,22,0.82)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#e9e4d8",
  fontSize: 11,
  letterSpacing: "0.12em",
  textAlign: "center",
};

export function FractureHud() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => (v + 1) % 1_000_000), 250);
    return () => clearInterval(id);
  }, []);

  if (!fractureState.synced) return null;
  const now = fractureNow();
  const sc = fractureSchedule(now);
  const inWindow = sc.active && fractureState.slot === sc.slot;
  const live = inWindow && !fractureState.completed && !fractureState.failed;
  const untilNext = sc.nextStartMs - now;
  const omen = !sc.active && untilNext < 120_000;
  const mask = fractureState.mask;
  const lit = bitCount(mask);

  // Arrow towards the nearest glyph you can light now.
  let angle = 0;
  let dist = 0;
  let hasTarget = false;
  if (live) {
    const layout = fractureLayout(sc.slot, sc.district);
    let best = Infinity;
    layout.glyphs.forEach((p, i) => {
      if (!glyphAvailable(i)) return;
      const d = Math.hypot(p.x - playerState.pos.x, p.z - playerState.pos.z);
      if (d < best) {
        best = d;
        dist = d;
        hasTarget = true;
        const vx = p.x - playerState.pos.x;
        const vz = p.z - playerState.pos.z;
        const y = playerState.yaw;
        const fx = carPilot.driving ? Math.sin(y) : -Math.sin(y);
        const fz = carPilot.driving ? Math.cos(y) : -Math.cos(y);
        angle = Math.atan2(vx * -fz + vz * fx, vx * fx + vz * fz);
      }
    });
  }

  const flashLeft = fractureState.flashUntil - performance.now();
  const flash = flashLeft > 0 ? Math.min(1, flashLeft / 1600) : 0;

  return (
    <>
      {flash > 0 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 45,
            pointerEvents: "none",
            display: "grid",
            placeItems: "center",
            opacity: flash,
            background: "radial-gradient(circle at center, rgba(255,241,184,0.55), rgba(134,67,189,0.45) 55%, rgba(11,10,16,0.75))",
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "clamp(60px, 18vw, 140px)",
              letterSpacing: "0.1em",
              color: "#fff6d6",
              textShadow: "0 0 24px rgba(216,172,82,0.9), 0 0 60px rgba(134,67,189,0.9)",
            }}
          >
            11:11
          </div>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          top: "var(--hud-top)",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(420px, 52vw)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        {live && (
          <div style={{ ...chip, borderColor: "#d8ac52", padding: "8px 12px" }}>
            <div style={{ fontWeight: 700, color: "#f3e2b3" }}>
              THE FRACTURE · {districtLabel(sc.district).toUpperCase()}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "7px 0" }}>
              {Array.from({ length: GLYPH_COUNT }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: i === 4 ? 16 : 12,
                    height: i === 4 ? 16 : 12,
                    transform: "rotate(45deg)",
                    background: mask & (1 << i) ? "#f3e2b3" : "transparent",
                    border: `2px solid ${mask & (1 << i) ? "#f3e2b3" : glyphAvailable(i) ? "#ffffff" : "#5a5568"}`,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#cfc8d9" }}>
              {mmss(sc.msLeft)} left · {lit}/{GLYPH_COUNT} lit · {lit < 4 ? "split up and light every glyph" : "all gather at the heart"}
            </div>
          </div>
        )}

        {live && hasTarget && (
          <div style={{ ...chip, borderColor: "#f3e2b3", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#f3e2b3" }}>
            <span style={{ display: "inline-block", fontSize: 22, lineHeight: 1, transform: `rotate(${angle}rad)` }}>▲</span>
            <span style={{ fontWeight: 700 }}>{dist < 12 ? "STAND ON THE GLYPH" : `NEAREST GLYPH ${Math.round(dist)} m`}</span>
          </div>
        )}

        {inWindow && fractureState.completed && (
          <div style={{ ...chip, borderColor: "#f3e2b3", color: "#f3e2b3" }}>
            THE FRACTURE HAS CLOSED · ALL REALMS BLESSED
          </div>
        )}

        {omen && (
          <div style={{ ...chip, borderColor: "#d8ac52", color: "#f3e2b3" }}>
            11:11 · THE CITY FRACTURES IN {mmss(untilNext)} · {districtLabel(sc.nextDistrict).toUpperCase()}
          </div>
        )}
      </div>
    </>
  );
}