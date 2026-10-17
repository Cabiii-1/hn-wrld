# M4 — Three little places

The full scene rollout is implemented. M5's letter, reunion, conversation and deployment are separate work.

## Explore and publish

- Open the existing private recipient link, unlock, and use the three chapter buttons above the game. House remains the first place. Existing links and saved hellos work across all three scenes.
- In `/admin`, assign approved submissions under **Their little places** to Sta. Ana House, Tuguegarao Plaza or SLU Baguio. Changing the area resets the form to that scene's safe spawn and wander radius. Select a bear variant, check **Published**, and save. Approval alone does not publish a bear. Existing records are preserved; no real submissions were automatically moved or published.
- `/demo` is a clearly labelled synthetic world. Its sample cast selector offers 1, 20, 30 or 50 bears. It never fetches private contributor content. Use your private link for actual submissions.
- Keyboard movement, touch direction pad, Talk, pause during dialogue and return-to-start work in every scene. Scene changes discard the previous cast while loading; failed requests show retry instead of stale bears.

## Geometry and rendering

`src/game/scene-geometry.json` is the canonical world geometry at 836 × 470. `scenes.ts` checks complete foot/wander rectangles against the exact union of safe regions, including corners between adjacent regions. Migration `0005_three_places.sql` mirrors the geometry and enforces it at publication and retrieval; database tests check parity. Changing geometry requires a new migration and matching tests.

- House: existing yard; car and house stay blocked.
- Plaza: broad open courtyard, narrowing near its edges; front lamp posts are blockers. No gazebo or foreground pots were added.
- SLU: sidewalk plus the **lower central and lower left stair flights are deliberately navigable**. Upper stairs, building, retaining walls, road and crosswalk are blocked. The sidewalk connects the two stair flights. This resolves the PRD's optional stair decision without adding another scene.

The supplied PNG compositions remain intact. Lossless WebP copies retain the original 1672 × 941 pixels, with nearest-neighbour rendering and integer camera zoom. Only the active background loads. Each scene uses the shared Phaser renderer, foot collisions, Y sorting, seeded bounded wandering, three bear variants and one game canvas after teardown settles. React handles controls/dialogue rather than sprite positions.

Crowd separation uses a spatial grid. For casts over ten, only the nearest NPC's canvas name is shown; dialogue retains the full name. Dense or duplicate zero-radius placements can still overlap; administrators should spread real placements and keep the narrow SLU walkway lightly populated. The open plaza is the intended large gathering area.

## Authorization and setup

Apply migrations through `0005_three_places.sql` for a new environment. The owner's hosted `hn-wrld` project has this migration applied. No new environment keys are required.

`GET /api/manage/recipient/scenes/{mapKey}` checks the active recipient session and validates its response. Its service-only RPC returns only approved contributions with published safe placements in a published area. Messages and media repeat those checks for all three locations. The old house endpoint remains compatible. Scene data, progress and attachments remain private/no-store; there are no public Supabase reads.

## Verify

Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`. See [M4 results](verification/M4_RESULTS.md) for the hosted synthetic rehearsal, browser evidence and limits.

For instrumented synthetic testing only, open `/demo?debug=1&benchmark=1`. The hidden `#game-debug` output reports cast size, active movement, FPS, measured frames/elapsed time and positions. The benchmark drives Bubu automatically only on `/demo`; omit `benchmark=1` for normal controls. Choose the sample count and scene. Physical-phone measurement at 20 active NPCs, real touch and current Safari/Chrome remains required release QA. Desktop viewport emulation does not establish phone performance.
