# SLU roadside cheering — 2026-11-21

## Behavior

Hanna's recipient-authorized SLU scenery includes a roadside cheering representation of every contributor eligible under the existing recipient scene projections. The server aggregates the three protected projections using the same session, then returns a sorted, deduplicated roster containing only contributor ID, display name and bear style. A failed or mismatched source fails closed. Existing source-invitation visibility semantics are preserved; there are no direct privileged table reads or new access paths.

The crowd is a display-only representation. No database placements, submissions, letters, media or publication flags are written or duplicated, and no migration is required. A native SLU bear reuses its existing dialogue identity once at a stationary formation position; other contributors appear as decorative supporters without Talk or letter retrieval. Crowd bears do not block movement. Original road collision boundaries and Hanna's central entrance corridor remain intact. Contributor visits and their privacy restrictions are unchanged.

Thirty supporters fit along the curb. The intended capacity test of 50 uses additional safe stair landings. Beyond 50, denser curb overflow retains the complete authorized roster; these denser gatherings are not the target visual layout. Cheering freezes when the world pauses and respects reduced motion. Hover or tap reveals names.

## Verification

- Full automated suite: **213 tests passed**, plus **3 recipient refresh/lifecycle tests passed** after they were added.
- ESLint: **passed**.
- HTTP tests cover metadata-only aggregation, canonical ordering, duplicate IDs, authorization, source failures, source-map identity and unchanged non-SLU projections.
- Formation tests cover intended 30/50-person layouts, safe slots, clear entrance/road boundaries, overflow retention, native/decorative deduplication and nonblocking movement.
- Recipient refresh tests verify the initial roster, changed names/styles, removed rosters and scene teardown after authorization failure. Contributor projections reject the recipient-only crowd field.
- Production build: **passed**, including TypeScript validation.
- Desktop browser preview: **passed** with 50 synthetic supporters, raised-arm animation, hover/tap names, clear central entrance and preserved native SLU Talk interaction.
- Phone emulation: **passed** at iPhone 16 dimensions (393 × 852), with the crowd, open entrance and touch controls visible. This was browser emulation, not a physical-device test.
- Browser console: no game exceptions; an existing missing favicon returned 404.
- Preview screenshots: ignored local artifacts `test-results/slu-cheering-desktop.png` and `test-results/slu-cheering-phone.png`.

The installed Next.js 16.4.2 release blocked builds with its security check. Updated Next.js and its matching ESLint configuration to the compatible 16.4.6 patch. The production dependency audit (`npm audit --omit=dev`) then reported **zero vulnerabilities**; development-only audit findings remain outside that result.

Verification uses synthetic content only. No real database content has been created, modified or deleted for this feature.

## Ambient speech follow-up — 2026-11-21

Cheering supporters take turns with one compact pixel speech bubble. It stays within the current camera, wraps long text on phones and has no entrance animation. Each bubble lasts 4.5 seconds with a randomized 2–4 second quiet gap. Only visible roster members can speak, with shuffled speaker/phrase rotation. One bear, chosen once per scene instance, uses the owner's extra quoted line once; afterward it also uses the encouragements. This is decorative scene copy, not an authored submission or a new letter interaction.

Speech hides and its timers freeze during dialogue, tab blur or other game pauses. Moving the camera away cancels the offscreen bubble. The speaking bear's nameplate is temporarily hidden to avoid overlap; native Talk stays available. The canvas includes a static accessible description of the encouragements without repeated live announcements. No backend, database or access-policy change is required.

- New scheduler tests: **8 passed**, covering speaker/phrase rotation, exact phrases, the single one-off quote, single-bear behavior, pauses, offscreen cancellation and invalid/empty visibility.
- Full ESLint: **passed**.
- Production build, including TypeScript: **passed**. The first sandboxed attempt hit a Windows `EPERM` while creating generated output; the authorized retry completed successfully.
- Full suite: **224 tests passed** in 23 files using `npm test -- --maxWorkers=2`. One existing database test exceeded its 5-second timeout during the initial concurrent build (223 passed); the complete retry passed after the build finished.
- New bubble visual verification: **not completed**. Computer Use stopped because it could not identify the native browser URL with enough confidence to enforce its policy. No desktop/phone visual pass is claimed for this follow-up. Earlier crowd screenshots document the formation only.
