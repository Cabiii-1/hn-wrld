# Agent instructions (Claude Code / Codex)

You are building **Bubu's Little World**, a sentimental, calm browser pixel-art exploration game for one intended recipient. The goal is an emotionally thoughtful, polished experience, not a complex RPG.

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
Never ask again whether device priority, access method, contributor count, media support, finale form, or launch date are decided: **desktop/mobile equal; private link PLUS passcode; 15–30 contributors; text + optional photos/audio; Dudu letter + animated reunion + conversation; launch date TBD**. These supersede stale defaults in earlier docs. Treat rich media and dual-device QA as required release scope, not optional enhancements. See `docs/DECISIONS.md` and migration 0002. Start with Sta. Ana scene, but do not declare MVP complete until the media/moderation/privacy tests pass. Implement all content reads behind server-side recipient session checks; never mistake possession of a private URL for authorization.

## Version 3 scene and source-of-truth override
`docs/PRD.md` (v3) and `agent/MASTER_PROMPT.md` are authoritative. First scene is **Sta. Ana HOUSE**, not beach. Park must be an OPEN PLAZA with no gazebo or foreground plant pots; SLU entrance is the third scene. Use supplied scene PNGs under `assets/backgrounds/`, and create collision geometry separately. When any earlier document disagrees, update it to match PRD v3 before implementing that phase.
