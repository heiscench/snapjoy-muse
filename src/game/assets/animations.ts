/**
 * Character animation system for the FORGOTTEN asset library.
 *
 * Maps logical actions (idle, walk, run, attack...) to the animation files
 * found in public/models/animations, plays them through a three.js
 * AnimationMixer with short cross-fades, and detects skeleton bone-name
 * mismatches (e.g. a "mixamorig" prefix difference) instead of guessing.
 *
 * Animation files load lazily the first time an action is played — never at
 * app start. Browser-only module.
 */
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getModel, type ModelEntry } from "./manifest";

export type CharacterAction =
  | "idle"
  | "walk"
  | "run"
  | "jump_up"
  | "jump_down"
  | "attack_sword"
  | "bow_draw"
  | "bow_release"
  | "crossbow_fire"
  | "cast_spell"
  | "hit"
  | "die"
  | "ride";

export interface ActionBinding {
  action: CharacterAction;
  /** manifest id of the animation file */
  modelId: string;
  /** preferred clip inside the file; falls back to the first clip */
  clipName?: string;
}

/**
 * Action map recorded from what is actually on disk in
 * public/models/animations. Entries marked unverified failed to parse in the
 * offline check (FBXLoader "Unknown property type") and may fail at runtime;
 * the checker page lists them.
 */
export const ACTION_BINDINGS: Partial<Record<CharacterAction, ActionBinding>> = {
  idle: { action: "idle", modelId: "idle", clipName: "mixamo.com" },
  walk: { action: "walk", modelId: "walking", clipName: "mixamo.com" },
  run: { action: "run", modelId: "fast-run", clipName: "mixamo.com" },
  jump_up: { action: "jump_up", modelId: "aap-jumping-up", clipName: "mixamo.com" },
  jump_down: { action: "jump_down", modelId: "jumping-down", clipName: "mixamo.com" },
  attack_sword: { action: "attack_sword", modelId: "stable-sword-inward-slash", clipName: "mixamo.com" },
  bow_draw: { action: "bow_draw", modelId: "standing-draw-arrow", clipName: "mixamo.com" },
};

/** Every logical action the game may ask for — including ones with no file yet. */
export const ALL_ACTIONS: CharacterAction[] = [
  "idle",
  "walk",
  "run",
  "jump_up",
  "jump_down",
  "attack_sword",
  "bow_draw",
  "bow_release",
  "crossbow_fire",
  "cast_spell",
  "hit",
  "die",
  "ride",
];

/** Actions with no animation file on disk yet. */
export const MISSING_ACTIONS: CharacterAction[] = ALL_ACTIONS.filter(
  (action) => !ACTION_BINDINGS[action],
);

/** Extra clips on disk that no action maps to (usable later). */
export const UNMAPPED_ANIMATION_IDS: string[] = [
  "aap-idle-2",
  "aap-idle-3",
  "aap-idle-4",
  "aap-idle-5",
  "aap-idle-6",
  "aap-falling-idle",
  "aap-walking",
  "aap-running",
  "aap-stand-to-cover",
  "aap-stand-to-cover-2",
  "aap-cover-to-stand",
  "aap-cover-to-stand-2",
  "aap-run-to-stop",
  "aap-left-turn",
  "aap-right-turn",
  "aap-falling-to-roll",
  "aap-hard-landing",
  "aap-crouched-sneaking-left",
  "aap-crouched-sneaking-right",
  "aap-left-cover-sneak",
  "aap-right-cover-sneak",
  "gunplay",
];

// ---------------------------------------------------------------------------
// Loading (lazy + cached)
// ---------------------------------------------------------------------------

const clipCache = new Map<string, Promise<THREE.AnimationClip[]>>();
const parsedClips = new Map<string, THREE.AnimationClip[]>();
const modelPromiseCache = new Map<string, Promise<THREE.Object3D>>();

function loadModelObject(entry: ModelEntry): Promise<THREE.Object3D> {
  let promise = modelPromiseCache.get(entry.url);
  if (!promise) {
    if (entry.format === "fbx") {
      const loader = new FBXLoader();
      promise = fetch(entry.url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${entry.url}`);
          return res.arrayBuffer();
        })
        .then((buffer) => loader.parse(buffer, ""));
    } else {
      const loader = new GLTFLoader();
      promise = loader.loadAsync(entry.url).then((gltf) => gltf.scene);
    }
    modelPromiseCache.set(entry.url, promise);
  }
  return promise;
}

/** Loads and caches every clip inside an animation file. */
export function loadClips(modelId: string): Promise<THREE.AnimationClip[]> {
  let promise = clipCache.get(modelId);
  if (!promise) {
    const entry = getModel(modelId);
    if (!entry) return Promise.reject(new Error(`[animations] Unknown model id: ${modelId}`));
    promise = loadModelObject(entry).then((object) => {
      const clips = object.animations ?? [];
      parsedClips.set(modelId, clips);
      return clips;
    });
    clipCache.set(modelId, promise);
  }
  return promise;
}

// ---------------------------------------------------------------------------
// Skeleton name handling
// ---------------------------------------------------------------------------

/** Common Mixamo prefix three.js keeps on bone and track names. */
const MIXAMO_PREFIX = "mixamorig";

function stripPrefix(name: string): string {
  return name.startsWith(MIXAMO_PREFIX) ? name.slice(MIXAMO_PREFIX.length) : name;
}

function collectBoneNames(root: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) names.add(obj.name);
  });
  return names;
}

/** Matches track names to bone names ignoring a shared "mixamorig" prefix. */
function tracksMatchSkeleton(clip: THREE.AnimationClip, boneNames: Set<string>): boolean {
  const trackBones = new Set<string>();
  for (const track of clip.tracks) {
    trackBones.add(stripPrefix(track.name.split(".")[0]));
  }
  if (trackBones.size === 0) return true;
  for (const bone of trackBones) {
    if (!boneNames.has(bone)) return false;
  }
  return true;
}

/**
 * If the clip uses a different but consistent prefix from the character's
 * bones (a simple prefix difference only), rebuild the tracks with the
 * character's naming. Returns null when the difference is not a simple
 * prefix swap.
 */
function remapPrefix(clip: THREE.AnimationClip, boneNames: Set<string>): THREE.AnimationClip | null {
  const prefixes = new Set<string>();
  for (const track of clip.tracks) {
    const bone = track.name.split(".")[0];
    prefixes.add(bone.startsWith(MIXAMO_PREFIX) ? MIXAMO_PREFIX : "");
  }
  if (prefixes.size !== 1) return null;
  const from = prefixes.values().next().value as string;
  const to = boneNames.has(MIXAMO_PREFIX + "Hips") ? MIXAMO_PREFIX : "";
  if (from === to) return null;
  const clone = clip.clone();
  for (const track of clone.tracks) {
    const dot = track.name.indexOf(".");
    const bone = dot === -1 ? track.name : track.name.slice(0, dot);
    const rest = dot === -1 ? "" : track.name.slice(dot);
    if (!bone.startsWith(from)) continue;
    track.name = to + bone.slice(from.length) + rest;
  }
  return clone;
}

// ---------------------------------------------------------------------------
// Mismatch reporting (surfaced on /assets?dev=1)
// ---------------------------------------------------------------------------

export interface AnimationMismatch {
  characterId: string;
  animationId: string;
  action: CharacterAction;
  reason: string;
}

const mismatches: AnimationMismatch[] = [];
const mismatchListeners = new Set<() => void>();

function reportMismatch(entry: AnimationMismatch): void {
  mismatches.push(entry);
  console.warn(
    `[animations] ${entry.characterId}: ${entry.animationId} (${entry.action}) — ${entry.reason}`,
  );
  for (const listener of mismatchListeners) listener();
}

/** Mismatches found so far in this session (used by the /assets checker page). */
export function collectAnimationMismatches(): AnimationMismatch[] {
  return [...mismatches];
}

export function subscribeAnimationMismatches(listener: () => void): () => void {
  mismatchListeners.add(listener);
  return () => mismatchListeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Animator hook
// ---------------------------------------------------------------------------

export interface CharacterAnimator {
  play: (action: CharacterAction, opts?: { loop?: boolean; fadeSeconds?: number }) => void;
  stopAll: () => void;
  /** Updated after each play: null when ready, a string while loading/erroring. */
  status: () => string | null;
  onStatusChange: (listener: () => void) => () => void;
}

const DEFAULT_FADE = 0.25;

/**
 * Creates an AnimationMixer for a character model and plays logical actions
 * with short cross-fades. Animation files load the first time each action is
 * played. Call play("idle") once after mount to start the loop.
 */
export function createCharacterAnimator(
  model: THREE.Object3D,
  modelId: string,
): CharacterAnimator {
  const mixer = new THREE.AnimationMixer(model);
  const boneNames = collectBoneNames(model);
  const actions = new Map<CharacterAction, THREE.AnimationAction>();
  let current: THREE.AnimationAction | null = null;
  let status: string | null = null;
  const statusListeners = new Set<() => void>();

  function setStatus(next: string | null): void {
    status = next;
    for (const listener of statusListeners) listener();
  }

  async function ensureAction(binding: ActionBinding): Promise<THREE.AnimationAction> {
    const cached = actions.get(binding.action);
    if (cached) return cached;
    const clips = await loadClips(binding.modelId);
    if (clips.length === 0) {
      throw new Error(`no animation clips inside ${binding.modelId}`);
    }
    let clip =
      (binding.clipName ? clips.find((c) => c.name === binding.clipName) : undefined) ?? clips[0];

    if (!tracksMatchSkeleton(clip, boneNames)) {
      const remapped = remapPrefix(clip, boneNames);
      if (remapped) {
        clip = remapped;
      } else {
        reportMismatch({
          characterId: modelId,
          animationId: binding.modelId,
          action: binding.action,
          reason: "bone names do not match the character skeleton and the difference is not a simple mixamorig prefix swap",
        });
        throw new Error(`skeleton mismatch: ${binding.modelId} -> ${modelId}`);
      }
    }

    const action = mixer.clipAction(clip);
    action.reset();
    actions.set(binding.action, action);
    return action;
  }

  return {
    play(action, opts = {}) {
      const binding = ACTION_BINDINGS[action];
      if (!binding) {
        setStatus(`no animation file mapped for action "${action}"`);
        return;
      }
      setStatus("loading");
      ensureAction(binding)
        .then((next) => {
          next.setLoop(opts.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
          next.clampWhenFinished = opts.loop === false;
          next.reset().fadeIn(opts.fadeSeconds ?? DEFAULT_FADE).play();
          if (current && current !== next) {
            current.fadeOut(opts.fadeSeconds ?? DEFAULT_FADE);
          }
          current = next;
          setStatus(null);
        })
        .catch((err) => {
          reportMismatch({
            characterId: modelId,
            animationId: binding.modelId,
            action,
            reason: `failed to load: ${err instanceof Error ? err.message : String(err)}`,
          });
          setStatus(`failed: ${err instanceof Error ? err.message : String(err)}`);
        });
    },
    stopAll() {
      mixer.stopAllAction();
      current = null;
    },
    status: () => status,
    onStatusChange(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
  };
}

/** Call once per frame with the delta time (from useFrame). */
export function updateAnimator(animator: CharacterAnimator, mixer: THREE.AnimationMixer, delta: number): void {
  void animator;
  mixer.update(delta);
}

export type { ModelEntry };
