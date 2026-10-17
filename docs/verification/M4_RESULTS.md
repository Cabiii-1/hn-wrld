# M4 verification — 2026-10-17

## Automated checks

- `npm.cmd test`: **82 tests passed across 10 files**, including all M1/M2/M3 regressions.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed during implementation; final production build also typechecks.
- `npm.cmd run build`: production compilation passed with all intended routes.
- Client output credential scan: 34 production JavaScript files checked; no configured server secrets found.
- Production `node scripts/smoke-local.mjs http://127.0.0.1:3002`: nine anonymous API reads denied with 401/private-no-store/no-referrer, including all three new scene endpoints; five private shells render with no-store/noindex. Temporary production server stopped after checks.

New tests cover all scene spawns; park lamps/edges; SLU road, wall and building denial; complete rectangle-union coverage; safe stairs-to-sidewalk movement; collision substeps; deterministic duplicate separation; 20/30/50 fixtures in every map for 900 simulation frames each; scene navigation; protected loader failure/retry; SQL/TypeScript geometry parity; publication, isolation, media and role restrictions.

## Hosted synthetic rehearsal

Migration `0005_three_places.sql` was dry-run and applied to the owner's existing `hn-wrld` project. `node scripts/smoke-hosted.mjs hxvcbwhaqtpqaokgwojz --allow-test-writes` exited successfully:

- Real Supabase Auth, contribution quota and ownership checks; three-photo/one-audio limits; upload normalization and authorized range reads.
- Link-plus-passcode entry, pending denial, connected message/media and persistent seen state.
- Relocated the harness's approved synthetic NPC through **house, plaza and SLU**. Each correct scene returned it, other scenes excluded it, and private message/media reads continued to work. Seen state survived relocation. Unknown scene was rejected.
- Anonymous requests, expired/revoked access, unsafe placement, unpublish/rejection, RLS and deletion checks passed.
- Harness-created accounts, invitations, messages and objects were removed. Delayed cleanup jobs remain intentionally queued. Permanent owner records and real contributions were preserved.

## Browser observations

Desktop IAB Chromium at 1280 × 900, portrait viewport 360 × 800 and landscape 844 × 390. These are desktop-browser viewport checks, **not real phone tests**.

- House → plaza → SLU rendered their correct supplied art, titles and controls. SLU sign and lower stairs were visible; road stayed scenery.
- Repeated scene/count changes settled to **one Phaser canvas and one debug output**. Teardown handles both scene shutdown and game destruction. A hot-reload sample was discarded and replaced by a clean run.
- Fixed the new long scene title overflowing the narrow viewport. Portrait document width equalled scroll width; all three chapter buttons and direction/Talk controls remained available.
- Opened the plaza's synthetic dialogue using Talk. Hidden game diagnostics confirmed `paused=true`. Portrait dialogue and scrollable landscape dialogue remained readable; closing returned to the scene.
- Synthetic autonomous movement benchmark recorded desktop house with 30 and plaza with 50 NPCs, plus portrait-sized plaza with 30 and SLU with 50. The desktop browser reported 173–179 measured FPS in the captured samples. See [raw measurements](m4-performance.json) for durations and exact values. Some dense SLU fixture bears deliberately have zero wander radius to stay on its narrow path. This is a rendering/capacity check, not a claim that 50 SLU NPCs are desirable or all simultaneously wandering.

Saved synthetic evidence: [plaza desktop](m4-plaza-desktop.png), [SLU desktop](m4-slu-desktop.png), [SLU portrait stress cast](m4-slu-mobile.png), [portrait dialogue](m4-dialogue-mobile.png), [landscape dialogue](m4-dialogue-landscape.png).

## Release QA still open

- Measure ≥30 FPS on a representative physical midrange phone with 20 active NPCs; exercise 30-NPC usability on actual touch in current Safari/Chrome, including camera edges, scene switching and audio playback.
- Continue the existing physical-phone voice recording, interrupted upload and recovery checks.
- Confirm supplied background rights before final publication; original PNGs and manifest provenance remain intact.
- M5 finale, final accessibility/device rehearsal and deployment are not implemented by M4.
