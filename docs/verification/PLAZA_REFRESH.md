# Tuguegarao civic plaza refresh — 2026-10-18

The owner supplied the civic-park reference and requested a cute blocky restyle. Built-in imagegen produced the archived v2 PNG; a lossless WebP with a new filename prevents cached old scenery appearing with new collisions. The elevated front-facing view, bear size, integer zoom, follow camera and keyboard/mobile controls remain unchanged.

Explicit 836x470 geometry connects four lawns and cross paths to the southern entrance, excluding the statue, pedestal, front lamps, road and perimeter scenery. Migration 0014 mirrors those boundaries on the server. It relocates only incompatible placements to the nearest safe grid position, preserving publication, moderation, sprite and author privacy; wander radius is capped at 20 only when its prior radius cannot fit anywhere. Existing valid placements stay unchanged.

Validation: all 158 tests passed, including continuous paths around the monument, road/monument collision, 20/30/50-bear simulations in each scene, SQL/client geometry parity, privacy and migration preservation. ESLint and webpack production build/TypeScript passed. Supabase migration dry run passed. Local production server starts successfully; the in-app browser could not reach localhost, so visual browser QA is performed against the deployed synthetic demo.

Migration 0014 applied successfully to the hosted project. All seven existing plaza placements remain safe at their existing coordinates; no bear needed moving. Publication, identity and sprite style were preserved, and live geometry equals the canonical client geometry.
