// Shared player state, read by HUD/minimap without needing React re-renders
// for every physics frame (same pattern as npcState.ts).
export const playerState = {
  health: 100,
  maxHealth: 100,
  pos: { x: 24, z: 24 },
  yaw: 0,
};

export function damagePlayer(amount: number) {
  playerState.health = Math.max(0, playerState.health - amount);
}

export function healPlayer(amount: number) {
  playerState.health = Math.min(playerState.maxHealth, playerState.health + amount);
}

export function revivePlayer() {
  playerState.health = playerState.maxHealth;
}