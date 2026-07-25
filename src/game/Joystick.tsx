import { useEffect, useRef, useState } from "react";

export type JoystickVec = { x: number; y: number };

export function Joystick({
  side,
  onChange,
  label,
}: {
  side: "left" | "right";
  onChange: (v: JoystickVec) => void;
  label?: string;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<JoystickVec>({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const center = useRef<{ x: number; y: number } | null>(null);
  const R = 55;

  useEffect(() => {
    onChange(knob);
  }, [knob, onChange]);

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = baseRef.current!.getBoundingClientRect();
    center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    active.current = e.pointerId;
    (e.target as Element).setPointerCapture(e.pointerId);
    move(e);
  };
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !center.current) return;
    let dx = e.clientX - center.current.x;
    let dy = e.clientY - center.current.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob({ x: dx / R, y: dy / R });
  };
  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    center.current = null;
    setKnob({ x: 0, y: 0 });
  };

  return (
    <div
      className={`fixed bottom-6 ${side === "left" ? "left-6" : "right-6"} z-20 touch-none select-none`}
    >
      <div
        ref={baseRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="relative h-32 w-32 rounded-full border border-white/20 bg-black/30 backdrop-blur-sm"
      >
        <div
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70"
          style={{ transform: `translate(calc(-50% + ${knob.x * R}px), calc(-50% + ${knob.y * R}px))` }}
        />
        {label && (
          <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/60">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
