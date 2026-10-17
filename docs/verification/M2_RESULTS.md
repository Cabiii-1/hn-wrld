# M2 verification — 2026-10-17

**Status: implementation, automated checks and the hosted synthetic Auth/PostgREST/Storage rehearsal pass.** The owner created `hn-wrld` and authorized connecting it after Docker was unavailable. Physical-device media/recording and browser recovery checks remain before M2 is fully verified. No real contributor content or public deployment was introduced; M3 has not begun.

Follow-up: the owner subsequently approved M3 and exercised invitation/review flows. Recipient implementation and current evidence are in `M3_RESULTS.md`. The pending physical-device release checks below remain open; the historical M2 status above describes that checkpoint.

## Hosted integration follow-up

- Linked only `hxvcbwhaqtpqaokgwojz`; confirmed the fresh project had zero public tables, buckets and Storage policies before migration. `db push --dry-run` listed 0001–0003, then all three applied successfully. All 12 application tables report RLS enabled. The contributions bucket is private.
- Retrieved publishable/secret keys directly into ignored `.env.local` without printing them. Generated invitation pepper and cleanup secret locally. Configured loopback origin `http://127.0.0.1:3000`; this is a local app with a hosted backend, not a deployed site.
- Applied reviewed config changes: public signup disabled globally, email provider enabled for existing administrator password login, Storage limit 15 MiB. Live verification caught that setting `[auth.email].enable_signup=false` disables the email provider too. Corrected the config; real administrator login succeeds while a fresh public signup returns `signup_disabled`.
- `node scripts/smoke-hosted.mjs hxvcbwhaqtpqaokgwojz --allow-test-writes`: **PASS** against real GoTrue/PostgREST/Storage and the running Next development server. Temporary allowlisted admin login succeeds; authenticated non-admin and anonymous admin access fail; foreign Origin writes fail.
- **PASS** invitation exchange for two independently scoped clients; direct signed upload and completion for three synthetic JPEGs and one synthetic two-second MP3; fourth-photo denial; normalized WebP without EXIF; audio Range response; anonymous Storage denial; anonymous and other-contributor media denial; used non-upsert upload token replay denial. Storage OPTIONS accepts the app origin and PUT; actual browser CORS/microphone behavior remains a separate device check.
- **PASS** wrong-invitation attachment submission denial, two concurrent identical HTTP submissions producing exactly one receipt and one conflict, pending parent/media defaults, attachment-review prerequisite, approved safe house placement, anonymous table read denial, rejected-media denial and automatic unpublish, single-file deletion denial, whole-message deletion, and active-session denial after revocation.
- **PASS** cleanup endpoint physically removes eligible synthetic final objects. Only this run's deleted final-object jobs were advanced to eligibility to exercise cleanup; production delays and staging jobs were not shortened. Rehearsal removes its temporary Auth users, invitations, messages, intents and files, and restores scene publication flags. Delayed staging cleanup jobs remain intentionally. No permanent app administrator exists yet.
- Follow-up lint and strict TypeScript checks pass. No application TypeScript changes were needed; this follow-up changes Auth config, adds the repeatable rehearsal and updates documentation.

The following sections retain the original pre-connection verification evidence and its test-layer distinctions.

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

1. The owner has created a confirmed permanent app admin; its allowlist membership was saved and verified after the rehearsal. Test the owner's authenticated desk in the browser with separate contributor profiles. The owner's password has not been requested or handled by the agent.
2. Verify all four supported real audio containers, microphone recording/cancel/retry and interrupted-upload recovery in desktop browsers and on a physical phone, including Safari where available. M1's phone layout confirmation does not verify M2's media workflows.
3. Verify real JWT/session expiry and delayed quarantine cleanup after upload capabilities expire. Immediate replay denial, revocation authorization and eligible final-object cleanup are already covered by the hosted rehearsal.
4. Do not connect the game to real data or start M3 until the remaining device/integration gate passes.

See `docs/SECURITY_M2.md` for the permission model and retained-audio-metadata limitation. The two original seed migrations are preserved; 0003 adds the audited M2 operations. All three are now applied to the explicitly selected hosted development project.
