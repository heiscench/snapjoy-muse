// Lightweight HUD toast queue shared by the territory system and the
// multiplayer channel. Mutated imperatively; the HUD polls it (same pattern
// as the rest of the game state objects).

export const ALERT_DURATION = 4.5; // seconds a toast stays on screen
export const ALERT_MAX = 3;

export type Alert = { id: number; text: string; tone: "info" | "warn"; t: number };

let nextId = 1;

export const alertState = {
  alerts: [] as Alert[],
};

export function pushAlert(
  text: string,
  tone: "info" | "warn" = "info",
  duration = ALERT_DURATION,
) {
  alertState.alerts.push({ id: nextId++, text, tone, t: duration });
  while (alertState.alerts.length > ALERT_MAX) alertState.alerts.shift();
}

export function tickAlerts(dt: number) {
  if (alertState.alerts.length === 0) return;
  for (const a of alertState.alerts) a.t -= dt;
  alertState.alerts = alertState.alerts.filter((a) => a.t > 0);
}
