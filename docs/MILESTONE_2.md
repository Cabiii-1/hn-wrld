# Milestone 2 — contributions and Cj’s desk

Contributor-name update (2026-10-17): the administrator enters **Contributor’s name** when creating an invitation. The contribution form greets them by this name with a friendly note about supporting Hanna through law school, asks only for the message for Hanna and optional media/consent, and omits connection details. Migration `0007_invitation_assigned_names.sql` supplies the scoped name and enforces it for new submissions. Existing submitted names/relationships are preserved; old open forms may still send identity fields, which are ignored.

Follow-up: the owner approved M3 after the hosted rehearsal and their invitation/review use. See `MILESTONE_3.md` for the now-connected recipient house; the M2 device-check limitations below remain tracked for release.

Implemented 2026-10-17 after the owner confirmed the phone layout and approved M2. **Hosted Auth/PostgREST/Storage integration now passes against the owner's fresh `hn-wrld` project.** Physical-device recording and recovery checks remain before M2 is fully verified. The M1 house remains synthetic; no recipient gate or public deployment has been added.

## Hosted development setup (current)

The owner created `hn-wrld` (`hxvcbwhaqtpqaokgwojz`) and authorized its use instead of Docker. The checkout is linked, migrations 0001–0003 are applied, all 12 public tables have RLS, and the `bubu-contributions` bucket is private. Keys were retrieved by the authenticated CLI directly into ignored `.env.local`; never paste them into chat or commit them. `APP_ORIGIN` is `http://127.0.0.1:3000`.

Public signup is disabled globally. Keep `[auth.email].enable_signup=true`: this enables the email provider needed for existing administrator password logins; `[auth].enable_signup=false` blocks new public registrations. This distinction was verified with real login and rejected signup requests. See [Supabase's Auth configuration](https://supabase.com/docs/guides/auth/general-configuration).

1. Create your permanent administrator in [Supabase Authentication → Users](https://supabase.com/dashboard/project/hxvcbwhaqtpqaokgwojz/auth/users), using **Add user → Create new user**, an email/password you choose privately, and email confirmation. A dashboard owner account is separate from an app Auth user.
2. Add its UUID to `public.admin_members` with the SQL shown in local setup step 4 below. Keep passwords and API keys out of chat.
3. Run `npm.cmd run dev` and open **http://127.0.0.1:3000/admin**. Use that exact origin for invitation links and mutations. This remains a local app using the hosted backend; localhost invitation links cannot be sent to other people's devices yet.
4. Repeat the synthetic integration rehearsal when needed with `node scripts/smoke-hosted.mjs hxvcbwhaqtpqaokgwojz --allow-test-writes` while the app runs in development mode. It checks the explicit project URL and loopback app origin, creates temporary accounts and fixtures, tests live authorization/media/moderation, and removes its data afterward. It uses the authenticated CLI to allowlist only its temporary test admin. Delayed staging cleanup jobs remain because issued upload capabilities can outlive revocation. Run only against a development project; do not use it with real contributors.

On Windows, use `npx.cmd supabase login --agent no --output-format text` if PowerShell blocks the `.ps1` launcher. No execution-policy change is needed. The owner has now created a confirmed permanent app user and its admin membership has been saved and verified. All rehearsal accounts were removed. Sign in at the app's `/admin` page with the credentials chosen in Supabase.

## Optional local setup with Docker

1. Install and start Docker Desktop on this computer. No Docker command is currently available here. Node 20.9+ and npm are also required.
2. In this project directory run `npm ci`, then `npm run db:setup`. The project-local Supabase CLI starts the local services and applies pending migrations. This may download large Docker images on first start. No database reset is performed.
3. The script writes keys and random peppers only to ignored `.env.local`, never terminal output. Existing `.env.local` is preserved. `npm run db:status` prints local service URLs only. The API and Studio defaults are `http://127.0.0.1:54321` and `http://127.0.0.1:54323`.
4. Open local Studio → Authentication → Users. Create a confirmed **synthetic test administrator** using credentials you choose there. Public sign-up is disabled. Copy the user's UUID and run the following in Studio's SQL editor, replacing the placeholder with that UUID:

   ```sql
   insert into public.admin_members(user_id)
   values ('REPLACE_WITH_TEST_ADMIN_UUID') on conflict do nothing;
   ```

5. Restart `npm run dev`; open **http://localhost:3000/admin** and sign in. Use the exact `APP_ORIGIN` from `.env.local`: localhost and 127.0.0.1 are distinct origins for mutation checks. Production requires HTTPS; production cookies are Secure. `npm run db:stop` stops containers while preserving local data.

No hosted Supabase account is needed for the Docker option. Do not paste keys/passwords into chat or commit `.env.local`. The setup script preserves an existing environment file; switch configuration deliberately when changing backends. The owner selected the fresh hosted development project above for the live integration gate; no deployment is included here.

## Rehearse with synthetic content

1. On Cj’s desk, create an invitation. Copy the fragment link privately; it can also be recovered later from Invitations → View invitation link. It is not sent to anybody automatically. Older hash-only invitations offer Replace link, which invalidates the old link and sessions while keeping the existing letter.
2. Open the link in a separate browser/profile. It automatically exchanges the token for a scoped HttpOnly cookie and opens the contribution form, with no extra invitation button. The fragment is removed immediately; a failed exchange offers **Try again**. There is no contributor account.
3. Submit sample text with three test photos and one ≤90-second audio clip (or record where MediaRecorder is supported). The optional description/transcript applies to the next attachment. Check consent. Each file uploads directly to private quarantine storage, then is validated server-side; only validated, invitation-owned attachments can be submitted. A failed upload stays removable and retryable; refresh attachments after a network interruption.
4. Confirm the receipt says **received, not published**. On the admin desk, preview the text and each attachment. **Keep** or **Exclude** each attachment before approving the message. You may edit text, reject/hide the parent, delete a single file, or delete the whole contribution.
5. In **Their little places**, save a house placement, for example foot (425,352), radius 20, and an approved bear style. Publishing requires approved text and explicit media decisions. Every subsequent review/edit unpublishes the NPC until it is explicitly published again. Park/SLU assignments can be drafts; publication is blocked until M4 verifies their geometry.
6. Run **Clean up abandoned uploads** on the desk. Repeat after three/four hours to check delayed quarantine cleanup. A bearer-authenticated `POST /api/manage/internal/cleanup` can be called by a trusted scheduler using `CRON_SECRET`; no scheduler is installed or deployed automatically.

The game does **not** read these real database records yet. Recipient link + passcode, recipient sessions, approved scene projection and recipient media access remain M3. There is no public content listing or recipient data endpoint in M2.

## Routes and files

- `/invite` and `/contribute`: mobile-friendly invitation and contribution UI.
- `/admin` (`/admin/login` redirects here): Supabase password login, invitations, review inbox, individual media decisions, and placements.
- `/api/manage/[...path]`: Node route dispatcher. `src/lib/backend/http.ts` authorizes every operation; bounded JSON, same-origin writes, persistent rate limits, secure cookies and sanitized errors.
- `src/lib/backend/contracts.ts`: strict Zod schemas and placement geometry. `security.ts`: token HMACs, limits, range/ownership checks. `media-validation.ts` and `webm-duration.ts`: file inspection and browser-recording timing.
- `supabase/migrations/0003_contributor_admin_workflows.sql`: atomic RPCs, policies, upload intents, persistent throttling, object cleanup and updated v3 map keys. Existing migrations are preserved.
- `supabase/config.toml`, `scripts/local.mjs`, `.env.example`: local services and secret-safe setup.
- `tests/`: request, component, actual SQL/RLS and synthetic media tests.

## Media and service defaults

Three photos, each ≤5 MiB; one audio file ≤15 MiB/90 seconds. Configure lower server limits with `UPLOAD_PHOTO_MAX_BYTES`, `UPLOAD_AUDIO_MAX_BYTES`, `UPLOAD_AUDIO_MAX_SECONDS`; raising hard caps requires a DB migration. Per-invitation lifetime upload budget: 24 reservations, including removed attempts. Requests are additionally throttled in PostgreSQL; all limits persist across server instances. Limits apply before a signed upload is issued and again at validation.

Photos: JPEG/PNG/WebP magic bytes, extension/MIME agreement, successful decoding, 20MP limit, still images only; re-encode to WebP (≤2560px) without EXIF/GPS/trailing content. Audio: MP3, M4A/AAC, OGG (Vorbis/Opus), or single-track unlaced Opus WebM; inspect codec, media tracks and server-derived duration. Browser-style WebM can omit Duration: count Opus packet timing and cluster timestamps, including unknown-size clusters. Unsupported/laced WebM fails closed. Test recordings on the actual target browsers before inviting anyone. Audio is inspected, not transcoded; uploaded audio tags are not stripped. Photo metadata is stripped.

Raw uploads are only under randomized `staging/` paths. Verified bytes go to a separate immutable `validated/` path, so replaying a signed upload token cannot replace approved media. Quarantine URLs last up to two hours; revocation immediately denies validation/reads but cannot cancel an already issued upload capability. Staging deletion is delayed at least three hours; final orphan reconciliation starts after four hours. Active validated and attached files are excluded from cleanup. Admin previews use a cookie-authorized no-store media proxy, including bounded audio Range support, rather than reusable signed read URLs.

## Verification and remaining gate

See `verification/M2_RESULTS.md` and `SECURITY_M2.md`. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. `npm run test:db` exercises actual PostgreSQL via PGlite without Docker.

**Before M2 can be called fully verified:** complete browser and physical-phone file/recording checks, including actual MP3/M4A/OGG/WebM recordings, cancellation/network recovery and expiry behavior. The hosted rehearsal passes the synthetic invitation → direct upload → validation → receipt → admin review → placement sequence, Storage preflight headers, replay denial, private bucket access and physical deletion of eligible synthetic final files. It uses HTTP requests, not a browser enforcing CORS or accessing a microphone. See the verification report for precise limits. Do not proceed to M3 yet.

Returning-contributor update (2026-10-18): migration 0008 adds encrypted admin link recovery and scoped text editing. Reopening a non-expired, non-revoked link shows the saved letter receipt and Edit my letter. Edits preserve attachments, require fresh consent and an unchanged version, reset moderation to pending and unpublish the NPC. Resubmitting a second letter remains blocked.
