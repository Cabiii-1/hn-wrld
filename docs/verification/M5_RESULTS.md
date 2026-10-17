# M5 verification — 2026-10-17

The finale implementation is verified locally and against hosted `hn-wrld`. This is not production release approval: personal authoring, physical-device QA, artwork-rights confirmation and a linked Vercel deployment remain outstanding.

## Automated results

- `npm.cmd test`: **101 tests passed across 11 files**, including M1–M4 regressions.
- `npm.cmd run lint`: passed with no errors or warnings.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed. Private entry, play, admin, contributor, invitation and API routes remain dynamic; `/demo` is synthetic and static.
- Production `node scripts/smoke-local.mjs http://127.0.0.1:3002`: all 12 anonymous private API reads denied with 401/private-no-store/no-referrer, including admin finale, ending and ending status. Five private shells render with no-store/noindex. Temporary production server stopped afterward; development stays on port 3000.
- Scanned 36 production client JavaScript files against configured server secrets and the private finale rehearsal sentinels: no matches. The separately labelled synthetic sample ending is intentionally public.

New coverage includes role/RLS denial on finale tables and RPCs, hidden draft content, incomplete publication rejection, progress gating, threshold cap, zero-contributor entry, per-link completion and revisit persistence, idempotency, optimistic revision conflicts, draft/published separation, stale completion, expiry, unpublication and revocation. HTTP checks cover missing cookies, fresh authorization, locked content, admin allowlist, input schemas, foreign Origin and both authenticated cron methods. React checks cover all phases, skip/replay, failed-save retry, reduced motion, removing exploration while the ending is open, synthetic isolation and private draft saves.

## Hosted rehearsal

The migration dry run listed only `0006_private_finale.sql`; it was applied successfully. It seeds an empty, unpublished draft, not personal or sample prose.

`node scripts/smoke-hosted.mjs hxvcbwhaqtpqaokgwojz --allow-test-writes --finale-check` completed successfully against real Supabase Auth/PostgREST/private Storage and the running Next app:

- Existing photo/audio limits, validation/normalization, ownership, replay denial and range checks pass.
- Recipient two-factor entry, approved NPCs/messages/media, seen persistence, all three scene projections and placement isolation pass.
- Synthetic finale draft stays hidden; explicit publication creates a protected snapshot. A fresh recipient is locked until opening an eligible hello. Completion persists, later draft edits do not change the published letter, and unpublish/revocation deny new reads/writes.
- Deletion, cleanup, RLS, rejection and unpublication checks pass.
- The rehearsal requires an untouched empty finale before it can run; it refuses to overwrite authored content. It restored the original empty draft using a revision comparison, removed its own accounts/invites/messages/objects/recipient links and progress, and preserved permanent owner content. Delayed quarantine jobs remain intentionally queued.

Two initial runs passed the finale assertions but failed the old immediate media-deletion assertion. Only this run's already-deleted final-object jobs now get a timestamp one minute in the past, avoiding local/database clock skew; fresh Storage reads also use a cache nonce. The subsequent full rehearsal passed. Staging expiry, real records and production cleanup eligibility rules were not weakened.

## Browser observations

IAB Chromium at desktop 1280 × 900, portrait 360 × 800 and landscape 844 × 390; these are viewport checks, not physical phones.

- Sample letter opens without private APIs. Heading focus moves into each phase.
- Phaser shows Bubu and Dudu approach, stop together and display a heart at the SLU entrance. After loading, one canvas is present. Letter/conversation pages have zero exploration canvases.
- Portrait **Use a still scene** displays the equivalent still scene and written narrative; the full reunion, controls and text fit without horizontal overflow.
- Keyboard Enter advances conversation; previous/next, completion and **Read it again** work. Replay returns to the letter. Landscape letter scrolls naturally and document width equals scroll width (844px).
- Back to the world restores exploration. The existing real admin browser session had expired, so no private owner credentials were requested for an additional visual admin check. Editor behavior is covered by React tests and the real authenticated HTTP rehearsal above.

Synthetic screenshots: [desktop letter](m5-letter-desktop.png), [desktop reunion](m5-reunion-desktop.png), [portrait still reunion](m5-reunion-phone.png), [portrait conversation](m5-conversation-phone.png), [landscape letter](m5-letter-landscape.png).

## Remaining release work

The owner will add the authored letter/conversation in admin. Complete physical-phone touch, Safari recording, interrupted upload recovery, crowded-scene FPS, long text/media and finale rehearsal; verify supplied background rights. GitHub CI and Vercel configuration are prepared, but CI has not run remotely and no Vercel login/project was found locally. Deployment, HTTPS production checks and scheduled cleanup validation remain open. See [deployment handoff](../DEPLOYMENT.md).
