export const input = {
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  mouseDX: 0,
  mouseDY: 0,
  jump: false,
  run: false,
  aim: false,
  fire: false,
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
  window.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  });
  window.addEventListener("mousedown", (e) => {
    if (e.button === 2) input.aim = true;
    if (e.button === 0 && document.pointerLockElement) input.fire = true;
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) input.aim = false;
    if (e.button === 0) input.fire = false;
  });
  window.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function readKeyboardMove() {
  const k = input.keys;
  const x = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
  const y = (k.has("KeyS") ? 1 : 0) - (k.has("KeyW") ? 1 : 0);
  return { x, y };
}
