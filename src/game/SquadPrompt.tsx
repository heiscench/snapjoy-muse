import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { NPCS } from "./npcState";
import { PLAYER_GANG } from "./gangs";
import { remotePlayers } from "./remotePlayerState";
import {
  squadState,
  toggleFollow,
  TAP_HIT_PX,
  TAP_MAX_DRAG_PX,
  TAP_MAX_MS,
  isFollowing,
  expireSquadRequests,
} from "./squadState";
import { broadcastSquadRequest, broadcastSquadResponse } from "./presence";

const POLL_MS = 250;

type Prompt =
  | { kind: "npc"; npcId: number; x: number; y: number }
  | { kind: "human"; userId: string; username: string; x: number; y: number };

export function SquadPrompt() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [humanReq, setHumanReq] = useState(squadState.pendingHumanRequest);
  const [outgoing, setOutgoing] = useState(squadState.outgoingRequest);

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

      let best: { p: Prompt; d: number } | null = null;

      // Real players take priority over bots when both are under the tap.
      for (const rp of remotePlayers.values()) {
        if (!rp.screenVisible || rp.gang !== PLAYER_GANG || rp.health <= 0) continue;
        const d = Math.hypot(rp.screenX - e.clientX, rp.screenY - e.clientY);
        if (d > TAP_HIT_PX) continue;
        if (!best || d < best.d) {
          best = {
            d: d - 1,
            p: { kind: "human", userId: rp.userId, username: rp.username, x: rp.screenX, y: rp.screenY - 40 },
          };
        }
      }
      for (const n of NPCS) {
        if (n.dead || !n.screenVisible || n.gang !== PLAYER_GANG) continue;
        const d = Math.hypot(n.screenX - e.clientX, n.screenY - e.clientY);
        if (d > TAP_HIT_PX) continue;
        if (!best || d < best.d) {
          best = { d, p: { kind: "npc", npcId: n.id, x: n.screenX, y: n.screenY - 40 } };
        }
      }
      if (best) setPrompt(best.p);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    const id = setInterval(() => {
      expireSquadRequests(Date.now());
      setHumanReq(squadState.pendingHumanRequest);
      setOutgoing(squadState.outgoingRequest);
    }, POLL_MS);

    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      clearInterval(id);
    };
  }, []);

  const sendRequest = (userId: string, username: string) => {
    if (squadState.humanFollowers.has(userId)) {
      squadState.humanFollowers.delete(userId);
    } else {
      squadState.outgoingRequest = { toUserId: userId, toUsername: username, at: Date.now() };
      broadcastSquadRequest(userId);
    }
    setPrompt(null);
  };

  const answer = (accepted: boolean) => {
    const req = squadState.pendingHumanRequest;
    if (!req) return;
    broadcastSquadResponse(req.fromUserId, accepted);
    squadState.followingUserId = accepted ? req.fromUserId : null;
    squadState.pendingHumanRequest = null;
    setHumanReq(null);
  };

  return (
    <>
      {prompt && (
        <div className="fixed z-30" style={{ left: prompt.x - 60, top: prompt.y }}>
          <div className="flex flex-col gap-1 rounded bg-background/90 p-1 backdrop-blur">
            {prompt.kind === "human" ? (
              <Button
                onClick={(e) => { e.stopPropagation(); sendRequest(prompt.userId, prompt.username); }}
                className="rounded bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground active:bg-secondary"
              >
                {squadState.humanFollowers.has(prompt.userId)
                  ? `Remove ${prompt.username}`
                  : `Invite ${prompt.username}`}
              </Button>
            ) : (
              <Button
                onClick={(e) => { e.stopPropagation(); toggleFollow(prompt.npcId); setPrompt(null); }}
                className="rounded bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground active:bg-secondary"
              >
                {isFollowing(prompt.npcId) ? "Part ways" : "Walk with me"}
              </Button>
            )}
            <Button
              onClick={(e) => { e.stopPropagation(); setPrompt(null); }}
              className="rounded bg-muted px-3 py-1 text-[10px] uppercase tracking-widest text-foreground"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {outgoing && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-30 -translate-x-1/2 rounded bg-background/90 px-3 py-1 text-[11px] text-foreground backdrop-blur">
          Waiting for {outgoing.toUsername}…
        </div>
      )}

      {humanReq && (
        <div className="fixed left-1/2 top-32 z-40 -translate-x-1/2 rounded bg-background/90 p-3 text-center backdrop-blur">
          <div className="text-xs text-foreground">
            {humanReq.fromUsername} calls you to their circle
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              onClick={() => answer(true)}
              className="rounded bg-secondary px-3 py-1 text-[11px] font-bold text-foreground"
            >Accept</Button>
            <Button
              onClick={() => answer(false)}
              className="rounded bg-muted px-3 py-1 text-[11px] text-foreground"
            >Decline</Button>
          </div>
        </div>
      )}
    </>
  );
}
