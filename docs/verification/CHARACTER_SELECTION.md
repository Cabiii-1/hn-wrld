# Crochet Friends character selection

Implemented 2026-10-19, following `docs/PRD_CHARACTER_SELECTION.md` and the owner-reviewed capybara slice.

## Delivered behavior

- Six 32×32 pixel animals: original bear plus the owner's exact turtle, capybara, frog, calico cat and bee reference poses. Each sheet contains front/back/side idle and movement frames, sharing the existing feet origin, speed and collision/talk rules. Side frames mirror for left/right. Bee hover remains within its frame without changing physics.
- The former Park teaser is replaced by six named native radio options and a stable animated selected-character preview. Keyboard arrows/Space and touch work; reduced motion uses still frames. Equal-sized photo/voice cards remain separate.
- New contributions default to Bear. Edits load the saved choice and preserve a failed draft. Cancel restores the saved appearance. Existing contributors keep their legacy bear unless they explicitly choose an animal, including intentionally choosing the new Bear.
- Migration `0018_contributor_characters.sql` adds nullable canonical `character_key`, separate atomic character submit/edit RPCs and wrappers around existing scoped world projections. Old RPC signatures remain supported. No real identities are backfilled or moved.
- Contributor and admin choices update the same canonical identity and placement texture. Character-only edits preserve scene, coordinates/radius, publication holds, privacy, media and progress.
- Public art contains no contributor data. Recipient entry, opt-in shared text and private media/finale authorization are unchanged.
- Demo now offers all six playable animals plus a mixed legacy/animal cast for 1/20/30/50-character checks, with production-frame pose previews.

## Source and reproduction

- `src/game/characters/catalog.ts`: shared key/name/asset mapping and accepted variants.
- `reference-pixels.json`: exact indexed 16px poses from the owner's approved sheet; `animal-art.ts` expands them 2x and retains the original bear. `capybara.ts` defines the shared animation addresses.
- `paint-legacy-bear.ts`: the unchanged legacy drawing operations shared with Phaser and preview exports.
- Run `npm.cmd run art:characters` to reproduce all public PNG sheets. Enlarged AI concepts remain archived under `assets/characters/concepts/8bit-v1/`, separate from production artwork.

## Automated verification

- 180 tests across 18 files pass, including the full SQL/RLS suite.
- TypeScript/production build and ESLint pass.
- Art checks compare decoded committed PNGs to source pixels and every expanded pixel against the archived reference. They also verify animation addresses, distinct strides and byte-identical original bear rendering.
- Tests cover all six saves and visitor/recipient projections, placement preservation, legacy/no-field edits, canonical admin edits, invalid keys, stale revision rollback, session revocation and unauthorized mutation denial.
- UI checks cover six named radios, keyboard selection, legacy preservation, explicit Bear adoption, failed saves and cancellation. Existing voice/media editing and privacy tests remain passing.
- A 50-character mixed cast contains all nine new/legacy variants and remains within safe geometry across all three scenes in the movement simulation.

## Hosted verification

Migration 0018 has been applied to the linked project. Hosted UI verification and disposable fixture cleanup are recorded after deployment below. Physical-phone performance and microphone hardware remain separate release checks; automated and desktop-browser results do not claim these were performed.

## Compatibility and rollback

Keep migration 0018 and a frontend that understands all nine appearance keys during rollback. Old write signatures preserve saved selections; an older frontend may reject new animal keys on reads. Do not rewrite real selections to force a rollback. The `*_before_characters` projection functions are internal service-only compatibility implementations; they are not new public endpoints.


### Hosted results (2026-10-19)
Production commit 95725c4 deployed Ready. A disposable invitation selected Frog, submitted a synthetic letter, arrived in its assigned Park, reopened with Frog selected, changed to Bee and reopened with Bee selected. A separate synthetic source used Capybara with text sharing enabled. Service-side checks confirmed matching saved choice/visitor/recipient NPC, source Capybara visibility, private-letter denial and denial after session revocation. All synthetic contributions, placements, invitations, contributor sessions and the synthetic recipient link/session were removed successfully. No real letters, media, identity choices or progress were modified.

The public mixed demo rendered all six animals alongside legacy bears in a 50-NPC Park cast and loaded the same cast in Sta. Ana House and SLU. This confirms loading and rendering, not physical-phone frame-rate performance. The desktop selector screenshot is in ignored test-results/character-picker-desktop.png; the mixed cast is in test-results/animal-mixed-cast-park.png.

The browser's requested 390px viewport override did not change its measured 1265px width. The resulting image is excluded as mobile evidence. Two-column narrow-screen selector CSS is implemented, but mobile visual QA and physical-phone performance/microphone checks remain pending; desktop and simulated movement tests do not substitute for those checks.

### Exact reference revision (2026-10-19)
The owner replaced earlier art interpretations with an exact 16x16 six-pose sheet for turtle, capybara, calico cat, bee and frog. Archived at assets/characters/references/approved-16px-sheet.png. The import script samples grid-cell centers and removes only the known background colors; indexed pixels are committed for reproducible builds. All five retain their exact proportions, palette and poses at integer 2x scale. Idle repeats the supplied idle; walking alternates the supplied idle and stride. The original cream scarf bear is unchanged. Versioned v3 URLs avoid stale asset caching; no database migration or saved-choice change is needed.

180 tests pass, including exact reference comparisons across every frame and original-bear equivalence. ESLint passes. The rendered six-pose contact sheet was visually inspected at test-results/approved-animals.png. Production build and hosted verification results are recorded after completion below.

Production build passes, including TypeScript and prerendering. The first sandboxed build hit a generated-output mkdir permission error; the authorized retry completed successfully.

Hosted result: f4a2193 deployed Ready on Vercel. The production demo selected Capybara with a 20-character mixed Park cast; the pose preview references capybara-v3.png, and the canvas visibly renders the supplied animals beside unchanged bears. Screenshot: test-results/exact-animals-park.png. No real contributor data was used or modified.
