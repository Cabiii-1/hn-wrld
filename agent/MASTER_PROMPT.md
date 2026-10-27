# MASTER IMPLEMENTATION PROMPT — Claude Code / Codex

You are the lead engineer implementing **Hanna's Little World**, a private single-player sentimental browser pixel-art game. This repository contains the product specification, sample artwork, and seed migrations.

## Read first (mandatory)
1. Inspect the repository and do NOT overwrite existing code.
2. Read `AGENTS.md`, `README.md`, `docs/PRD.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/ART_BIBLE.md`, `docs/REQUIREMENTS.md`, `docs/ACCEPTANCE.md`, and `docs/IMPLEMENTATION_BACKLOG.md`.
3. Resolve conflict by treating **`docs/PRD.md` v3 and this prompt as authoritative** over stale seaside/gazebo versions in older files; update those docs when implementing.
4. Inspect provided background artwork in `assets/backgrounds/`, verify actual image dimensions and decide how to scale/crop safely.

## Confirmed requirements — do NOT re-ask
- Both mobile and desktop are equally important.
- Recipient access = private recipient link **PLUS** server-validated passcode; secure session.
- 15–30 personally invited contributors, 50-NPC capacity fixture.
- Each contributor submits required text and optional up to three photos and one voice clip. Admin moderates both message and media before publish.
- Cj's finale = personal letter → animated reunion → final conversation; reduced-motion option/replay.
- Surprise date is TBD; no date locks/countdowns.

## UPDATED scenes — do NOT use old beach/city/gazebo concepts
- `sta_ana_house`: her house/yard with trees, fence, house and cream **Raze** car; broad walkable yard. This is the **first vertical slice** and the starting scene, replacing the beach.
- `tuguegarao_park`: a huge **empty open plaza** for friend NPCs; trees and benches along edges; **NO central building/gazebo and NO foreground flowerpots/planters**.
- `slu_baguio`: Saint Louis University entrance-inspired scene, stairs, sign, road/crosswalk, trees; safe paths for NPCs and Cj.
- Use background PNGs at `assets/backgrounds/{sta_ana_house,tuguegarao_park,slu_baguio}.png` as initial scenic content. Do not infer collision from opaque pixels. Create explicit walkable polygons, collision obstacles, NPC spawn/wander bounds, foot anchors and scene transitions; Phaser foreground layering only if needed. Maintain friendly cute blocky pixel art and matching chibi Hanna/Cj/NPC bear sprites. Avoid true isometric engines/grids.

## Stack (fixed)
- Next.js App Router, React, strict TypeScript, Phaser 3, Tailwind, shadcn/ui, Zod.
- Supabase PostgreSQL/RLS/Auth/private Storage; Vercel hosting.
- Phaser owns sprites/physics/camera/animation; React owns admin/invite/dialogue/gallery/audio UI. No Phaser SSR (dynamic client-only import), no frame-by-frame React renders.
- Use simple Arcade Physics / bounding areas for static backdrops. Handle aspect ratios with a game camera and safe UI, never stretch pixel textures.
- Do not add a FastAPI service, Socket.IO, Redis or multiplayer features without a real need.

## Execution protocol
1. Report project state, available files, gaps and top risks; propose an ordered plan with acceptance tests.
2. Work in small verifiable increments, starting with **Milestone 1 only**. Ask a question only if genuinely blocking; otherwise record a default and proceed.
3. **M1 house slice:** boot Next.js + Phaser client; show actual house artwork, prevent movement outside a clearly visible front-yard ground region and through house/car; add Hanna bear placeholder with idle/walk facing directions; support WASD/arrows, mobile D-pad, `E` or touch interact; spawn one bounded wandering bear NPC; render mock personal message in a keyboard/touch accessible shadcn-styled React dialogue overlay. Pause movement while dialogue open. Include mobile landscape/portrait treatment, nearest-neighbor pixel scaling and cleanup of Phaser instance.
4. Run lint/typecheck/build and browser/manual checks where available. Document test results/screenshots, changed files, then STOP and propose M2. Do not claim milestone complete without verification.
5. **M2** (after approval): implement contributor invites, upload authorization, private photo/audio storage, server-side validation, Supabase migrations/RLS, admin moderation and tests. Use existing migrations as a starting point, audit them; do not assume their RLS is comprehensive.
6. **M3:** implement authenticated recipient link+passcode exchange, session protection on every API and short-lived media URLs; ensure unapproved content never leaves server; progress persistence.
7. **M4:** install open-plaza Tuguegarao scene and SLU scene, collision zones, NPC variants and navigation. Test 30 NPCs and mobile responsiveness.
8. **M5:** Cj's authored three-phase finale and reduced motion/skip/replay; polish audio, accessibility, asset loading and deploy.

## Security non-negotiables
- No real messages/audio/photos in public assets, mocked client bundles or statically generated pages.
- Never expose service role keys or access passcode in `NEXT_PUBLIC_*`/client. Hash invite/access tokens; throttle attempts; authorize both recipient session and contributor/admin roles on server and through RLS.
- Storage buckets private. Signed media URLs issued only after access check, short-lived; never publicly list pending submissions. Reject spoofed file types, huge payloads, invalid durations and unsafe media.
- Ensure page/API caching does not leak recipient-specific data. Treat the recipient link as sensitive and stop token leakage through referrers and analytics.

## Output after each slice
- What was built, files modified, commands/tests run + pass/fail, security checks, known issues, precise next milestone.
- Keep the repository runnable after each step. Prefer quality and end-to-end proof over superficial large implementation.

**Begin now:** inspect files, give a brief plan, and implement Milestone 1 only unless I ask for more.

## Owner-approved contributor-visit exception (2026-10-18)
Follow docs/PRD.md’s Contributor visits update: submitted contributors may explore their administrator-assigned scene through an independently authorized visual-only projection. Their own bear and other published bears show their saved contributor display names (owner update, 2026-10-18). This does not grant access to recipient messages, media, progress, or the finale. Keep /play behind recipient link plus passcode.


## Opt-in letters for invited friends (owner update, 2026-10-18)
This explicitly extends the earlier visual-only visit exception: active submitted contributors can read text-only letters that their authors opted to share, after admin approval and safe publication in the viewer’s assigned scene. Existing letters default to private. The form offers Just Hanna and Cj / Share with invited friends, too; the choice is editable and saved atomically with the letter/version/consent. Edits reset moderation and unpublish the NPC. Photos, voice notes, recipient progress and the finale remain inaccessible to other contributors. No content is public on the internet. The visit projection adds only a readable flag; a separate service-only contributor_shared_message RPC rechecks the viewer session/submission, source opt-in, source invitation expiry/revocation, current moderation/publication, area and safe placement before each read. Shared text is fetched on demand via contributor/letters/{placementId}; scene data never embeds bodies or attachment IDs. The shared-letters panel pauses movement while open and rechecks open text on tab return/every 15 seconds, clearing it on denial. Revoking access or opting out denies subsequent reads. No persistent private cache is added. The general photo description/transcript input and saved-caption editors are removed; existing descriptions are preserved. Migration 0013 implements these changes.


## Shared letters through bear interactions (owner clarification, 2026-10-18)
Invited players open opted-in letters in the playable scene exactly as Hanna does: approach a readable bear and press E/Space/Enter or tap the mobile Talk control. The scene picks the nearest readable bear within normal talk range, and displays E / Talk above it. The dialogue uses the same modal style, pauses movement and NPC wandering, and reads only contributor/letters/{placementId}. Private bears have no letter interaction; no recipient media, seen/progress or finale endpoints are used. The below-world shared-letters panel remains an optional shortcut. Existing opt-in, approval, publication and scene boundaries are unchanged.

## Owner-approved civic plaza replacement (2026-10-18)
The owner supplied a new Tuguegarao reference and requested matching pixel art. The park now uses assets/backgrounds/tuguegarao_park-v2.png and the versioned lossless public WebP, restyled with built-in imagegen. Preserve the civic building behind four lawns and cross paths, central statue, perimeter palms/benches/lamps and the south entrance. This supersedes the earlier empty-courtyard composition; no gazebo is added. Lawns and paths are walkable, with explicit monument, lamp, perimeter and road exclusions at 836x470. Migration 0014 keeps server and client geometry equal and moves only incompatible existing placements to the nearest safe grid point, preserving moderation/publication/author privacy; a wander radius is reduced only if it cannot fit anywhere. Source reference and original artwork remain archived. No new access or content-sharing capability is introduced.

## Park and simplified contributor visits (owner update, 2026-10-18)
The displayed scene name is now Park; retain tuguegarao_park as the stable map key. The redundant Our Little Circle / A few words from her people section and the Your words are with Cj receipt label are removed. Shared text remains available exclusively through the in-world bear Talk interaction, with existing opt-in, approval, session, scene and media privacy checks. Park lawns are lighter while the camera, exact geometry and sprite scale remain unchanged.

## Airy Park and bear monument (owner update, 2026-10-18)
Reduce perimeter lamps, benches and trees substantially, with sparse asymmetric placement and wider clear gaps. All six foreground lamps are removed; migration 0016 removes their invisible blockers without changing existing placements, publication or access. The human monument is replaced by a pale stone chibi bear matching the game sprites on the same pedestal. Keep light lawns, camera angle, main paths, monument footprint and sprite scale. The v4 background uses a versioned URL.

## Automatic invited hellos (owner update, 2026-10-18)
Trusted invite submissions and revisions publish immediately after existing session, scope, consent and attachment validation. Migration 0017 adds service-only atomic instant RPCs; old moderation RPCs remain internal compatibility paths. Validated pending attachments become eligible for Hanna, while rejected/deleted media stay excluded. Randomized sampling selects the safest available gaps using maximum distance from existing published bears and the player start; wander radius is randomized within geometry and spacing limits. An area lock serializes placement. Custom active placement/style is preserved on edits. Explicit hidden/rejected letters and manually unpublished approved bears remain held on edits. Owner expressly requested backfilling all existing pending hellos from active invitations, including randomized placement, preserving author sharing choices. Removed approval-wait copy; contributor text-only sharing and recipient media access remain separately authorized.

## Direct contribution entry (owner update, 2026-10-18)
New and recovered invitation links target /contribute#secret. That page handles the scoped token exchange inline and removes the fragment immediately; fresh links take precedence over an existing invitation session. Returning contributors open the full prefilled editor directly, including saved photos, audio, visibility choice and revision. /invite remains only a compatibility route rendering the same entry and canonicalizing its URL, with no welcome module or extra navigation. Contributor visit replaces the reset CTA with Edit your message; recipient reset stays unchanged. Save returns contributors to their assigned world. No persistent private cache or weaker authorization is introduced.

## Returning invitation destination (owner update, 2026-10-18)
After link exchange, a submitted contributor goes directly to /contribute/visit. A first-time contributor still opens the form. Checked sessions follow the same default; fresh links still override the old session. Explicit Edit your message links use /contribute?edit=1 to open the prefilled editor without redirecting back to the world. The top visitor action bar and Leave for now CTA are removed entirely, including unused styles. Saving edits retains the return-to-world flow. Existing invitation URLs remain compatible; all authorization checks remain in place.

## Contribution voice card and Park preview (owner update, 2026-10-18)
Voice upload and Record a voice note now sit together within A hello in your voice. Its permission/timer/stop/preview/retry/error UI and saved audio attachment playback/removal remain inside that card. The file picker stays available when live recording is unsupported. The private audience label is Just Hanna; access enforcement remains unchanged, with accurate copy stating media are not shared with other invitees. A small static Park example uses public scenery and a code-native bear icon near Send/Save; it is illustrative, not a live scene or a promise to override the invitation’s assigned destination. No private content is loaded in the preview.


## Compact contribution extras (owner update, 2026-10-19)
Photo and voice extras use full-width compact rows, with left-aligned headings and adjacent upload/record actions. Recording feedback and playback expand within the voice row without a blank neighboring column. A freshly recorded clip has one local player and its removal action together; hide the redundant attachment box and inactive file picker while a clip is present. Keep existing media validation, retry, editing and privacy behavior.


## Equal contribution cards (owner clarification, 2026-10-19)
Keep the desktop two-column photo/voice grid with identical compact 230px cards. This supersedes the earlier full-width extras layout. Voice recording, permission, playback, retry and saved-audio controls replace the idle content inside the voice card instead of extending it. Collapse format/help detail during active states, retain an accessible title and use internal scrolling for unusually long errors or enlarged text. Photo attachment previews sit below the grid; voice playback/removal stays within its card. Mobile stacks the same equal-height cards.

## Bear-only restoration (owner update, 2026-10-19)
Character selection and animal sprites are removed at the owner's request. Restore the original bear styles and the static A LITTLE PEEK / Your hello has a place here Park preview in the contribution panel. Migration 0019 reverses the deployed appearance extension, preserving letters, media, placement coordinates, publication and access. Migration 0018 remains in history so existing deployments can migrate forward safely. Do not reintroduce animal selection or art previews.

## In-world windowskin letters (owner update, 2026-10-20)
NPC messages and shared letters now use a JRPG-inspired pixel-bordered window anchored inside the game stage, replacing the centered viewport modal/backdrop. Retain React/Radix focus trapping, accessible title/description, Escape and explicit close. Show the sender's bear portrait and name, page long letters without losing text, and support Enter/Space/right arrow to continue, left arrow/Back to revisit, and 44px touch controls. Text appears immediately with no forced typing delay. Recipient photos/voice notes appear on a separate memories page; voice playback remains user initiated. Shared letters remain text-only and recheck access as before. Pause world movement and Park music while reading. Reserve the window's measured height in the canvas viewport so speakers remain visible, restoring the viewport on close; collision coordinates and stored placement remain unchanged. Reduced motion removes the short window entrance animation. Help and unrelated app dialogs keep their existing presentation.

## Overlay/typewriter refinement (owner update, 2026-10-20)
The windowskin must overlap the full game canvas, with no reserved space or camera/canvas resize. World movement still pauses, but Park music keeps running while letters are open (tab hiding, help and scene-exit behavior remain). Reveal text by grapheme at a gentle typewriter pace; Enter/Space/Show all completes the current page before any advance. Reduced motion shows the complete page immediately; screen readers receive complete page text without per-character announcements. Pagination measures the real rendered lines in the available reading area, preferring authored line breaks and complete sentences, then words only if a passage is too large. There is no fixed character limit per page. Preserve line breaks and every non-whitespace character. Reflow on resizing without skipping the current reading position. Keep media on its separate authorized page. This supersedes the prior instant-text and reserved-viewport instructions.


## Compact Park music player (owner update, 2026-10-21)
Replace the Park greeting overlay for Hanna and invited contributors with a compact player titled Haikyuu!! OST - Adults, a rotating vinyl icon and an accessible play/pause button. The vinyl rotates only during playback; reduced motion stops rotation. Preserve quiet looping autoplay with normal-input fallback, continuous music through letters, tab visibility handling and explicit pause preference. Remove THE OPEN PLAZA caption in Park, the header's A little world, just for you note, and the redundant How to play button/dialog. Keep the movement indicators below the game and existing touch controls. Other scenes retain their greetings until music is supplied.


## Forward-only letters and memory pages (owner update, 2026-10-21)
The windowskin footer is a slim Enter / Space to reveal or continue hint (Tap on mobile). Remove visible previous/next buttons and page counters; the hint remains keyboard/screen-reader operable. Tapping letter text reveals then advances, while selection and interactive controls are ignored. Remove arrow-key page navigation. After text, present authorized attachments individually within an expanded windowskin: one contained photo preview or one user-initiated voice player at a time. Photos retain the full-size link; other contributors still receive opted-in text only. Preserve measured pagination, typewriter, close/Escape, movement pause and continuous Park music.


## Visual placement editor (owner update, 2026-10-27)
Replace manual Foot X/Y and radius entry in Their little places with a scene-backed visual editor. Choose one contributor, drag/tap their bear position, and drag a separate handle or slider to resize the square wander area. Display exact scene collision exclusions and other saved bears. Provide keyboard arrows, touch nudge buttons, zoom/pan, and live safety feedback; disable unsafe saves. Draft changes apply only through the existing explicit Save action and authenticated, server-validated placement endpoint. Preserve publication rules and all saved content. No database migration or automatic repositioning.


## Repeating Park playlist (owner update, 2026-10-28)
Play Haikyuu!! OST - Adults, then the supplied park-frieren.mp3 titled Frieren OST - The Precious Moments We Share, repeating both tracks in order. Update the compact player's title on each transition. Preserve quiet volume, autoplay/gesture fallback, explicit pause preference, tab visibility handling and music during letters. Individual tracks must not loop on their own.


## Windowskin loading animations (owner update, 2026-10-28)
Use a centered opening-envelope animation while recipient/shared letters load, replacing visible loading copy and hiding the continue hint until ready. Screen readers retain a loading status. Authorized photo pages display an animated image placeholder until onLoad; errors stop the animation. Voice notes fetch metadata only when their media page mounts and show a waveform while loading, buffering or seeking, with explicit retry on failure and no autoplay. All loaders have static reduced-motion fallbacks. Preserve privacy checks, media URLs, game pause and uninterrupted Park music.
