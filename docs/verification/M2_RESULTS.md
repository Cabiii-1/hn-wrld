# M2 verification — 2026-10-17

**Status: implementation and automated checks pass; full local Supabase integration is not yet verified.** Docker Desktop is not installed. The owner confirmed the M1 phone layout before approving this phase. No hosted project, real messages, private media or credentials were introduced.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run lint` | PASS, no warnings |
| `npm run typecheck` | PASS, strict TypeScript |
| `npm test` | PASS, 52 tests across 7 files |
| `npm run build` | PASS, production webpack; contributor/admin/API routes build successfully |
| `npm run test:smoke` with production server running | PASS, anonymous private reads denied and response caching/indexing headers checked |
| `npm audit --omit=dev --json` | PASS, zero reported production vulnerabilities |
| Full dependency audit during install | Same 5 high development ESLint transitive advisories noted in M1; no compatible patched path reported |
| Supabase CLI `--version`, `start --help`, `migration up --help` | PASS, project-local CLI 2.121.0 |
| `npm run db:setup` | BLOCKED by missing Docker; exits clearly without writing an environment file |
| `git diff --check` | PASS |

Initial sandbox production build could not create `.next/server/app/admin` (EPERM); the outside-sandbox build passed. The CLI also needed outside-sandbox access to initialize its user configuration. Setup was converted from PowerShell to a cross-platform Node script after the machine's PowerShell execution policy rejected script files; no execution policy was changed or bypassed.

## Automated test layers

| Layer | Count | Verified |
| --- | --- | --- |
| M1 movement regression | 7 | Safe feet, collision, NPC separation/wander bounds, deterministic random sequence |
| Contracts/security | 8 | Random tokens/HMACs, rejected forged fields/consent, strict origin checks, byte-limited JSON, media ownership/rejection, safe placement, audio ranges |
| Media decoding/inspection | 5 | Real generated JPEG decode/re-encode, EXIF removal, SVG/fake bytes/mismatched extensions/oversize denial, synthetic MP3 duration and overlong denial |
| WebM recordings | 4 | Real synthetic Opus silence packets, no Duration metadata, long clips/video denial, malformed/truncated/wrong-track denial, consecutive unknown-size clusters |
| PostgreSQL migrations/RLS | 12 | All three migrations, RLS/grants/admin allowlist, invite expiry/revoke/rotation/reuse, persistent rate limits, 3 photos + 1 audio, ownership/validation/count checks, explicit review/publish gates, geometry parity, delete/unpublish/cleanup, lifetime reservation quota, duplicate queued submission denial |
| HTTP authorization | 10 | Anonymous/forged JWT/non-admin denial, cross-origin denial, forged approval rejection, wrong-owner/rejected/revoked media denial, secure HttpOnly cookie, sanitized backend failures, non-echoing receipt/no-store headers |
| React workflows | 6 | Disabled setup state, token fragment exchange/history clearing, consent and receipt, lost-response recovery, unfinished-upload removal, attachment-first parent review |

The PostgreSQL tests use **actual embedded PostgreSQL (PGlite)**. Only external `auth.users`/`auth.uid` and Storage tables are minimal test shims; the pgcrypto extension declaration is omitted in the harness because gen_random_uuid is built into PostgreSQL. Roles and RLS execute in the database. HTTP tests mock Supabase adapters; React tests mock HTTP. Duplicate requests are queued through the embedded connection, not a multi-connection stress test. Neither these tests nor a successful Next build establish live Supabase Auth, PostgREST or Storage behavior.

## Actual production-preview checks

- `/api/manage/admin/dashboard`, `/api/manage/contributor`, and a guessed media UUID returned **401** without cookies. All returned private/no-store and no-referrer headers.
- `/admin`, `/invite`, and `/contribute` returned 200 generic shells with no-store and noindex; without backend configuration, sign-in and submission controls stay disabled. No private data is rendered.
- Chromium: contributor form at desktop 1280 × 900 and phone 360 × 800, plus admin sign-in and invitation page. Phone document width is 360px with no horizontal overflow. Labels, optional media controls and consent remain readable. Screenshots were inspected after styles settled.
- Visiting the house from the new pages still mounts exactly **one** Phaser canvas, displays the supplied background and greeting, and produces no browser application console errors.
- Client build scan found no test JWT, pepper fixture or synthetic private HTTP-message fixture in `.next/static`. `.env.local`, node_modules and .next are ignored by Git.

Screenshots: `m2-contributor-desktop.jpg`, `m2-contributor-phone.jpg`, `m2-admin-desktop.jpg`, `m2-admin-phone.jpg`, `m2-invitation.jpg`. These show the honest **unconfigured** state, not a fabricated authenticated database session. Authenticated desk interactions are covered by component tests and still require the live rehearsal below.

## Remaining M2 gate

1. Install/start Docker Desktop; run `npm run db:setup`; create a synthetic allowlisted admin using `docs/MILESTONE_2.md`.
2. Rehearse invitation → scoped contributor session → actual signed direct uploads → byte validation → pending receipt → admin text/media review → safe placement, using separate browser profiles.
3. Verify real Auth JWT expiry/non-admin access, anon private Storage reads, Supabase Storage CORS and signed-upload replay/revoke behavior, all four supported real audio containers, browser recording/cancel/retry, and actual object cleanup. Confirm Safari and physical phone file/recording behavior.
4. Verify anonymous/different-contributor access and deleted/rejected media denial against the running stack. Do not connect the game to real data or start M3 until this gate passes.

See `docs/SECURITY_M2.md` for the permission model and retained-audio-metadata limitation. The two original seed migrations are preserved; only 0003 adds the audited M2 operations. No live database migrations have been applied in this environment.
