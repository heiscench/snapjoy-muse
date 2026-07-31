import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import { City } from "./City";
import { Player } from "./Player";
import { NPCs } from "./NPCs";
import { unlockAudio } from "./audio";
import { Guards } from "./Guards";
import { Civilians } from "./Civilians";
import { RemotePlayers } from "./RemotePlayers";
import { Vehicles } from "./Vehicles";
import { Helicopters } from "./Helicopter";
import { WeaponShopKiosks } from "./WeaponShopKiosk";
import { Grenades } from "./Grenades";
import { Crosshair } from "./Crosshair";
import { Tracers } from "./Tracers";
import { DayNight } from "./DayNight";
import { WeaponShop } from "./WeaponShop";
import { SquadPrompt } from "./SquadPrompt";
import { GANGS, PLAYER_GANG } from "./gangs";
import { input } from "./input";
import { playerState } from "./playerState";
import { pilotState } from "./vehicleState";
import { carPilot } from "./carState";
import { Minimap } from "./Minimap";
import { alertState, tickAlerts, type Alert } from "./alertState";
import { territoryState, CAPTURE_TIME, ROBBERY_TIME } from "./territoryState";
import { registerVehicleDestroyHook } from "./vehicleState";
import { broadcastVehicleDestroyed, startPresence, stopPresence } from "./presence";
import { startWorldSync, stopWorldSync } from "./worldSync";
import { syncProfileToServer, syncProfileToServerBeacon } from "./profileSync";

const TOUCH_LOOK_SENSITIVITY = 0.22;
const MAX_DRAG_STEP = 50;
const JOYSTICK_RADIUS = 55;
const AUTOSAVE_MS = 12000;

type Zone = "move" | "look" | "aim" | "jump" | "run" | "fire" | null;

function hitTest(el: HTMLElement | null, x: number, y: number) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

type HudState = {
  health: number;
  money: number;
  reputation: number;
  piloting: boolean;
  nearHeli: boolean;
  carDriving: boolean;
  nearCar: boolean;
  error: string | null;
  captureLabel: string | null;
  capturePct: number;
  alerts: Alert[];
};

function snapshot(): HudState {
  const capturing = territoryState.captureDistrict !== null;
  const robbing = territoryState.robberyBankId !== null;
  return {
    health: playerState.health,
    money: Math.floor(playerState.money),
    reputation: Math.floor(playerState.reputation),
    piloting: pilotState.piloting,
    nearHeli: pilotState.nearHeliIndex >= 0,
    carDriving: carPilot.driving,
    nearCar: carPilot.nearIndex >= 0,
    error: pilotState.lastError,
    captureLabel: capturing ? "Capturing district" : robbing ? "Robbing vault" : territoryState.captureMessage,
    capturePct: capturing
      ? (territoryState.captureProgress / CAPTURE_TIME) * 100
      : robbing
      ? (territoryState.robberyProgress / ROBBERY_TIME) * 100
      : 0,
    alerts: alertState.alerts,
  };
}

function useHud(): HudState {
  const [state, setState] = useState<HudState>(snapshot);
  const last = useRef(state);
  useEffect(() => {
    let raf: number;
    let prev = performance.now();
    const tick = () => {
      const now = performance.now();
      tickAlerts(Math.min(0.05, (now - prev) / 1000));
      prev = now;
      const next = snapshot();
      const l = last.current;
      if (
        next.health !== l.health ||
        next.money !== l.money ||
        next.reputation !== l.reputation ||
        next.piloting !== l.piloting ||
        next.nearHeli !== l.nearHeli ||
        next.carDriving !== l.carDriving ||
        next.nearCar !== l.nearCar ||
        next.error !== l.error ||
        next.captureLabel !== l.captureLabel ||
        Math.abs(next.capturePct - l.capturePct) > 0.5 ||
        next.alerts.length !== l.alerts.length
      ) {
        last.current = next;
        setState(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return state;
}

/** Boots the multiplayer channel, shared world state, and profile autosave. */
function useMultiplayerSession() {
  useEffect(() => {
    startPresence();
    void startWorldSync();
    registerVehicleDestroyHook((kind, id) => broadcastVehicleDestroyed(kind, id));

    const save = setInterval(() => { void syncProfileToServer(); }, AUTOSAVE_MS);
    const onHide = () => syncProfileToServerBeacon();
    window.addEventListener("pagehide", onHide);

    return () => {
      clearInterval(save);
      window.removeEventListener("pagehide", onHide);
      registerVehicleDestroyHook(() => {});
      stopPresence();
      stopWorldSync();
      syncProfileToServerBeacon();
    };
  }, []);
}

export function GameScene() {
  const [running, setRunning] = useState(false);
  const [aiming, setAiming] = useState(false);
  const [moveKnob, setMoveKnob] = useState({ x: 0, y: 0 });
  const gang = GANGS[PLAYER_GANG];
  const {
    health, money, reputation, piloting, nearHeli, carDriving, nearCar, error,
    captureLabel, capturePct, alerts,
  } = useHud();
  useMultiplayerSession();
  const inVehicleMode = piloting || nearHeli || carDriving || nearCar;
  const healthPct = Math.max(0, Math.min(100, (health / playerState.maxHealth) * 100));
  const healthColor = healthPct > 50 ? "#5cff8a" : healthPct > 20 ? "#ffd66a" : "#ff5a5a";

  const moveRef = useRef<HTMLDivElement>(null);
  const aimRef = useRef<HTMLButtonElement>(null);
  const jumpRef = useRef<HTMLButtonElement>(null);
  const runRef = useRef<HTMLButtonElement>(null);
  const fireRef = useRef<HTMLButtonElement>(null);

  const touches = useRef(
    new Map<number, { zone: Zone; startX: number; startY: number; lastX: number; lastY: number }>(),
  );

  useEffect(() => {
    unlockAudio();
  }, []);

  const zoneOf = useCallback((x: number, y: number): Zone => {
    if (hitTest(moveRef.current, x, y)) return "move";
    if (hitTest(aimRef.current, x, y)) return "aim";
    if (hitTest(jumpRef.current, x, y)) return "jump";
    if (hitTest(runRef.current, x, y)) return "run";
    if (hitTest(fireRef.current, x, y)) return "fire";
    return "look";
  }, []);

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      const zone = zoneOf(e.clientX, e.clientY);
      touches.current.set(e.pointerId, {
        zone,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
      });
      if (zone === "aim") {
        if (pilotState.piloting || pilotState.nearHeliIndex >= 0 || carPilot.driving || carPilot.nearIndex >= 0) {
          pilotState.interactPressed = true;
        } else {
          input.aim = true;
          setAiming(true);
        }
      } else if (zone === "jump") {
        input.jump = true;
      } else if (zone === "run") {
        input.run = !input.run;
        setRunning(input.run);
      } else if (zone === "fire") {
  input.fire = true;
   } else if (zone === "move") {
        setMoveKnob({ x: 0, y: 0 });
      }
    },
    [zoneOf],
  );

  const onMove = useCallback((e: React.PointerEvent) => {
    const t = touches.current.get(e.pointerId);
    if (!t) return;
    if (t.zone === "look") {
      let dx = e.clientX - t.lastX;
      let dy = e.clientY - t.lastY;
      t.lastX = e.clientX;
      t.lastY = e.clientY;
      dx = Math.max(-MAX_DRAG_STEP, Math.min(MAX_DRAG_STEP, dx));
      dy = Math.max(-MAX_DRAG_STEP, Math.min(MAX_DRAG_STEP, dy));
      input.mouseDX += dx * TOUCH_LOOK_SENSITIVITY;
      input.mouseDY += dy * TOUCH_LOOK_SENSITIVITY;
    } else if (t.zone === "move") {
      const dx = e.clientX - t.startX;
      const dy = e.clientY - t.startY;
      const mag = Math.min(1, Math.hypot(dx, dy) / JOYSTICK_RADIUS);
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * mag;
      const ky = Math.sin(ang) * mag;
      setMoveKnob({ x: kx * JOYSTICK_RADIUS, y: ky * JOYSTICK_RADIUS });
      input.move.x = kx;
      input.move.y = ky;
    }
  }, []);

  const onUp = useCallback((e: React.PointerEvent) => {
    const t = touches.current.get(e.pointerId);
    if (!t) return;
    touches.current.delete(e.pointerId);
    if (t.zone === "aim") {
      if (!pilotState.piloting && pilotState.nearHeliIndex < 0 && !carPilot.driving && carPilot.nearIndex < 0) {
        input.aim = false;
        setAiming(false);
      }
    } else if (t.zone === "fire") {
      input.fire = false;
    } else if (t.zone === "jump") {
      input.jump = false;
    } else if (t.zone === "move") {
      input.move.x = 0;
      input.move.y = 0;
      setMoveKnob({ x: 0, y: 0 });
    }
  }, []);

  const requestLock = () => {
    if ("ontouchstart" in window) return;
    const el = document.querySelector("canvas");
    if (el && !document.pointerLockElement) (el as HTMLCanvasElement).requestPointerLock?.();
  };

  const inVehicleNow = piloting || carDriving;
  const aimLabel = inVehicleNow ? "EXIT" : nearHeli || nearCar ? "ENTER" : "AIM";

  return (
    <div
      className="fixed inset-0 bg-black"
      style={{ touchAction: "none" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={requestLock}
    >
      <Canvas
        dpr={[1, 1.25]}
        camera={{ fov: 66, position: [0, 5, 10], near: 0.1, far: 400 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <fog attach="fog" args={["#05060a", 60, 260]} />
        <DayNight />
        <Stars radius={220} depth={30} count={220} factor={3} fade speed={0.2} />
        <City />
        <Vehicles />
        <Helicopters />
        <WeaponShopKiosks />
        <NPCs />
        <Grenades />
        <Guards />
        <Civilians />
        <RemotePlayers />
        <Player />
        <Tracers />
      </Canvas>

      <div className="pointer-events-none fixed left-4 top-4 z-20 flex flex-col gap-2">
        <div className="flex gap-2">
          <div
            className="rounded border px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur"
            style={{ backgroundColor: `${gang.color}cc`, borderColor: gang.accent }}
          >
            {gang.name}
          </div>
          <div className="rounded bg-black/50 px-3 py-1 text-xs font-bold text-green-300 backdrop-blur">
            ${money}
          </div>
          <div className="rounded bg-black/50 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur">
            REP {reputation}
          </div>
        </div>
        <div className="w-32 rounded-full bg-black/50 p-1 backdrop-blur">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${healthPct}%`, backgroundColor: healthColor }} />
          </div>
        </div>
        {piloting && (
          <div className="rounded bg-black/60 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300 backdrop-blur">
            Piloting — Jump: climb · Run: descend
          </div>
        )}
        {carDriving && (
          <div className="rounded bg-black/60 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300 backdrop-blur">
            Driving — Move stick: steer + throttle
          </div>
        )}
      </div>

      {captureLabel && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-20 w-56 -translate-x-1/2 rounded bg-black/70 p-2 text-center backdrop-blur">
          <div className="text-[10px] uppercase tracking-widest text-white/80">{captureLabel}</div>
          {capturePct > 0 && (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${capturePct}%` }} />
            </div>
          )}
        </div>
      )}

      {/* District entry / capture / attack toasts — top-center, above and
          clear of the minimap so they're never hidden behind it. */}
      <div className="pointer-events-none fixed left-1/2 top-4 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`rounded px-3 py-1 text-[11px] backdrop-blur ${
              a.tone === "warn" ? "bg-red-900/80 text-white" : "bg-black/70 text-cyan-200"
            }`}
          >
            {a.text}
          </div>
        ))}
      </div>

      <Minimap />
      <WeaponShop />
      <SquadPrompt />

      {error && (
        <button
          onClick={() => { pilotState.lastError = null; }}
          className="fixed left-1/2 top-24 z-30 max-w-[80vw] -translate-x-1/2 rounded bg-red-900/90 px-3 py-2 text-xs text-white shadow-lg"
        >
          Vehicle error (tap to dismiss): {error}
        </button>
      )}

      {!inVehicleMode && <Crosshair />}

      <div ref={moveRef} className="fixed bottom-6 left-6 z-20 h-32 w-32 select-none">
        <div className="absolute inset-0 rounded-full border border-white/25 bg-white/5" />
        <div
          className="absolute h-14 w-14 rounded-full bg-white/70"
          style={{ left: `calc(50% + ${moveKnob.x}px - 28px)`, top: `calc(50% + ${moveKnob.y}px - 28px)` }}
        />
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/50">
          Move
        </span>
      </div>

      <div className="fixed bottom-40 left-8 z-20 flex flex-col gap-3">
        <button
          ref={aimRef}
          className={`h-14 w-14 rounded-full border text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur ${
            aimLabel === "EXIT"
              ? "border-red-300 bg-red-500/40"
              : aimLabel === "ENTER"
              ? "border-green-300 bg-green-500/40"
              : aiming
              ? "border-cyan-300 bg-cyan-500/40"
              : "border-white/20 bg-black/40"
          }`}
        >
          {aimLabel}
        </button>
      </div>

      <div className="fixed bottom-40 right-8 z-20 flex flex-col gap-3">
        <button
          ref={jumpRef}
          className="h-14 w-14 rounded-full border border-white/20 bg-black/40 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur active:bg-white/20"
        >
          {piloting ? "Up" : "Jump"}
        </button>
        <button
          ref={runRef}
          className={`h-14 w-14 rounded-full border text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur ${
            running ? "border-yellow-300 bg-yellow-500/40" : "border-white/20 bg-black/40"
          }`}
        >
          {piloting ? "Down" : "Run"}
        </button>
        <button
  ref={fireRef}
  className="h-14 w-14 rounded-full border border-red-400/60 bg-red-600/40 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur active:bg-red-500/60"
>
  Fire
</button>
      </div>

      <div className="pointer-events-none fixed right-4 top-4 z-20 rounded bg-black/50 px-3 py-1 text-[10px] text-white/60 backdrop-blur">
        Drag anywhere to look
      </div>
    </div>
  );
}