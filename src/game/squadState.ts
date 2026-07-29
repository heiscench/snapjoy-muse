// Squad follow system. NPC allies can be told to follow; real logged-in
// players can be sent an actual follow request over the multiplayer channel.

export type FollowerId = number; // npc.id

export const FOLLOW_RADIUS = 4.5;      // desired distance to player when following
export const FOLLOW_MAX_SPEED = 5.5;
export const TAP_MAX_MS = 250;
export const TAP_MAX_DRAG_PX = 6;
export const TAP_HIT_PX = 45;
export const SQUAD_REQUEST_TIMEOUT_MS = 20000;

export const squadState = {
  followers: new Set<FollowerId>(),
  // Prompt shown to the DOM layer after a valid tap on an ally.
  activePrompt: null as null | { npcId: FollowerId; x: number; y: number; isHuman: boolean },

  // ---- Real human players -------------------------------------------------
  /** Remote user ids that accepted OUR follow request (they are in our squad). */
  humanFollowers: new Set<string>(),
  /** Remote user id WE agreed to follow, if any. */
  followingUserId: null as string | null,
  /** Incoming request awaiting our accept/decline. */
  pendingHumanRequest: null as null | { fromUserId: string; fromUsername: string; at: number },
  /** Outgoing request we are waiting on. */
  outgoingRequest: null as null | { toUserId: string; toUsername: string; at: number },
};

export function toggleFollow(npcId: FollowerId) {
  if (squadState.followers.has(npcId)) squadState.followers.delete(npcId);
  else squadState.followers.add(npcId);
}

export function isFollowing(npcId: FollowerId): boolean {
  return squadState.followers.has(npcId);
}

export function clearFollowers() {
  squadState.followers.clear();
  squadState.humanFollowers.clear();
  squadState.followingUserId = null;
}

export function expireSquadRequests(nowMs: number) {
  const o = squadState.outgoingRequest;
  if (o && nowMs - o.at > SQUAD_REQUEST_TIMEOUT_MS) squadState.outgoingRequest = null;
  const p = squadState.pendingHumanRequest;
  if (p && nowMs - p.at > SQUAD_REQUEST_TIMEOUT_MS) squadState.pendingHumanRequest = null;
}
