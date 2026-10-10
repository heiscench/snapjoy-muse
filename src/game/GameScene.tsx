import { Button } from "@/components/ui/button";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import { City } from "./City";
import { Player } from "./Player";
import { NPCs } from "./NPCs";
import { unlockAudio, setMasterVolume } from "./audio";
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
import { AmmoHud } from "./AmmoHud";
import { StatsPanel } from "./StatsPanel";
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
const JOYSTICK_TRAVEL_RATIO = 0.36;
const AUTOSAVE_MS = 12000;
const MUTE_KEY = "forgotten-muted";

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage unavailable (private mode) — mute still works for this session.
  }
}

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
    captureLabel: capturing ? "Reclaiming memory" : robbing ? "Relic raid" : territoryState.captureMessage,
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
  const [muted, setMuted] = useState(readMuted);
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
  const healthTone = healthPct > 50 ? "healthy" : healthPct > 20 ? "wounded" : "critical";

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
    setMasterVolume(readMuted() ? 0 : 1);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      setMasterVolume(next ? 0 : 1);
      writeMuted(next);
      return next;
    });
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
      const radius = (moveRef.current?.getBoundingClientRect().width ?? 128) * JOYSTICK_TRAVEL_RATIO;
      const mag = Math.min(1, Math.hypot(dx, dy) / radius);
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * mag;
      const ky = Math.sin(ang) * mag;
      setMoveKnob({ x: kx * radius, y: ky * radius });
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
      className="game-viewport"
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

      <div className="game-status" data-faction={PLAYER_GANG}>
        <div className="game-status-values"><span className="game-faction">{gang.name}</span><span className="game-echoes">◈ {money} Echoes</span><span className="game-remembered">REMEMBERED {reputation}</span></div>
        <div className="game-health"><div data-tone={healthTone} style={{ width: `${healthPct}%` }} /></div>
        {piloting && <span className="game-vehicle-label">Relic Skiff</span>}
        {carDriving && <span className="game-vehicle-label">Husk</span>}
      </div>
      {captureLabel && <div className="game-capture"><span>{captureLabel}</span>{capturePct > 0 && <div className="game-progress"><div style={{ width: `${capturePct}%` }} /></div>}</div>}
      <div className="game-alerts">{alerts.map(a => <div key={a.id} data-tone={a.tone}>{a.text}</div>)}</div>

      <Minimap />
      <WeaponShop />
      <SquadPrompt />
      <StatsPanel />
      <AmmoHud />

      {error && <Button className="game-error" onClick={() => { pilotState.lastError = null; }}>{error}</Button>}
      {!inVehicleMode && <Crosshair />}
      <div ref={moveRef} className="game-joystick" aria-label="Move">
        <div className="game-joystick-ring" />
        <div className="game-joystick-knob" style={{ transform: `translate(${moveKnob.x}px, ${moveKnob.y}px)` }} />
      </div>
      <div className="game-aim"><Button ref={aimRef} className="game-control" data-active={aiming} aria-label={aimLabel}>{aimLabel}</Button></div>
      <div className="game-actions">
        <Button ref={jumpRef} className="game-control" aria-label={piloting ? "Up" : "Jump"}>{piloting ? "Up" : "Jump"}</Button>
        <Button ref={runRef} className="game-control" data-active={running} aria-label={piloting ? "Down" : "Run"}>{piloting ? "Down" : "Run"}</Button>
        <Button ref={fireRef} className="game-control game-fire" aria-label="Fire">Fire</Button>
      </div>
      <div className="game-portrait-gate"><span className="game-rotate-symbol" aria-hidden="true">↻</span><h2>Rotate your device</h2><p>The world awaits.</p></div>
    </div>
  );
}
