# Product Requirements Document (PRD) — Bubu's Little World
**Version:** 3.0 · **Status:** Approved concept / implementation-ready specification · **Updated:** 2026-10-17

## 1. Product vision
Build a private, cozy web-based pixel-art exploration keepsake for **Bubu**. She explores places important to her life and talks to cute bear NPCs representing her family, friends, and loved ones. Each NPC delivers an approved, personally submitted **text message with optional photos and voice recording**. **Dudu** appears in a scripted, replayable finale consisting of a letter, reunion animation, and conversation. The experience is peaceful and revisit-friendly, without combat, quests, monetization or urgency.

## 2. Locked decisions
- **Target devices:** desktop and mobile are equally first-class; keyboard and touch controls and responsive reading UI are mandatory.
- **Recipient privacy:** requires **both a private recipient link AND a passcode**, validated on the server. The game is not indexed or publicly browsable.
- **Scale:** target 15–30 contributors/NPCs across all locations; test with 50 fixtures.
- **Contributions:** required text (1–2,000 characters); optional up to three photos (≤5 MiB each), and optional one audio file (≤15 MiB / ≤90 seconds). File limits are configurable defaults; actual file type/size/duration validated server-side.
- **Finale:** personal letter → animated Bubu/Dudu reunion → final interactive conversation; replay and reduced-motion alternative.
- **Launch date:** TBD; no countdown, expiration-by-launch-date, or hard-coded date locks.
- **Deployment:** Vercel (Next.js) + Supabase; no separate Python backend, multiplayer server, or always-on process.

## 3. World and art direction (LATEST APPROVED)
Create **three separate compact scene backgrounds**, with scene navigation through an unobtrusive map selector/portal; maintain consistent original cute, bright, low-detail, blocky pixel-art with a slightly elevated/front-facing **2.5D scenic view**, **not true isometric**. The provided PNG compositions are the initial visual references and can serve as temporary scene art; backgrounds remain scenic images, not collision or navigation data.

| Scene ID | Final concept | Foreground gameplay | NPC population |
| --- | --- | --- | --- |
| `sta_ana_house` | **Her family house**, not the originally proposed beach. Tree(s) left, fence, house at right, and small cream-colored **Raze** car near the house. Warm homely yard. | Broad open sandy/yard space for player and home/family NPCs. Keep house/car/fence non-walkable. | Family and hometown loved ones |
| `tuguegarao_park` | **Simple open public park/plaza** with trees, benches, lamps around edges, wide paved courtyard. **No central gazebo/building and no flower/plant pots in the foreground**. | Maximize unobstructed floor area for wandering friend NPCs; keep scenery to perimeter. | Friends / larger NPC gathering |
| `slu_baguio` | **Saint Louis University (SLU) entrance-inspired scene**, recognizable covered sign/entrance, stairs, trees, road/crosswalk. | Clearly mark safe playable path/landing; treat road, steps, building as blocked unless deliberately navigable. | Dudu/present chapter and selected friends |

**Scene artwork sources included:** `assets/backgrounds/sta_ana_house.png`, `tuguegarao_park.png`, `slu_baguio.png`. They are provided game art references; confirm rights and optimization before final publication. Their rendered perspective does **not** define physics. Place invisible polygons/rectangles for walkable region, collider geometry, NPC spawn zones and interaction targets. Match sprite foot anchors, visual sizes and Y-sort. If a static PNG does not support foreground occlusion, use a small separate overlay asset only if needed. The original reference images remain in `assets/references/` for aesthetic guidance.

## 4. Audience and roles
1. **Bubu (sole intended recipient):** unlocks with secret link + passcode; explores, interacts, reads and listens, replays scenes and ending.
2. **Contributors (15–30):** each receives a unique secret invitation URL; submits a message, optional photos/audio, and preferred NPC display name; no account.
3. **Dudu (admin):** Supabase Auth + allowlisted admin privileges; issues/revokes invitations, previews, edits/moderates/hides submissions, assigns sprite variants/scenes/spawns, configures finale and publishes.

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
- Invite redeem/validation occurs server-side. Show mobile-friendly form with display name, relationship (optional), message, images and voice upload/record where supported. Provide content warnings about privacy and consent; contributors confirm they have permission to share submitted media.
- Validate required fields, extension **and** actual file types, sizes, image decode, audio duration; strip image metadata where feasible and prevent active content or SVG uploads. Enforce request size limits/upload rules and rate limits; prefer signed scoped direct-to-private-storage uploads.
- Submission remains **pending**, invisible to recipient; admin reviews **text and each attachment** before publishing, can reject/revoke/remove and choose scene, character and coordinates. If attachments are rejected, they are never served in recipient API. Admin can publish text-only if necessary.
- Contributor success screen confirms receipt, **not publication**; no ability to list other contributors' messages.

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
- Complete end-to-end test: contributor submits → admin reviews/approves → correct NPC appears in specified location → Bubu unlocks and speaks → message/media visible only to Bubu → ending reachable and replayable.

## 11. Scope and implementation milestones
1. **Vertical slice / house first:** Next.js + Phaser boot, use actual house background, Bubu temporary sprite, desktop/mobile controls, safe ground collision, one wandering NPC, React dialogue. Mock data only and **no real private messages in client fixtures**.
2. **Contributor and admin backend:** Supabase schema, invite tokens, upload validation/private Storage, pending review, NPC assignment; unit/integration security tests.
3. **Recipient gate and connected data:** link + passcode, recipient sessions, approved NPC loader, private media signed access, seen state.
4. **Full scene roll-out:** wide open park scene, SLU scene, navigation, sprite variants, crowded NPC performance tests.
5. **Finale and finish:** authored letter, reunion animation, final conversation; accessibility, phone/desktop QA, production deploy.

## 12. Out of scope
Multiplayer, live chat, complex pathfinding, procedural maps, paid accounts, AI-generated contributor messages, automatic voice transcription, large RPG mechanics, public message feeds, open registration, monetization and arbitrary user-generated executable content.

## 13. Open non-blocking artistic questions
Final sprite scale and accessories, wording of passcode hint, final Bubu/Dudu authored lines, scene transitions and ambient sound, exact number of NPCs per scene, and whether Bubu can walk up the SLU stairs. Select sensible placeholders without delaying the vertical slice and record assumptions. The surprise date remains unset.
