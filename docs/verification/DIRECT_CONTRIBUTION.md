# Direct contribution entry — 2026-10-18

New/recovered/reissued invitation URLs now target /contribute#secret. ContributionEntry handles fragment capture, immediate history removal, scoped exchange, and snapshot retrieval inline; it never navigates through an invitation welcome page. The former welcome component is deleted. Existing /invite#secret URLs render the same module and canonicalize to /contribute without a redirect or intermediate welcome screen. Fresh fragments override checked cookie snapshots; exchanges for changing links serialize, and StrictMode reuses pending work. Tokens stay in memory only.

An existing contributor opens the full editor directly, prefilled with message, sharing preference, saved media and optimistic version. Saving from this flow returns them to their assigned world through the existing arrival transition. The visitor footer now links to Edit your message, including its visible phone label; Hanna’s original reset button remains. The redundant top navigation letter link is removed. Session expiry/logout returns to /contribute.

All 166 tests passed, with focused coverage of old/direct links, no module redirect, StrictMode single exchange, token removal/storage absence, retry, malformed links, fresh-link precedence, saved editor hydration and out-of-order link changes. ESLint and production webpack build/TypeScript passed. No database migration or access expansion is required.

## Returning invitation destination (owner update, 2026-10-18)
After link exchange, a submitted contributor goes directly to /contribute/visit. A first-time contributor still opens the form. Checked sessions follow the same default; fresh links still override the old session. Explicit Edit your message links use /contribute?edit=1 to open the prefilled editor without redirecting back to the world. The top visitor action bar and Leave for now CTA are removed entirely, including unused styles. Saving edits retains the return-to-world flow. Existing invitation URLs remain compatible; all authorization checks remain in place.
Returning-visit update: 168 tests passed with four workers, along with lint and production build/TypeScript. A passcode-test timeout during concurrent build/test work passed on the quieter rerun. Focused tests cover submitted-link/session routing and explicit edit mode.

Voice-card/preview update: all 168 tests pass (four workers), along with lint and the production build. Existing voice tests verify recording feedback, stopping, preview continuity through upload, failed-save retry, and retained attachment editing after the layout move. No backend access or sharing rules changed.


### Compact extras layout (2026-10-19)
Replaced unequal side-by-side cards with compact full-width rows and label-area controls. Fresh recordings keep one local audio player with Remove alongside it; inactive upload controls and duplicate attachment summaries are omitted. Regression coverage checks a single player, removal and restored upload controls; saved-media editing/cancel remains covered. All 168 tests, ESLint and production build pass.


### Equal attachment cards (2026-10-19)
Owner clarified the two-column design should remain. Both cards are 230px; voice states replace idle content and retain in-card playback/removal, while photo previews sit below the grid. Existing 168 tests cover microphone lifecycle, local playback, retry/removal and saved media editing. Lint and production build pass. Desktop/mobile visual checks use a disposable invitation; no real letter or microphone is used.

## Contributor edit action — 2026-10-21
Edit your message now uses the filled primary style and no longer inherits the reset icon's fixed 44px phone width. Below 600px, the contributor footer stacks its status and full-width edit link with a 44px minimum touch height; desktop keeps a compact action. Existing /contribute?edit=1 routing stays intact. Six contributor visit tests, targeted ESLint, and the production build pass.
