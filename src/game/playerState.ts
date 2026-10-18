// Shared player state, read by HUD/minimap without needing React re-renders
// for every physics frame (same pattern as npcState.ts).

export const START_MONEY = 500;
export const DEATH_COST = 100;
export const KILL_BOUNTY = 50;
export const STADIUM_REP_PER_KILL = 1;

export const playerState = {
  health: 100,
  maxHealth: 100,
  pos: { x: 24, z: 24 },
  y: 0, // height above the ground: roofs, the Skiff and the Sky Halls
  yaw: 0,
  money: START_MONEY,
  reputation: 0,
};

/** Set by the monster hunt: a blessed kingdom earns more and takes less damage; a cursed one earns less. */
export const modifiers = { earn: 1, damageTaken: 1 };

export function damagePlayer(amount: number) {
  playerState.health = Math.max(0, playerState.health - amount * modifiers.damageTaken);
}

export function healPlayer(amount: number) {
  playerState.health = Math.min(playerState.maxHealth, playerState.health + amount);
}

export function revivePlayer() {
  playerState.health = playerState.maxHealth;
}

/** `raw` skips the blessing/curse multiplier (used for the monster reward itself). */
export function earnMoney(amount: number, raw = false) {
  const gained = raw ? amount : amount * modifiers.earn;
  playerState.money = Math.max(0, playerState.money + Math.floor(gained));
}

export function spendMoney(amount: number): boolean {
  const cost = Math.floor(amount);
  if (playerState.money < cost) {
    playerState.money = Math.max(0, playerState.money);
    return false;
  }
  playerState.money -= cost;
  return true;
}

/** What a death costs: 10% of your Echoes, at least 50 and at most 300 (never more than you have). */
export function deathTax(): number {
  const tax = Math.max(50, Math.min(300, Math.round(playerState.money * 0.1)));
  return Math.min(tax, Math.floor(playerState.money));
}

export function addReputation(amount: number) {
  playerState.reputation = Math.max(0, playerState.reputation + amount);
}