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
