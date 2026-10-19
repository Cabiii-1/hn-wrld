# PRD: Crochet Friends Character Selection

**Product:** Hanna's Little World
**Version:** 1.1
**Date:** 2026-10-19 (Asia/Manila)
**Status:** Implemented and deployed; automated and hosted flow checks pass. Mobile visual and physical-device release checks remain separately tracked.

## 1. Purpose and source of truth

Let invited contributors choose an animal inspired by Hanna's crochet creations. Their animal carries their hello into her world: contributors control it during their visit, and Hanna meets the same character as an NPC.

This extends `docs/PRD.md` v3 and its later owner updates. Once implemented, it replaces the bear-only contributor identity requirement and the static Park preview near Send/Save. Existing invitation routing, automatic publication, opt-in text sharing, media handling, scene assignment and recipient access remain in force. Earlier moderation and visual-only visitor descriptions are already superseded by those owner updates.

This document describes the full target behavior. Implementation began with the owner-reviewed capybara art slice. See `docs/verification/CHARACTER_SELECTION.md` for the full implementation and validation evidence.

## 2. Goals and scope

- Offer six equally available animals: **bear, turtle, capybara, frog, cat and bee**.
- Match the owner's simple capybara reference: tiny, readable 8-bit shapes, large color blocks and minimal detail.
- Replace the complete **A LITTLE PEEK / Your hello has a place here** section with a character selector and selected-character preview.
- Save the choice with the letter and use it consistently in the editor, contributor visit, Hanna's cast and admin tools.
- Support desktop, mobile, keyboard navigation and reduced motion from the beginning.
- Preserve existing contributor appearances, authored content, placement and privacy choices during rollout.

Included: production sprite artwork, directional idle/movement animations, selector, atomic first submission/edit persistence, authorized projections, relevant admin controls, synthetic demo support and verification.

Excluded: changes to Hanna/Cj or the finale; new scenes/camera/collision geometry; custom uploads or accessories; unlocks, purchases or rarity; different speeds/abilities/hitboxes; multiplayer; public galleries; automatic conversion of existing contributors.

## 3. Art specification

The owner supplied an exact six-pose sheet on 2026-10-19, archived as `assets/characters/references/approved-16px-sheet.png`. This supersedes earlier concepts and outline redraws for turtle, capybara, calico cat, bee and frog. Preserve its actual 16×16 pixel cells, colors, proportions and poses. Extract pixel centers without antialiasing, remove only the reference grid/background and expand exactly 2× into 32×32 transparent production cells. Keep the original cream scarf bear, which is absent from this reference. The shared logical canvas controls scale; do not stretch different species to identical bounding boxes.

| Animal | Essential identifying features |
| --- | --- |
| Bear | Tan/cream body, round ears, simple muzzle; small green scarf if readable |
| Turtle | Green head/feet, green and gold shell from the supplied sheet |
| Capybara | Tan body, tiny ears, broad rectangular brown muzzle |
| Frog | Green body, raised eyes, pale belly, squat feet |
| Cat | Pointed ears, cream/orange/brown calico patches, small tail |
| Bee | Yellow body, dark stripes, light wings, short antennae |

Production requirements:

- **32×32 transparent frame cells**, matching the current game contract, with exact 2× expansion of the supplied 16×16 animal cells. Preserve the original bear's native pixels.
- Prefer approximately 6–8 flat colors per character, simple eyes and square blush. No yarn/fur texture, speckles, gradients, detailed eye highlights or antialiasing.
- Verify recognizable silhouettes at actual game size. Keep apparent scale, foot anchor and common baseline consistent, while allowing species-appropriate body proportions.
- Match the existing elevated/front-facing scene view; no isometric diamond orientation.
- Match the current **12-frame arrangement**: front, back and side directions, each with two idle and two movement frames. Mirror side frames for left/right; markings must remain coherent under mirroring.
- Each supplied direction has idle and stride poses. Duplicate idle for both idle frames and alternate idle/stride for walking; do not invent extra artwork. Preserve the bear's original animation. Gameplay speed, feet hitbox and talk range are equal.
- Hop/hover offsets affect rendering only, not collisions, NPC coordinates or Y-depth ordering.
- Use nearest-neighbor rendering and existing integer scaling. Selector previews must use production frames rather than different concept art.
- Share a typed sprite catalog between React previews and Phaser. Frame-by-frame game animation remains in Phaser, not React state updates.
- Reduced motion uses a still idle preview and respects existing stationary-animation behavior.

## 4. Contributor flow and copy

### First submission

The invitation still opens the contribution form directly. Near Send, the contributor can choose an animal, see a selected-character preview and submit using the existing consent/save flow. The current arrival transition then opens their assigned scene with that animal as their playable character.

Suggested copy:

> **A LITTLE YOU**
> **Which little friend feels like you?**
> Pick a crochet friend to carry your hello into Hanna's world.

Each option displays an animal name and sprite. A selected border, checkmark and accessible selected state identify the choice; color alone is insufficient. The preview shows the selected name and gentle idle animation. Selecting an animal is local until Send/Save; it must not navigate, upload files or request microphone access.

New submissions default visibly to **bear**. This is optional customization, not another required form step. Avoid personality labels, business promotion and implementation explanations.

### Returning contributor

- Reopening a submitted invitation still goes directly to `/contribute/visit`.
- **Edit your message** opens the prefilled editor, including the saved character, letter, media and visibility choice.
- A selection change updates the local preview. **Save my changes** commits it with the existing revision/consent flow; Cancel restores the saved choice.
- Failed saves retain the draft choice for retry. Stale revisions show the existing conflict/reopen behavior instead of silently overwriting a newer selection.
- On success, the visitor and Hanna's NPC use the same animal. Already-open other sessions update on their next normal authorized scene refresh; realtime synchronization is outside scope.
- A character-only edit preserves letter text, attachments, sharing consent, scene, placement ID, coordinates, wander radius, publication/hold state and seen progress. Do not rerandomize placement or republish explicitly held content.

## 5. Layout and accessibility

- Replace the former Park-preview section only. Preserve the recently corrected equal-sized photo/voice cards and their in-card recording controls.
- Six options in a compact grid: three columns on desktop, two on narrow phones, with additional reflow for enlarged text. No horizontal overflow.
- Reserve a stable selected-preview area so switching animals does not move Send/Save.
- Use native radios or equivalent accessible radio-group behavior: Tab, arrow keys and Space, clear focus and an announced animal name. Do not repeatedly announce animation frames.
- Minimum touch target: 44×44 CSS pixels. Decorative duplicate sprites are hidden from assistive technology.
- Animate only the selected preview. Do not mount six Phaser instances or autoplay audio.
- Asset-load failure preserves selectable names and a stable fallback. Reduced motion shows a still frame.

## 6. Data model and backward compatibility

Recommended model: nullable, constrained **`character_key`** on the saved contribution. Accepted public values: `bear`, `turtle`, `capybara`, `frog`, `cat`, `bee`. Never accept arbitrary texture paths or animation keys.

| Case | Required behavior |
| --- | --- |
| New form | Submit explicit choice; default bear |
| Existing contribution | `character_key = null` means legacy appearance; retain its existing bear variant |
| Unrelated edit of a legacy letter | Preserve the old appearance; opening/saving must not silently adopt the new bear |
| Legacy contributor chooses an animal | Save that explicit choice and update the resolved placement appearance |
| Older client omits the field | Preserve existing selection on edits; safe bear default on new submissions |
| Invalid value | Reject at server and database boundaries |

In the legacy editor, show Bear selected with the existing bear preview. Allow an explicit selection of the new Bear appearance, even when the displayed category was already Bear; distinguish untouched legacy state from intentional selection internally.

Store selection with message/media/visibility/version in the same transaction. The contribution's choice is canonical; placement rendering derives from it. Admin animal changes must update the canonical choice and placement together. Keep legacy recolors available for legacy rows rather than introducing competing contributor/admin appearance settings.

Retain `npc-cream-1`, `npc-brown-scarf` and `npc-rose-bow` rendering during rollout. Extend all constrained appearance schemas, database checks and projections consistently. Contributor snapshots must distinguish legacy appearance from an explicit new choice.

Use an additive migration after the current sequence. Preserve older RPC signatures through compatible wrappers/defaults or versioned functions, accounting for PostgreSQL overload resolution. Do not remove legacy support in the first release.

## 7. Backend, privacy and publication

- Extend first-submission/edit schemas, `submit_instant_contribution` / `edit_instant_contribution` paths, contributor snapshots, recipient world, `contributor_visit` and admin placement handling.
- Validate the animal enum in both HTTP and SQL. Retain scoped session, consent, attachment, version and rate-limit checks.
- Only the owning active invitation session or authenticated allowlisted admin can change the selection. Expired, revoked and cross-invitation requests must fail.
- Preserve automatic publication and existing safe placement. Hidden/rejected letters and manually unpublished NPCs stay held after a character edit.
- Animal choice does not broaden content access. Invited friends still read opted-in text through authorized in-world interactions; media and finale access remain as currently enforced.
- Public sprite assets contain art only. No tokens, private names, messages or uploaded media in assets or synthetic demo fixtures.
- No persistent private browser cache, public content endpoint or authentication bypass.

## 8. Integration boundaries

| Area | Planned change |
| --- | --- |
| Art/catalog | Versioned production sheets, source preservation, typed asset/frame mapping |
| `src/components/park-preview.tsx` | Replace form usage with a dedicated picker; remove obsolete preview code/styles after parity |
| `src/components/contribution-form.tsx` | Draft/saved selection, legacy handling, submit/edit payload and cancellation |
| `src/lib/backend/contracts.ts`, `http.ts`, `page-data.ts` | Schemas, validation, snapshots, projections and admin data |
| Supabase migrations | Nullable selection, constraints, compatible atomic RPCs and authorized projections |
| `src/game/bear-art.ts` and texture loading | Add shared animal textures/animations; retain legacy and Hanna/Cj rendering |
| `src/game/connected.ts`, `bridge.ts`, `house-scene.ts` | Render resolved character keys for visitors/NPCs without changing physics |
| Admin/demo | Character selection/naming, legacy display and synthetic mixed-animal casts |

These identify responsibilities; components may be reorganized around a simpler shared catalog/renderer if appropriate.

## 9. Delivery sequence

1. **Capybara art slice:** produce native-grid front/back/side idle and movement frames. Verify actual-size readability, alignment and animation in a synthetic Park scene. Review against the owner's simple reference before producing the other five.
2. **Remaining animals:** produce matching frames, anchors and palettes; retain legacy bears.
3. **Persistence/access:** add compatible migration, enums and atomic save/read support, including SQL authorization tests.
4. **Picker/world integration:** replace the preview and connect editor, visits, Hanna's cast, admin and demo.
5. **Verification/release:** rehearse migration on synthetic data, run checks, deploy compatibility-first, verify hosted flows and remove test data.

Do not treat generated concepts as production sheets. Do not declare completion while saved choice and rendered identity disagree.

## 10. Acceptance criteria

| ID | Required outcome |
| --- | --- |
| ART-01 | Six recognizable animals match the simple reference at actual scale, with common frame size/anchors. |
| ART-02 | All directions/animations work without jitter, cropped parts, blurred filtering or inconsistent footprints. |
| UX-01 | The Park preview is replaced by six named choices and a stable preview; equal photo/voice cards are unaffected. |
| UX-02 | Keyboard/touch selection, screen-reader labels, visible focus and reduced motion work without horizontal overflow. |
| SAVE-01 | Each choice survives first submit, arrival, reload, invitation re-entry and explicit editor reopening. |
| SAVE-02 | Save updates visitor/NPC consistently; cancel, failure and stale revision preserve correct saved/draft behavior. |
| LEGACY-01 | Existing bear variants survive migration and unrelated edits; explicit animal selection and old payloads work. |
| WORLD-01 | All six move/collide/talk under the same rules in all three scenes; hop/hover does not change physics. |
| WORLD-02 | Character-only edits preserve placement, publication/hold state, attachments, text visibility and seen progress. |
| ACCESS-01 | Invalid enum, revoked/expired session, cross-invitation mutation and unauthorized admin access fail. |
| ACCESS-02 | Opt-in text and private media/finale boundaries remain enforced for every animal. |
| RELEASE-01 | Relevant tests, lint and TypeScript/production build pass; hosted synthetic flows pass and test data is removed. |
| PERF-01 | Test a 50-character mixed demo cast and compare a 30-visible-character scene against the current build on the same phone/browser; investigate regressions before release. |

Verify the selector alongside idle, active recording, recorded playback and failed-upload states to protect the equal attachment-card layout. Record browser-emulated checks separately from physical-phone and microphone checks; never claim hardware testing that was not performed.

## 11. Rollout and definition of done

- Deploy additive database compatibility before clients require new fields. Retain legacy textures throughout rollout.
- Rehearse six selections, a legacy bear, an explicitly held NPC and a stale revision using synthetic records. Never modify real contributor content for QA.
- Keep a rollback frontend capable of reading newly saved animal keys. A pre-feature build may reject them; do not rewrite real selections merely to force rollback.
- Complete means production artwork, selector, persistence, visitor/NPC rendering, admin support and acceptance evidence ship together.
- The owner reviewed the capybara slice and authorized the remaining animals and integration. The complete implementation is tracked in `docs/verification/CHARACTER_SELECTION.md`; physical-device release checks remain separately recorded.
