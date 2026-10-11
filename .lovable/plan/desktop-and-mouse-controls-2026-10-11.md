# Desktop and mouse controls

Add a desktop keyboard-and-mouse mode while leaving existing phone controls intact.

## Scope
- Detect touch versus desktop input and hide only the touch-control cluster in desktop mode.
- Add keyboard actions, weapon hotkeys, wheel cycling, focus-loss cleanup, and menu toggles.
- Add pointer-lock play/pause feedback and a pause panel for controls, sensitivity, invert-Y, volume, and desktop render quality.
- Add a desktop-only help strip that fades after 15 seconds and returns while paused.

## Technical approach
- Keep the existing imperative input object and vehicle/player mechanics; add desktop bindings in `input.ts`.
- Use small browser events to bridge keyboard input to React-owned stats, journal, shop, squad, mute, and pause state.
- Add the requested `src/game/pc/PauseMenu.tsx`; persist preferences under `forgotten-*` local-storage keys with guarded access.
- Verify build output and exercise desktop/touch-mode switching, hotkeys, pointer lock, and pause settings in the running preview.
