# Agent instructions (Claude Code / Codex)

You are building **Hanna's Little World**, a sentimental, calm browser pixel-art exploration game for one intended recipient. The goal is an emotionally thoughtful, polished experience, not a complex RPG.

## Source of truth
Read README.md and all docs before coding. If implementation conflicts with docs, surface it and update the docs after approval. `docs/DECISIONS.md` lists defaults and blockers.

## Execution discipline
- Work in vertical slices; maintain a runnable app after each task.
- First inspect the repository. Do not overwrite existing work or assume a blank repo.
- Give a brief plan and identify files before modifying code.
- Use TypeScript strict mode, schema validation at API boundaries, deterministic NPC behavior where testable.
- Render game logic in Phaser; render forms/dialogue/admin UI in React/shadcn. Never React-re-render sprites each frame.
- Keep sprite art at native pixel resolution with nearest-neighbor scaling and integer zoom; avoid CSS image smoothing.
- Use collision-based movement, shallow camera framing and Y-depth sorting for top-down/three-quarter front view; no isometric diamond grid.
- NPC wander only within assigned rectangular or polygonal safe bounds; avoid trapping player; pause on interaction.
- Stop movement and close conflicting controls while dialogue is open.
- Use original art matching references as inspiration only, not copied game sprites or trademarks.

## Security / privacy must-haves
- Private invitation tokens are randomly generated, expire if configured, and are stored only as salted/cryptographic hashes in DB. Token in URL is a bearer secret: avoid leaking to analytics/referrers and strip it from browser history after exchange if using redeem sessions.
- Contributors require no account, but each unique invite permits submissions only within its scope and reasonable limits. Server-only verification, Zod validation and rate limiting are required.
- Review/admin authenticated via Supabase Auth with allowlisted admin user IDs; enforce authorization on the server AND RLS, never UI-only.
- The game must not expose unapproved content. Explicit recipient access required; avoid public list APIs and indiscriminate static page pre-rendering.
- Never expose SUPABASE_SERVICE_ROLE_KEY / secret keys in NEXT_PUBLIC_ variables or client bundles. Prefer user-scoped authenticated Supabase clients/RLS; privileged server clients only in isolated server code.
- RLS for every public schema table and restricted storage buckets. Protect any RPC or view from bypassing access controls.
- Don't store unnecessary sensitive contributor info; include deletion/unpublish functions.

## MVP acceptance
See `docs/ACCEPTANCE.md`. Demonstrate keyboard/touch movement, collisions, message interaction, invited contribution, admin approval, and recipient-only retrieval. Add tests for declined/unapproved content and unauthorized queries.

## Deliverables per milestone
1. Working code, migrations, minimal setup docs, example env file (no secrets).
2. Commands run and results, with unresolved warnings disclosed.
3. Screenshots or short video when available.
4. Updated docs and next task suggestions.

## Confirmed directives (2026-10-16)
Never ask again whether device priority, access method, contributor count, media support, finale form, or launch date are decided: **desktop/mobile equal; private link PLUS passcode; 15–30 contributors; text + optional photos/audio; Cj letter + animated reunion + conversation; launch date TBD**. These supersede stale defaults in earlier docs. Treat rich media and dual-device QA as required release scope, not optional enhancements. See `docs/DECISIONS.md` and migration 0002. Start with Sta. Ana scene, but do not declare MVP complete until the media/moderation/privacy tests pass. Implement all content reads behind server-side recipient session checks; never mistake possession of a private URL for authorization.

## Version 3 scene and source-of-truth override
`docs/PRD.md` (v3) and `agent/MASTER_PROMPT.md` are authoritative. First scene is **Sta. Ana HOUSE**, not beach. Park must be an OPEN PLAZA with no gazebo or foreground plant pots; SLU entrance is the third scene. Use supplied scene PNGs under `assets/backgrounds/`, and create collision geometry separately. When any earlier document disagrees, update it to match PRD v3 before implementing that phase.

## Owner-approved contributor visits (2026-10-18)
The requested contributor visit is an explicit narrow exception to recipient-only scenic access: after submission, active contributor sessions may load only their assigned scene and named published bear visuals via contributor_visit. Published bears show their saved contributor display names, as requested by the owner on 2026-10-18. Never expose others’ messages, media, progress or finale; /play still requires recipient authorization. See the Contributor visits update in docs/PRD.md.


## Opt-in letters for invited friends (owner update, 2026-10-18)
This explicitly extends the earlier visual-only visit exception: active submitted contributors can read text-only letters that their authors opted to share, after admin approval and safe publication in the viewer’s assigned scene. Existing letters default to private. The form offers Just Hanna and Cj / Share with invited friends, too; the choice is editable and saved atomically with the letter/version/consent. Edits reset moderation and unpublish the NPC. Photos, voice notes, recipient progress and the finale remain inaccessible to other contributors. No content is public on the internet. The visit projection adds only a readable flag; a separate service-only contributor_shared_message RPC rechecks the viewer session/submission, source opt-in, source invitation expiry/revocation, current moderation/publication, area and safe placement before each read. Shared text is fetched on demand via contributor/letters/{placementId}; scene data never embeds bodies or attachment IDs. The shared-letters panel pauses movement while open and rechecks open text on tab return/every 15 seconds, clearing it on denial. Revoking access or opting out denies subsequent reads. No persistent private cache is added. The general photo description/transcript input and saved-caption editors are removed; existing descriptions are preserved. Migration 0013 implements these changes.


## Shared letters through bear interactions (owner clarification, 2026-10-18)
Invited players open opted-in letters in the playable scene exactly as Hanna does: approach a readable bear and press E/Space/Enter or tap the mobile Talk control. The scene picks the nearest readable bear within normal talk range, and displays E / Talk above it. The dialogue uses the same modal style, pauses movement and NPC wandering, and reads only contributor/letters/{placementId}. Private bears have no letter interaction; no recipient media, seen/progress or finale endpoints are used. The below-world shared-letters panel remains an optional shortcut. Existing opt-in, approval, publication and scene boundaries are unchanged.

## Owner-approved civic plaza replacement (2026-10-18)
The owner supplied a new Tuguegarao reference and requested matching pixel art. The park now uses assets/backgrounds/tuguegarao_park-v2.png and the versioned lossless public WebP, restyled with built-in imagegen. Preserve the civic building behind four lawns and cross paths, central statue, perimeter palms/benches/lamps and the south entrance. This supersedes the earlier empty-courtyard composition; no gazebo is added. Lawns and paths are walkable, with explicit monument, lamp, perimeter and road exclusions at 836x470. Migration 0014 keeps server and client geometry equal and moves only incompatible existing placements to the nearest safe grid point, preserving moderation/publication/author privacy; a wander radius is reduced only if it cannot fit anywhere. Source reference and original artwork remain archived. No new access or content-sharing capability is introduced.
