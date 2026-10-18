# M3 verification — 2026-10-17

## Automated verification

**63 tests pass across eight files.** The suite applies all four actual SQL migrations in embedded PostgreSQL. Added coverage includes browser-role RPC/table denial, non-admin rejection, mismatched verifier, expired links/sessions, safe approved/published house projections, rejected-media exclusion, fresh denial after unpublish, per-link seen persistence, multiple sessions and revocation. HTTP tests cover missing/forged cookies, wrong passcode, opaque HttpOnly success cookie, no secret echo, throttling and Origin denial. Passcode tests cover independent salted hashes and malformed/missing verifiers. React tests cover StrictMode, history stripping, no browser storage and fragment navigation on an already-open entry page. Movement tests add multiple-bear separation/escape.

Lint and strict TypeScript pass. The final production webpack build passes; `/`, `/play`, admin/contributor/invite/API routes are dynamic and only `/demo` is statically generated. All 35 client artifacts were scanned against configured server keys, invitation pepper and cleanup secret with no matches. `.env.local` and browser test credentials are ignored by Git.

The temporary production preview on port 3002 passes `node scripts/smoke-local.mjs http://127.0.0.1:3002`: anonymous admin/contributor/house/message/media reads return 401 with private/no-store and no-referrer; entry/play/admin/invite/contributor shells return 200 with no-store and noindex. The temporary preview is stopped after verification; normal development remains on port 3000.

## Hosted rehearsal

The dry run listed only `0004_recipient_world.sql`; it was applied only to explicitly selected `hn-wrld`. Extended `scripts/smoke-hosted.mjs` passes against real Auth/PostgREST/Storage and the running Next app:

- Missing cookie/wrong passcode denied; two-factor entry succeeds.
- Pending fixture absent from house and denied by message endpoint. Approval plus published house placement exposes its bear; full message and four approved media descriptors load without Storage paths.
- Approved media loads; seen state survives a new visit; logout invalidates that visit. Rejected attachment/unpublished parent are denied. Link revocation denies existing visits and future unlocks.
- M2 checks still pass: private direct uploads, file/count/ownership limits, photo normalization, audio Range, Storage read/replay denial, concurrent submit, moderation, placement and eligible-object deletion.
- Only synthetic fixtures are deleted. The owner's administrator, contributions and placements are preserved. Test recipient links/sessions/progress are removed; delayed quarantine jobs remain intentionally.

## Browser evidence

- Gate at 360×800 has no horizontal overflow or game canvas/content before authorization. Temporary fragment opens the passcode form and disappears from the address bar. A link opened on an already-loaded entry page works too.
- Connected house renders one Phaser canvas at phone/desktop sizes, shows the synthetic bear and persistent seen count. The disposable bear alone was moved near Hanna for dialogue testing; existing contributors were untouched.
- **Talk** opens the synthetic message. Opt-in diagnostics show the world paused while dialogue is open. All three normalized photos decode (`naturalWidth=16`), and the synthetic MP3 plays on request and reaches its 2.006813-second end. No autoplay.
- Dialogue is scrollable, 328px wide at a 360px viewport, wraps long unbroken text and closes back to the house. Screenshots include only synthetic content: `m3-entry-phone.png`, `m3-world-phone.png`, `m3-dialogue-desktop.png`, `m3-dialogue-phone.png`.
- After test-link revocation and fixture cleanup, the visible world automatically cleared and showed “Your visit has ended” with no canvas or message. Phaser releases keyboard capture while dialogue/help is open so native scrolling and audio controls can receive Space/arrows.
- An initial short browser fixture window expired during inspection, correctly preventing photo reads after unpublication. A second controlled window confirmed successful photo decoding and audio playback before revocation. No access checks were weakened to load media.

Physical-phone touch, Safari microphone/real audio containers, interrupted upload recovery, crowded-scene FPS and timed quarantine expiry remain release checks. Browser viewport tests are not physical-phone testing. No M4, finale, deployment or release readiness is claimed.
