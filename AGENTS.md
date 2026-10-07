<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep day/night timing and visibility thresholds in `src/game/dayNightConfig.ts` so visual tuning remains testable and consistent.
- Keep lore presentation separate from persisted identifiers: faction, district, weapon, vehicle and realtime IDs remain stable so existing profiles and multiplayer stay compatible.
- Keep the awakening intro as a presentation-only gate before the existing session flow; it does not grant game access.
- Keep viewport HUD anchors and safe-area sizing in shared CSS, with hit testing based on rendered control bounds, so device sizing never changes game inputs.
- Share procedural relic geometry and material palettes between world and vehicle renderers; decorative ruins never change collision footprints.
