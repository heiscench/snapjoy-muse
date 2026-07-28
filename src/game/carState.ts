export type CarLive = { x: number; z: number; rotY: number; speed: number };
export const CAR_LIVE: CarLive[] = [];

export function initCarLive(cars: { x: number; z: number; rotY: number }[]) {
  CAR_LIVE.length = 0;
  for (const c of cars) CAR_LIVE.push({ x: c.x, z: c.z, rotY: c.rotY, speed: 0 });
}

export const carPilot = {
  driving: false,
  drivingIndex: -1,
  nearIndex: -1,
};

export const CAR_ENTER_RADIUS = 4.5;
export const CAR_EXIT_OFFSET = 3.2;
export const CAR_TOP_SPEED = 20;
export const CAR_COLLIDE_RADIUS = 1.4;