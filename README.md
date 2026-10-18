# Hanna's Little World — starter kit v3

A private, cozy pixel-art world for Hanna: **Sta. Ana family house (with Raze)**, **open Tuguegarao park plaza**, and **SLU entrance in Baguio**. Up to 15–30 contributors share text/photos/voice privately; Hanna talks with their bear NPCs; Cj's ending has a letter, animated reunion and conversation.

## Hosted app

The owner-approved Vercel deployment is live at [hn-wrld.vercel.app](https://hn-wrld.vercel.app), with [admin](https://hn-wrld.vercel.app/admin) and a [synthetic sample world](https://hn-wrld.vercel.app/demo). Personal content still requires the private link plus passcode. Create/share new hosted links from the live admin; existing localhost links stay local. See [deployment verification](docs/verification/VERCEL_RESULTS.md). Personal finale authoring and physical-phone/rights release checks remain open.

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

Run `npm ci` then `npm run dev` from this folder and open http://localhost:3000/demo. This synthetic house preview includes keyboard/touch controls, original animated bear placeholders, explicit collisions, one wandering NPC, and accessible React dialogue. No Supabase project or secrets are required for the demo.

Validate with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. See [Milestone 1 notes](docs/MILESTONE_1.md) and [verification results](docs/verification/RESULTS.md). Production preview: `npm run build` then `npm start`.

## Important
The public demo uses only synthetic content. Contributor content appears only after M3's recipient gate and explicit publication. Never put private messages/uploads in public assets. Background PNGs do not include walkability/collisions. See PRD for safeguards.

## Milestone 2 implementation

Contributor invitations, text/photo/voice submission, private file validation, Cj's authenticated review desk and NPC assignment are implemented. **The owner's hosted `hn-wrld` project is connected and the synthetic live Auth/Storage rehearsal passes.** Physical-phone recording and recovery checks remain tracked for release.

## Milestone 3 implementation

The root page now requires a private recipient link plus passcode. In `/admin`, publish approved placements under **Their little places**, then create a recipient link under **Hanna's little key**. Open that link and unlock to see contributor bears at `/play`, with approved messages/photos/audio and saved seen state. The sample world moved to `/demo`. See [M3 usage and security](docs/MILESTONE_3.md) and [verification](docs/verification/M3_RESULTS.md).

## Milestone 4 implementation

House, open Tuguegarao Plaza and SLU Baguio now have scene navigation, separate safe geometry, published contributor casts and bear variants. `/demo` offers synthetic 1/20/30/50-bear casts for crowd checks. Migration `0005_three_places.sql` is applied to the hosted project. See [M4 usage](docs/MILESTONE_4.md) and [verification](docs/verification/M4_RESULTS.md). Physical-phone performance remains release QA; the finale and deployment are M5.

## Milestone 5 implementation

The private finale editor is under **Cj's little ending** in `/admin`: save drafts, preview, publish a separate snapshot, or unpublish. Hanna's existing private entry unlocks the letter → animated reunion → conversation through a configurable hello threshold, with skip, replay, reduced motion and saved completion. `/demo` has a synthetic ending to try immediately. Migration `0006_private_finale.sql` is applied with an empty unpublished draft; the owner will add personal text later. See [M5 usage](docs/MILESTONE_5.md), [verification](docs/verification/M5_RESULTS.md), and [deployment handoff](docs/DEPLOYMENT.md). Vercel is now connected and deployed; physical-phone/rights release checks remain open.

Follow [M2 setup](docs/MILESTONE_2.md) to create your permanent allowlisted app administrator, then run `npm.cmd run dev` and open http://127.0.0.1:3000/admin. Docker remains an optional local backend. Configuration stays in ignored `.env.local`; setup preserves existing files and never prints keys. `npm run test:db` runs SQL/RLS tests without Docker. See [M2 security audit](docs/SECURITY_M2.md) and [M2 verification](docs/verification/M2_RESULTS.md). Local development remains available; generated loopback invitation links are for local testing only.


## Crochet Friends character selection
Contributors can choose Bear, Turtle, Capybara, Frog, Cat or Bee beside Send/Save. Their selection controls their visitor and the NPC Hanna meets. Existing bears are preserved until an explicit selection. The demo offers all six playable previews and a mixed animal cast. Rebuild native sprites with `npm run art:characters`. See [character PRD](docs/PRD_CHARACTER_SELECTION.md) and [verification](docs/verification/CHARACTER_SELECTION.md), including remaining phone checks.
