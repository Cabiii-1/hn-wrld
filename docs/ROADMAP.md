# Implementation roadmap — work in validated vertical slices

## Phase 0 — Decide and bootstrap
Resolve blockers in DECISIONS; setup Next.js TypeScript, shadcn/ui, Phaser 3, Supabase local CLI, environment example, lint/test tooling (Vitest and Playwright), preview deployment; add pixel-art rendering settings. Deliver: basic routes, CI, empty Phaser screen.

## Phase 1 — Game feel / one scene
Use the supplied Sta. Ana house PNG with explicit TS collision geometry, Hanna 4-direction movement/idle/walk, foot-based Y sorting, nearest-neighbor camera scaling, touch/keyboard, one wandering sample NPC, interaction radius and React dialogue. Deliver: verified desktop/mobile synthetic slice. PRD v3's five milestones supersede the older phase grouping below; M2 is backend/moderation, M3 is recipient gate/connected data, M4 is scene rollout, M5 is finale/finish.

## Phase 2 — Contribution lifecycle
Implement DB migration, private invitation exchange, scoped message form (validation/rate limit), admin Supabase Auth with allowlist, submissions inbox, review/approve/reject, placements, recipient auth gate and safe scene API. Replace dummy NPC data with approved server responses. Deliver: end-to-end invite → submit → approve → meet NPC.

## Phase 3 — Additional zones
Build Tuguegarao and Baguio compact maps with consistent scale, map transitions, NPC assignments, variant/accessory generator. Profile NPC wandering/performance. Deliver: 3 navigable places.

## Phase 4 — Finale and polish
Cj scripted message/ending scene, optional visited-progress indicator, save/replay, animations/ambience, accessibility, response to slow loading, texture atlas optimization, on-device QA. Deliver: surprise-ready experience.

## Phase 5 — Privacy + launch rehearsal
Audit RLS, cookies, redirect/token leakage, sensitive network responses, app analytics settings, invite revocation and content deletion. Invite one test contributor; rehearse full recipient playthrough in incognito mobile. Freeze assets and text before launch; publish private URL and backups.

## Priority discipline
For every feature, make the smallest implementable unit, tests, screenshot and note. Avoid implementing full admin placement drag/drop or writing hundreds of sprites before a single approved message can be encountered in-game.

## Revised delivery gates (no fixed surprise deadline)
- **Gate A:** Desktop keyboard and mobile touch both playable in one Sta. Ana scene, including correct camera framing and dialogue scrolling.
- **Gate B:** Invite → text/photo/audio upload → pending preview → admin approval → assigned NPC → gated recipient interaction, with unauthorized tests.
- **Gate C:** Three areas, 15–30 NPC distribution (test with 50), private content fetch and quick loading on mobile.
- **Gate D:** Letter → reunion animation → final conversation, with replay/skip/reduced-motion and authored content configuration.
- **Gate E:** Security, accessibility, on-device QA, private release rehearsal and media deletion/retention checks. Surprise launch date remains TBD; do not infer it.

**Ordering note:** A media-free mocked game scene may be built first to validate game feel; real photo/audio pipeline is mandatory before claiming MVP complete. Use concrete production-like fake test assets without including private contributor submissions in git.
