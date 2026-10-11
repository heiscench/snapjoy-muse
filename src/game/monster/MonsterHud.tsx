import { useEffect, useState } from "react";
import { PLAYER_GANG } from "../gangs";
import { THEMES } from "../city/palette";
import { carPilot } from "../carState";
import { playerState } from "../playerState";
import { MONSTER_NAME, monsterPose, monsterState, schedule, serverNow } from "./monsterState";

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

export function MonsterHud() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => (v + 1) % 1_000_000), 250);
    return () => clearInterval(id);
  }, []);

  if (!monsterState.synced) return null;
  const now = serverNow();
  const sc = schedule(now);
  const live = sc.active && monsterState.slot === sc.slot;
  const theme = THEMES[sc.kingdom];
  const pct = Math.max(0, Math.min(100, (monsterState.hp / monsterState.maxHp) * 100));
  const untilNext = sc.nextStartMs - now;
  const omen = !live && untilNext < 120_000;
  const next = THEMES[sc.nextKingdom];

  const bless = monsterState.blessUntil[PLAYER_GANG] - now;
  const curse = monsterState.curseUntil[PLAYER_GANG] - now;
  const slain = monsterState.power[PLAYER_GANG];

  // Arrow towards the Wraith, relative to the way you are facing (cars use the opposite yaw convention).
  let angle = 0;
  let dist = 0;
  if (live && !monsterState.defeated) {
    const p = monsterPose(now);
    const vx = p.x - playerState.pos.x;
    const vz = p.z - playerState.pos.z;
    dist = Math.hypot(vx, vz);
    const y = playerState.yaw;
    const fx = carPilot.driving ? Math.sin(y) : -Math.sin(y);
    const fz = carPilot.driving ? Math.cos(y) : -Math.cos(y);
    const rx = -fz;
    const rz = fx;
    angle = Math.atan2(vx * rx + vz * rz, vx * fx + vz * fz);
  }

  return (
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
        <div style={{ ...chip, borderColor: theme.trim, padding: "8px 12px" }}>
          <div style={{ fontWeight: 700, color: "#ffd9d9" }}>
            {MONSTER_NAME.toUpperCase()} · REALM OF THE {theme.name.toUpperCase()}
          </div>
          <div style={{ height: 10, margin: "6px 0", background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: monsterState.defeated ? theme.trim : "#ff4d5e", transition: "width 0.2s" }} />
          </div>
          <div style={{ fontSize: 10, color: "#cfc8d9" }}>
            {monsterState.defeated
              ? "DEFEATED"
              : monsterState.myDamage > 0
              ? `${mmss(sc.msLeft)} left · your damage ${Math.floor(monsterState.myDamage)}`
              : `${mmss(sc.msLeft)} left · shoot it to join the fight`}
          </div>
        </div>
      )}

      {live && !monsterState.defeated && (
        <div style={{ ...chip, borderColor: "#ff4d5e", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#ffd9d9" }}>
          <span style={{ display: "inline-block", fontSize: 22, lineHeight: 1, color: "#ff4d5e", transform: `rotate(${angle}rad)` }}>▲</span>
          <span style={{ fontWeight: 700 }}>
            {dist < 50 ? "IT IS RIGHT HERE" : `WRAITH ${Math.round(dist)} m`}
          </span>
        </div>
      )}

      {omen && (
        <div style={{ ...chip, borderColor: next.trim, color: "#ffd9d9" }}>
          OMEN: {MONSTER_NAME} will strike the realm of the {next.name} in {mmss(untilNext)}
        </div>
      )}

      {bless > 0 && (
        <div style={{ ...chip, borderColor: "#f3e2b3", color: "#f3e2b3" }}>
          ✦ BLESSED {mmss(bless)} · +25% ECHOES · −15% DAMAGE TAKEN{slain > 0 ? ` · ${slain} SLAIN` : ""}
        </div>
      )}
      {bless <= 0 && curse > 0 && (
        <div style={{ ...chip, borderColor: "#ff4d5e", color: "#ffb3bb" }}>
          ☠ CURSED {mmss(curse)} · −20% ECHOES
        </div>
      )}
    </div>
  );
}