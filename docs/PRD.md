# Product Requirements Document (PRD) — Hanna's Little World
**Version:** 3.0 · **Status:** Approved concept / implementation-ready specification · **Updated:** 2026-10-17

## 1. Product vision
Build a private, cozy web-based pixel-art exploration keepsake for **Hanna**. She explores places important to her life and talks to cute bear NPCs representing her family, friends, and loved ones. Each NPC delivers an approved, personally submitted **text message with optional photos and voice recording**. **Cj** appears in a scripted, replayable finale consisting of a letter, reunion animation, and conversation. The experience is peaceful and revisit-friendly, without combat, quests, monetization or urgency.

## 2. Locked decisions
- **Target devices:** desktop and mobile are equally first-class; keyboard and touch controls and responsive reading UI are mandatory.
- **Recipient privacy:** requires **both a private recipient link AND a passcode**, validated on the server. The game is not indexed or publicly browsable.
- **Scale:** target 15–30 contributors/NPCs across all locations; test with 50 fixtures.
- **Contributions:** required text (1–2,000 characters); optional up to three photos (≤5 MiB each), and optional one audio file (≤15 MiB / ≤90 seconds). File limits are configurable defaults; actual file type/size/duration validated server-side.
- **Finale:** personal letter → animated Hanna/Cj reunion → final interactive conversation; replay and reduced-motion alternative.
- **Launch date:** TBD; no countdown, expiration-by-launch-date, or hard-coded date locks.
- **Deployment:** Vercel (Next.js) + Supabase; no separate Python backend, multiplayer server, or always-on process.

## 3. World and art direction (LATEST APPROVED)
Create **three separate compact scene backgrounds**, with scene navigation through an unobtrusive map selector/portal; maintain consistent original cute, bright, low-detail, blocky pixel-art with a slightly elevated/front-facing **2.5D scenic view**, **not true isometric**. The provided PNG compositions are the initial visual references and can serve as temporary scene art; backgrounds remain scenic images, not collision or navigation data.

| Scene ID | Final concept | Foreground gameplay | NPC population |
| --- | --- | --- | --- |
| `sta_ana_house` | **Her family house**, not the originally proposed beach. Tree(s) left, fence, house at right, and small cream-colored **Raze** car near the house. Warm homely yard. | Broad open sandy/yard space for player and home/family NPCs. Keep house/car/fence non-walkable. | Family and hometown loved ones |
| `tuguegarao_park` | **Simple open public park/plaza** with trees, benches, lamps around edges, wide paved courtyard. **No central gazebo/building and no flower/plant pots in the foreground**. | Maximize unobstructed floor area for wandering friend NPCs; keep scenery to perimeter. | Friends / larger NPC gathering |
| `slu_baguio` | **Saint Louis University (SLU) entrance-inspired scene**, recognizable covered sign/entrance, stairs, trees, road/crosswalk. | Clearly mark safe playable path/landing; treat road, steps, building as blocked unless deliberately navigable. | Cj/present chapter and selected friends |

**Scene artwork sources included:** `assets/backgrounds/sta_ana_house.png`, `tuguegarao_park.png`, `slu_baguio.png`. They are provided game art references; confirm rights and optimization before final publication. Their rendered perspective does **not** define physics. Place invisible polygons/rectangles for walkable region, collider geometry, NPC spawn zones and interaction targets. Match sprite foot anchors, visual sizes and Y-sort. If a static PNG does not support foreground occlusion, use a small separate overlay asset only if needed. The original reference images remain in `assets/references/` for aesthetic guidance.

## 4. Audience and roles
1. **Hanna (sole intended recipient):** unlocks with secret link + passcode; explores, interacts, reads and listens, replays scenes and ending.
2. **Contributors (15–30):** each receives a unique secret invitation URL; submits a message and optional photos/audio; the administrator assigns their display name through the invitation; no account.
3. **Cj (admin):** Supabase Auth + allowlisted admin privileges; issues/revokes invitations, previews, edits/moderates/hides submissions, assigns sprite variants/scenes/spawns, configures finale and publishes.

## 5. Game UX and interactions
- Entry: private link → passcode screen → authenticated recipient session → short welcome → **house scene** first by default (editable) → park/SLU by portal or scene picker → NPC interactions → finale unlocked by **configurable progress threshold**, not by waiting for all invitations.
- Movement: WASD/arrows on desktop; on-screen directional pad/joystick + contextual action button on mobile; optional tap-to-move is stretch only. Pause player/NPC movement when dialogue or photo viewer is open.
- NPC AI: idle + bounded randomized wander, adjustable radius/speed, simple separation/collision so NPCs do not cluster/occlude the player or block entrances; stop when spoken to. Up to 30 concurrent visible NPCs must be usable on midrange phone; spawn subsets if scene gets crowded.
- Interaction: approach within distance → visible `E / Talk` prompt or mobile tap → accessible React dialogue overlay showing sender name, complete text, optional photo gallery and **user-initiated** audio controls → mark seen → return to scene.
- Names and NPC identity: each contributor has a unique display name and a recolored/accessorized chibi bear sprite from one common template. Never rely on colors alone.
- Art specification: 16×16 reference terrain grid, ~32×32 or 48×48 character sprite frames (select after testing), nearest-neighbor scaling and integer pixel alignment; backgrounds may be much larger scenic images. No character collisions based on entire head/body art; use feet hitbox.
- Responsive stage: a virtual resolution/camera viewport with **cover/crop only for purely scenic portions**, not walkable content. On narrow screens, pan/follow player, adapt bounds/zoom and controls instead of stretching the background. HTML panels stay readable and scrollable.
- Audio: ambient music optional and opt-in or muted by default; messages never auto-play. Respect reduced motion and volume settings.

## 6. Contributor submission and moderation
- Admin generates unique unguessable invite, copies/shares it individually (no account creation).
- Invite redeem/validation occurs server-side. Show a mobile-friendly form with the administrator-assigned contributor name from the invitation label in a personal greeting (no name input), a message for Hanna, images and voice upload/record where supported. Do not request connection or other identity details from invitees. Provide content warnings about privacy and consent; contributors confirm they have permission to share submitted media. This contributor-identity flow was updated at the owner's request on 2026-10-17; the display names were subsequently updated to Hanna and Cj at the owner’s request on 2026-10-18.
- Validate required fields, extension **and** actual file types, sizes, image decode, audio duration; strip image metadata where feasible and prevent active content or SVG uploads. Enforce request size limits/upload rules and rate limits; prefer signed scoped direct-to-private-storage uploads.
- Submission remains **pending**, invisible to recipient; admin reviews **text and each attachment** before publishing, can reject/revoke/remove and choose scene, character and coordinates. If attachments are rejected, they are never served in recipient API. Admin can publish text-only if necessary.
- Contributor success screen confirms receipt, **not publication**; only explicitly shared, approved letters are readable by other submitted invitees through the scoped visit panel.

## 7. Security and privacy requirements
- Recipient authorization: hash and verify link token and passcode on server, limit attempts, create short-lived secure HttpOnly cookie session (`Secure`, `SameSite=Lax/Strict` as appropriate), provide revoke/logout; verify on **every** NPC, media, message, and progress API request. Never embed passcode, approved messages, tokens, or service role key in static public files or `NEXT_PUBLIC_*` secrets.
- Admin: Supabase Auth with explicit admin membership; enforcement server-side and via PostgreSQL row-level security; admin routes not publicly cached.
- Data: Supabase Postgres with RLS for all exposed tables; private buckets and server-authorized short-lived signed URLs for photos/audio. Signed URLs are bearer credentials; keep TTL short and avoid leaking through logs/analytics. Avoid pre-rendering protected content and disable indexing with headers/robots directives as supplementary controls (not authentication).
- Upload security: size/type/content validation, controlled authorized upload paths, quota, revocation/deletion flows; consent and deletion request support.
- Logging: never log message bodies, full invitation tokens, access link tokens, raw passcodes or private attachment URLs.

## 8. Technology and boundaries
- **Next.js App Router + React + TypeScript** for website, contributor form, admin, dialogue, protected server routes.
- **Phaser 3** for game rendering, sprite animations, navigation, proximity, collision, wandering, camera. Keep one Phaser game instance; client-only dynamic loading (`ssr:false` or equivalent boundary), clean teardown. React holds UI state, not frame-by-frame positions.
- **Tailwind + shadcn/ui** for minimal UI, accessible buttons/dialogue/gallery.
- **Supabase** (Postgres, Auth, private Storage, migrations), Zod for validation; Vercel for hosting.
- **Tiled / Aseprite / LibreSprite** optional authoring tools; collision object layers may initially be TS/JSON polygons rather than reconstructing whole PNG into tiles.
- No React-controlled per-frame sprite rendering, realtime presence, Socket.IO, separate FastAPI, Redis or microservices required for v1.

## 9. Functional requirements (must pass)
FR-01 protected two-factor-of-knowledge entry (unique link and independent passcode). FR-02 responsive game on keyboard/touch. FR-03 safe player movement/clipping. FR-04 3 scene transitions. FR-05 NPC wandering per allowed region. FR-06 proximity interaction. FR-07 approved message + optional gallery/audio. FR-08 unique invitation issuance/revocation. FR-09 contributor text/photos/audio submission. FR-10 pending moderation and media review. FR-11 admin assigns sprite/area/position. FR-12 never leak pending/unapproved content. FR-13 optional progress/revisited flags persist. FR-14 ending letter/reunion/conversation with skip/replay. FR-15 account-free contributors; admin login required. FR-16 scene-specific sprite placement and default spawn fallback.

## 10. Nonfunctional and acceptance targets
- Desktop Chrome/Edge and current mobile Safari/Chrome tested with real touch; dialogue buttons at least 44×44 CSS pixels, safe area support, full keyboard form access.
- Asset optimization: compressed WebP/PNG backgrounds where safe for crisp art, lazy-load scenes, avoid shipping photos/audio until interaction; handle slow networks gracefully.
- Performance goal: **≥30 FPS** on representative midrange phone with 20 active NPCs during movement; instrument and report, not promise without measurements.
- Gate/privacy tests: wrong/missing link, wrong passcode, revoked link, unauthorized guest, invalid contributor token, rejected media, forged approved status, expired signed URLs all denied.
- No crash if a contributor submits no audio, if an optional photo fails, or if an NPC has not yet been assigned a sprite.
- Complete end-to-end test: contributor submits → admin reviews/approves → correct NPC appears in specified location → Hanna unlocks and speaks → message/media visible only to Hanna → ending reachable and replayable.

## 11. Scope and implementation milestones
1. **Vertical slice / house first:** Next.js + Phaser boot, use actual house background, Hanna temporary sprite, desktop/mobile controls, safe ground collision, one wandering NPC, React dialogue. Mock data only and **no real private messages in client fixtures**.
2. **Contributor and admin backend:** Supabase schema, invite tokens, upload validation/private Storage, pending review, NPC assignment; unit/integration security tests.
3. **Recipient gate and connected data:** link + passcode, recipient sessions, approved NPC loader, private media signed access, seen state.
4. **Full scene roll-out:** wide open park scene, SLU scene, navigation, sprite variants, crowded NPC performance tests.
5. **Finale and finish:** authored letter, reunion animation, final conversation; accessibility, phone/desktop QA, production deploy.

## 12. Out of scope
Multiplayer, live chat, complex pathfinding, procedural maps, paid accounts, AI-generated contributor messages, automatic voice transcription, large RPG mechanics, public message feeds, open registration, monetization and arbitrary user-generated executable content.

## 13. Open non-blocking artistic questions
Final sprite scale and accessories, wording of passcode hint, final Hanna/Cj authored lines, scene transitions and ambient sound, exact number of NPCs per scene, and whether Hanna can walk up the SLU stairs. Select sensible placeholders without delaying the vertical slice and record assumptions. The surprise date remains unset.

### Returning invitation links (owner update, 2026-10-18)
The admin Invitations tab must allow viewing and copying new invitation links through authenticated, no-store endpoints. Store only encrypted recovery copies alongside verification hashes, with the decryption key kept server-side. Older hash-only links require explicit replacement; preserve their letter, invalidate the old token and sessions, and retain expiry/revocation. Invitees can reopen active links and edit their existing letter text with fresh consent and optimistic concurrency. Updates return the letter to pending moderation and unpublish the NPC until reviewed again. Keep unmodified attachments unless explicitly removed during a media revision; continue to enforce one letter per invitation.

## Contributor visits (owner update, 2026-10-18)
An invitation now has an administrator-selected place beside the contributor name: Sta. Ana House, Tuguegarao Plaza, or SLU Baguio. Existing placed contributors retain their scene; unplaced invitations default to the house and can be changed in Invitations. The detailed NPC editor defaults to the invitation place and updates that destination when saving another scene. Moving a published bear through Invitations suggests safe default coordinates and unpublishes it until the admin publishes its new spot.

After a successful first submission, a short heart animation transitions to /contribute/visit. Reduced-motion visitors skip the delay. Returning contributors can choose Visit your place from their receipt and go back to edit their letter. The visitor controls their own named bear (assigned style when available, cream otherwise) using keyboard or touch in their designated scene. The visual cast includes only other approved, published, safely placed bears in published areas, with their saved contributor display names (owner update, 2026-10-18). The contributor’s pending letter does not publish their NPC to Hanna automatically.

This is a narrow, visual-only contributor capability, separate from /play. Every contributor visit requires an active, unexpired, non-revoked contributor session AND an existing submission. The service-only contributor_visit RPC returns only map, own avatar name/style and named visual NPC projections using placement IDs. It returns other published contributors’ display names, but never contribution IDs, letters, media, seen state or finale data. Talk controls and interactions are disabled in the renderer and bridge. Recipient endpoints continue to require Hanna’s private link plus passcode session. Revalidate on tab return/every minute and clear the scene on denial. No cross-session or persistent private browser cache is added.


## Full contribution editing (owner update, 2026-10-18)
Returning invitees can edit their message, add/remove/replace up to three photos and one voice clip (90 seconds), and revise saved photo descriptions/voice transcripts in the full contribution form. Migration `0012_edit_contribution_media.sql` adds scoped attachment metadata and an atomic, version-checked revision RPC. Retained files must belong to the existing letter; new files must be validated, unexpired and owned by the invitation. Saving requires fresh consent, resets the parent to pending and unpublishes its NPC. New files and changed captions require review; rejected files remain rejected. Removed files are queued for private Storage cleanup only after save. Cancel leaves saved attachments unchanged and discards draft uploads. Active draft quotas and HTTP rate limits apply across revisions, without a lifetime cap on deleted upload history. The old text-only edit API remains compatible and preserves attachments.

## Voice recording feedback (owner update, 2026-10-18)
Invited contributors must see clear microphone-opening, active-recording and saving states. Active capture shows a prominent indicator, elapsed time and a clear Stop recording control on desktop and mobile, respecting reduced motion. Stopped recordings have immediate local, user-initiated playback while the private upload and server validation finish; keep that player mounted so finishing the save does not interrupt listening. Failed saves retain the local clip for retry or discard. Release microphone tracks and temporary playback URLs when no longer needed. Recording and playback use native browser APIs; the 90-second limit, consent and moderation remain unchanged.


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

## Park soundtrack (owner update, 2026-10-19)
Park plays the supplied Haikyuu!! - Adults (Extended).mp3 as a quiet loop, with no visible audio controls. Applies to recipient, contributor and sample Park worlds only. Try automatic playback when the scene is ready; if the browser denies autoplay, retry on normal touch/pointer/keyboard input. Pause during letters/help/finale, when the tab is hidden and on scene exit; preserve playback position through temporary pauses. No database or contributor content changes.

## In-world windowskin letters (owner update, 2026-10-20)
NPC messages and shared letters now use a JRPG-inspired pixel-bordered window anchored inside the game stage, replacing the centered viewport modal/backdrop. Retain React/Radix focus trapping, accessible title/description, Escape and explicit close. Show the sender's bear portrait and name, page long letters without losing text, and support Enter/Space/right arrow to continue, left arrow/Back to revisit, and 44px touch controls. Text appears immediately with no forced typing delay. Recipient photos/voice notes appear on a separate memories page; voice playback remains user initiated. Shared letters remain text-only and recheck access as before. Pause world movement and Park music while reading. Reserve the window's measured height in the canvas viewport so speakers remain visible, restoring the viewport on close; collision coordinates and stored placement remain unchanged. Reduced motion removes the short window entrance animation. Help and unrelated app dialogs keep their existing presentation.

## Overlay/typewriter refinement (owner update, 2026-10-20)
The windowskin must overlap the full game canvas, with no reserved space or camera/canvas resize. World movement still pauses, but Park music keeps running while letters are open (tab hiding, help and scene-exit behavior remain). Reveal text by grapheme at a gentle typewriter pace; Enter/Space/Show all completes the current page before any advance. Reduced motion shows the complete page immediately; screen readers receive complete page text without per-character announcements. Pagination measures the real rendered lines in the available reading area, preferring authored line breaks and complete sentences, then words only if a passage is too large. There is no fixed character limit per page. Preserve line breaks and every non-whitespace character. Reflow on resizing without skipping the current reading position. Keep media on its separate authorized page. This supersedes the prior instant-text and reserved-viewport instructions.


## Compact Park music player (owner update, 2026-10-21)
Replace the Park greeting overlay for Hanna and invited contributors with a compact player titled Haikyuu!! OST - Adults, a rotating vinyl icon and an accessible play/pause button. The vinyl rotates only during playback; reduced motion stops rotation. Preserve quiet looping autoplay with normal-input fallback, continuous music through letters, tab visibility handling and explicit pause preference. Remove THE OPEN PLAZA caption in Park, the header's A little world, just for you note, and the redundant How to play button/dialog. Keep the movement indicators below the game and existing touch controls. Other scenes retain their greetings until music is supplied.


## Forward-only letters and memory pages (owner update, 2026-10-21)
The windowskin footer is a slim Enter / Space to reveal or continue hint (Tap on mobile). Remove visible previous/next buttons and page counters; the hint remains keyboard/screen-reader operable. Tapping letter text reveals then advances, while selection and interactive controls are ignored. Remove arrow-key page navigation. After text, present authorized attachments individually within an expanded windowskin: one contained photo preview or one user-initiated voice player at a time. Photos retain the full-size link; other contributors still receive opted-in text only. Preserve measured pagination, typewriter, close/Escape, movement pause and continuous Park music.
