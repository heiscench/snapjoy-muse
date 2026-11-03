# Roadmap

## Current task: model library (assets only — no gameplay wiring)
- [x] Unpack + stage Kenney retro-fantasy & castle kits into public/models (lowercase-dash names)
- [x] Convert horse/carriage/katana OBJ -> GLB, embed textures
- [ ] NEW uploads round 2: staff zip, MPX.glb, Mixamo FBX animations (Walking, Fast_Run, Idle, Stable_Sword_Inward_Slash, Standing_Draw_Arrow, Gunplay, Jumping_Down), Action_Adventure_Pack.zip -> inspect, rename, convert, place in folders
- [ ] src/game/assets/manifest.ts (typed inventory from disk)
- [ ] src/game/assets/loaders.ts (useModel, preloadModels, cloneAnimated, InstancedModel)
- [ ] src/game/assets/animations.ts (action map + useCharacterAnimator + bone-name mismatch detection)
- [ ] /assets?dev=1 checker page (stats table, 3D preview, red flags, copy report)
- [ ] public/models/CREDITS.md + /credits page + Credits link on AuthScreen
- [ ] Verify build + checker page in preview
- [ ] Final report: files, flags, failures, animation mismatches, missing items, renames, changed files

## Known bugs (AGENTS.md — not in scope)
- Guards never de-aggro; old passive enemy-damage loop; vehicle damage bypass; die mid-flight no respawn; cars not drivable.
- Desktop/PC controls plan approved but not yet implemented (paused earlier for assets task).

## Backend & multiplayer phase (next major, after gameplay polish)
