# Bear-only restoration — 2026-10-19

Owner requested removing the entire character selection extension and returning to the original bear sprites and static Park preview. Application source, form layout, admin styles, public demo and tests are restored to the pre-character-selection implementation (304dfae). Animal assets, art tooling and selection UI are removed. Equal photo/voice cards and recording behavior are retained.

Migration 0018 remains as applied history. Migration 0019 converts animal placements to npc-cream-1, restores the original authorized projections/admin bear-style routine, and removes the character-specific functions/column. Existing bear variants, letters, media, coordinates/radii, publication state and access checks remain intact.

Validation: 169 tests pass across 16 files, including an upgrade/rollback fixture proving a saved Frog becomes a default bear with identical letter and placement metadata. Production build and TypeScript pass. ESLint passes. Migration 0019 applied successfully to the linked Supabase project.
