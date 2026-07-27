import { useEffect, useState } from "react";
import { NPCS } from "./npcState";
import { PLAYER_GANG } from "./gangs";
import { squadState, toggleFollow, TAP_HIT_PX, TAP_MAX_DRAG_PX, TAP_MAX_MS, isFollowing } from "./squadState";

type Prompt = { npcId: number; x: number; y: number; isHuman: boolean };

export function SquadPrompt() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [humanReq, setHumanReq] = useState<{ fromId: number; toId: number } | null>(null);

  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      const dragged = Math.hypot(dx, dy);
      const dur = performance.now() - start.t;
      start = null;
      if (dragged > TAP_MAX_DRAG_PX || dur > TAP_MAX_MS) return;
      // Find nearest ally screen-hit
      let best: { npc: (typeof NPCS)[number]; d: number } | null = null;
      for (const n of NPCS) {
        if (n.dead || !n.screenVisible || n.gang !== PLAYER_GANG) continue;
        const d = Math.hypot(n.screenX - e.clientX, n.screenY - e.clientY);
        if (d > TAP_HIT_PX) continue;
        if (!best || d < best.d) best = { npc: n, d };
      }
      if (best) {
        setPrompt({ npcId: best.npc.id, x: best.npc.screenX, y: best.npc.screenY - 40, isHuman: best.npc.isHuman });
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    // Poll for pending human requests from the multiplayer stub.
    const id = setInterval(() => {
      if (squadState.pendingHumanRequest) {
        setHumanReq(squadState.pendingHumanRequest);
      }
    }, 250);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      clearInterval(id);
    };
  }, []);

  return (
    <>
      {prompt && (
        <div
          className="fixed z-30"
          style={{ left: prompt.x - 60, top: prompt.y }}
        >
          <div className="flex flex-col gap-1 rounded bg-black/80 p-1 backdrop-blur">
            {prompt.isHuman ? (
              <div className="rounded px-2 py-1 text-[10px] text-white/70">Waiting for reply…</div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollow(prompt.npcId);
                  setPrompt(null);
                }}
                className="rounded bg-green-600/70 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white active:bg-green-500"
              >
                {isFollowing(prompt.npcId) ? "Stop follow" : "Follow me"}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setPrompt(null); }}
              className="rounded bg-white/10 px-3 py-1 text-[10px] uppercase tracking-widest text-white/80"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {humanReq && (
        <div className="fixed left-1/2 top-32 z-40 -translate-x-1/2 rounded bg-black/85 p-3 text-center backdrop-blur">
          <div className="text-xs text-white">Ally requests squad join</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => { squadState.pendingHumanRequest = null; setHumanReq(null); }}
              className="rounded bg-green-600 px-3 py-1 text-[11px] font-bold text-white"
            >Accept</button>
            <button
              onClick={() => { squadState.pendingHumanRequest = null; setHumanReq(null); }}
              className="rounded bg-white/10 px-3 py-1 text-[11px] text-white/80"
            >Ignore</button>
          </div>
        </div>
      )}
    </>
  );
}
