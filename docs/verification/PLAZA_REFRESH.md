# Tuguegarao civic plaza refresh — 2026-10-18

The owner supplied the civic-park reference and requested a cute blocky restyle. Built-in imagegen produced the archived v2 PNG; a lossless WebP with a new filename prevents cached old scenery appearing with new collisions. The elevated front-facing view, bear size, integer zoom, follow camera and keyboard/mobile controls remain unchanged.

Explicit 836x470 geometry connects four lawns and cross paths to the southern entrance, excluding the statue, pedestal, front lamps, road and perimeter scenery. Migration 0014 mirrors those boundaries on the server. It relocates only incompatible placements to the nearest safe grid position, preserving publication, moderation, sprite and author privacy; wander radius is capped at 20 only when its prior radius cannot fit anywhere. Existing valid placements stay unchanged.

Validation: all 158 tests passed, including continuous paths around the monument, road/monument collision, 20/30/50-bear simulations in each scene, SQL/client geometry parity, privacy and migration preservation. ESLint and webpack production build/TypeScript passed. Supabase migration dry run passed. Local production server starts successfully; the in-app browser could not reach localhost, so visual browser QA is performed against the deployed synthetic demo.

Migration 0014 applied successfully to the hosted project. All seven existing plaza placements remain safe at their existing coordinates; no bear needed moving. Publication, identity and sprite style were preserved, and live geometry equals the canonical client geometry.

## Lighter lawns and simplified visitor UI
The display name is Park across scene selection and admin (migration 0015, applied). Built-in imagegen edited only lawn colors from v2 into v3; exact layout, camera, safe geometry and scale are retained. A versioned lossless WebP bypasses stale art caches. The redundant shared-letter list and receipt label are removed, including unused list/dialogue wrapper styles. The shared in-world dialogue retains its authorization, pause, opt-out and visibility revalidation. All 158 tests and ESLint passed.
Production webpack build and TypeScript passed after retrying a Windows sandbox output-folder permission failure.

## Sparse perimeter and bear statue
Owner requested fewer lamps, benches and trees with less symmetry, followed by a bear monument. V4 uses four perimeter lamps and four benches with wide uneven spacing, sparse trees/greenery, clear front lawns and a chibi stone bear on the same monument footprint. Built-in imagegen performed both edits; prompts and final PNG are archived. Migration 0016 removes only the six obsolete front lamp blockers; region boundaries and monument exclusions stay the same. Existing safe placements remain valid without moving or changing publication. All 158 tests and lint passed, including removed-lamp walkability, monument exclusion, 20/30/50-bear bounds and server/client geometry parity.
Production build/TypeScript passed. Migration 0016 applied; all seven existing park bears remain safely placed.
