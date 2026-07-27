// Squad follow system. NPCs on the player's gang can be told to follow.
// Kept ally-only for now; a human-player accept/decline field is stubbed so a
// future multiplayer layer can hook in without rewriting the system.

export type FollowerId = number; // npc.id

export const FOLLOW_RADIUS = 4.5;      // desired distance to player when following
export const FOLLOW_MAX_SPEED = 5.5;
export const TAP_MAX_MS = 250;
export const TAP_MAX_DRAG_PX = 6;
export const TAP_HIT_PX = 45;

export const squadState = {
  followers: new Set<FollowerId>(),
  // Prompt shown to the DOM layer after a valid tap on an ally.
  activePrompt: null as null | { npcId: FollowerId; x: number; y: number; isHuman: boolean },
  // Pending accept dialog if the tapped ally is another human player.
  pendingHumanRequest: null as null | { fromId: FollowerId; toId: FollowerId },
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
}
