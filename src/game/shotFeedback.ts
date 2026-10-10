export type HitKind = "body" | "head" | "kill";

export const shotFeedback = {
  shotAt: 0,
  hitAt: 0,
  hitKind: "body" as HitKind,
};

export function markShot() {
  shotFeedback.shotAt++;
}

export function markHit(kind: HitKind) {
  shotFeedback.hitAt = performance.now();
  shotFeedback.hitKind = kind;
}