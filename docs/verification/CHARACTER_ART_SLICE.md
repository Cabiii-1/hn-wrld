# Character selection: capybara art slice

2026-10-19. First delivery step from `docs/PRD_CHARACTER_SELECTION.md`.

## Implemented

- Original native-grid 32x32 capybara art: five flat colors, solid 2x2 pixel clusters, no texture or antialiasing. Front, back and side; 12 frames following the existing idle/walk layout. Mirrored side movement uses the existing renderer.
- Pure source/catalog in `src/game/characters/capybara.ts`; reproducible sheet via `node scripts/build-capybara.mjs` at `/game/characters/capybara-v1.png` (384x32 RGBA).
- Phaser nearest-neighbor texture/animation registration only when the synthetic art preview is selected. Same movement, collision, ground origin and dialogue engine as the current player.
- `/demo`: select **Sample character → Capybara · art preview** to enter the Park. Existing bears provide scale comparison. Other scenes remain available. Switch back to Hanna to compare.
- Six native-frame previews below the world (front/back/side idle and walk) with a reduced-motion still alternative. These share the actual production atlas and animation metadata, not generated concept art.
- Preserved the six earlier simple concept PNGs under `assets/characters/concepts/8bit-v1/`. They are not used as game textures.

## Automated verification

- All 172 tests pass across 17 files.
- ESLint and the production build, including TypeScript, pass.
- New art tests decode the committed PNG and compare it byte-for-byte to the generated source; verify binary alpha, coarse pixel blocks, safe frame bounds, matching feet baseline and animation addressing.
- A UI regression test checks that selecting the capybara opens the synthetic Park with six pose previews and one game canvas, then returns to the existing bear without private API reads.

## Review checklist

Compare against the owner's simple capybara reference at the normal game scale. Check front/back/left/right movement, still pose, foot alignment, legacy bear scale, collision edges, Talk/dialogue pause, scene changes, reload and reduced motion. Keyboard and on-screen controls share the existing movement path. Hosted/browser checks and physical-device tests must be reported separately; automated tests do not prove hardware performance.

## Remaining PRD work

The other five production sprites, contributor character picker, saved selection, SQL/RPC compatibility, admin controls and mixed-animal privacy/access tests have not been implemented. No Supabase migration or real contributor mutation is part of this slice. The Park preview on the contribution form remains until the integrated selector is ready.


## Superseded remaining-work status
The owner reviewed the capybara and requested continuation. The full six-animal selector implementation is now documented in `CHARACTER_SELECTION.md`; the remaining-work section above records the scope at the first checkpoint.
