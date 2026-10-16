# Bubu's Little World — starter kit v3

A private, cozy pixel-art world for Bubu: **Sta. Ana family house (with Raze)**, **open Tuguegarao park plaza**, and **SLU entrance in Baguio**. Up to 15–30 contributors share text/photos/voice privately; Bubu talks with their bear NPCs; Dudu's ending has a letter, animated reunion and conversation.

## Agent quickstart
1. Open this folder in Claude Code or Codex.
2. Read `AGENTS.md`, `docs/PRD.md` and `agent/MASTER_PROMPT.md` (then remaining docs).
3. Paste the contents of `agent/MASTER_PROMPT.md` as kickoff instructions.
4. Start with **only the house playable vertical slice**.

## Stack
Next.js App Router / React / TypeScript / Tailwind / shadcn/ui / Phaser 3 / Supabase PostgreSQL + Auth + private Storage / Zod / Vercel.

## Files
- `docs/PRD.md`: authoritative v3 scope and acceptance criteria.
- `agent/MASTER_PROMPT.md`: agent-ready execution prompt.
- `assets/backgrounds/`: three flattened landscape reference/scene art PNG files.
- `docs/`: existing architecture, requirements, test, data, and art notes (some v2 guidance superseded by PRD v3).
- `supabase/migrations/`: starter schema, audit and adjust before production.

## Milestone 1 implemented

Run `npm ci` then `npm run dev` from this folder and open http://localhost:3000. This synthetic house preview includes keyboard/touch controls, original animated bear placeholders, explicit collisions, one wandering NPC, and accessible React dialogue. No Supabase project or secrets are required yet.

Validate with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. See [Milestone 1 notes](docs/MILESTONE_1.md) and [verification results](docs/verification/RESULTS.md). Production preview: `npm run build` then `npm start`.

## Important
The game still uses synthetic content. Never put contributor messages/uploads in public assets or connect them to the game before M3's recipient gate. Background PNGs do not include walkability/collisions. See PRD for safeguards.

## Milestone 2 implementation

Contributor invitations, text/photo/voice submission, private file validation, Dudu's authenticated review desk and NPC assignment are implemented. **Live Supabase integration verification is pending Docker Desktop**, which is not installed in the current environment.

Install/start Docker Desktop, run `npm run db:setup`, create a local test admin as described in [M2 setup](docs/MILESTONE_2.md), then restart `npm run dev`. Open `/admin` to create invitations. The setup script preserves existing environment files and never prints keys. `npm run test:db` runs SQL/RLS tests without Docker. See [M2 security audit](docs/SECURITY_M2.md) and [M2 verification](docs/verification/M2_RESULTS.md). No hosted project or deployment is required or performed.
