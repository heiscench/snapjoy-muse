export const input = {
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  jump: false,
  run: false,
  keys: new Set<string>(),
};

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    input.keys.add(e.code);
    if (e.code === "Space") input.jump = true;
    if (e.code === "ShiftLeft") input.run = true;
  });
  window.addEventListener("keyup", (e) => {
    input.keys.delete(e.code);
    if (e.code === "ShiftLeft") input.run = false;
  });
}

export function readKeyboardMove() {
  const k = input.keys;
  const x = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
  const y = (k.has("KeyS") ? 1 : 0) - (k.has("KeyW") ? 1 : 0);
  return { x, y };
}
