# Milestone 1: Sta. Ana house

Implemented 2026-10-17 against PRD v3 and `agent/MASTER_PROMPT.md`. This is a synthetic local prototype, not the protected recipient release. No later milestone is implemented or deployed.

## Run

From `bubu-world-starter`, use Node 20.9+ and run `npm ci`, then `npm run dev`. Open http://localhost:3000 (or http://127.0.0.1:3000). No Supabase credentials are required for M1. `npm run build` and `npm start` run the production preview. Webpack is explicit because this Windows environment failed to start Turbopack's CSS worker even outside the sandbox.

## Implementation

- Next.js App Router, React, strict TypeScript, Tailwind 4, locally owned shadcn-style Button and Radix Dialog components with focus trapping, Escape and labelled controls.
- Client-only Phaser 3 instance; Phaser owns all animation, positions, camera and collision. React receives only status, proximity and interaction events. Effect cleanup destroys the game, removes window listeners and resets input.
- Actual 1672 × 941 house PNG. Coordinates use an approximately half-size 836 × 470 world. Integer camera zoom and nearest-neighbor textures; follow camera preserves access to the entire yard in narrow/short viewports. Scenic sky/roof may crop; ground remains reachable by walking.
- Explicit safe yard, separate house/flowerbed and Raze car rectangles, 14 × 7 feet footprint, separate-axis collision/slide and capped movement delta. Trees/fence remain beyond the upper safe boundary. No collision inferred from pixels.
- Original 32 × 32 bear frames, four facing directions (left mirrors right), idle/walk states, foot Y sorting, rose bow for Bubu and sage scarf for Teddy. Reduced motion stops decorative idle cycling.
- One seeded, slow, bounded wandering NPC. Small feet separation leaves routes around Teddy. Approach within 78 world units to talk.
- WASD/arrows; E/Space/Enter. On-screen D-pad supports held pointers, pointer capture, cancellation and key operation. Talk button is contextual. Blur/visibility changes reset input; help and dialogue freeze both characters and hide controls.
- Complete synthetic English/Filipino/emoji dialogue with scrollable responsive reading card. Seen indicator is in memory only. No private content, analytics, audio, uploads or database requests.
- Supabase dependency and a server-only, Zod-validated client factory prepared for later authenticated workflows. Existing seed migrations are retained and unapplied; M2 must audit them. No service-role key or passcode exists in the app.

## Main files

`src/game/world.ts` defines collision and movement; `house-scene.ts` owns gameplay; `bear-art.ts` generates original art; `bridge.ts` connects input/UI events. `src/components/world.tsx` owns the page, controls and dialogue; `game-canvas.tsx` owns loading/teardown; `src/components/ui/` owns UI primitives. `assets/manifest.json` records asset sizes/provenance. `tests/world.test.ts` checks safe movement and deterministic wandering.

## Verification

See `docs/verification/RESULTS.md` for actual commands, browser observations, screenshots and remaining limitations. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before changes are accepted.

## Deliberate limits and next gate

The artwork is temporary supplied art; its final publication rights are unconfirmed. No real phone or Safari was available: connected Chromium viewport and pointer tests do not establish physical phone performance. One-NPC desktop FPS is not the later 20–30 NPC phone target. PNG optimization and final sprite polish remain future work.

Stop here. M2, after approval: audit Supabase migrations/RLS; implement scoped invites, validated private photo/audio uploads, admin authentication/moderation and safe scene assignments, with authorization tests. M3 implements the recipient link + passcode gate before any real message is loaded. Never deploy this public synthetic route with personal content.
