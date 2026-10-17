# M2 security audit and boundaries

## Starter audit

0001/0002 enable RLS and create a private bucket, but do not implement operational authorization. Findings addressed in 0003:

| Gap | Implementation |
| --- | --- |
| Old seaside/tile coordinates | v3 map keys; pixel coordinates and full wander-footprint safety checks in SQL and TS |
| No admin policies | JWT-scoped admin clients; self-only membership SELECT; admin-only SELECT policies; no table writes for browser roles |
| No contributor lifecycle | Token HMACs, short-lived opaque sessions; fresh invitation/session checks; transactional invite locking |
| Race-prone submission/file quotas | RPC transactions, row locks, per-kind active slots, validated attachment ownership/count checks, lifetime reservation cap |
| Missing media review | Each attachment explicitly approved/rejected/deleted; pending attachments prevent parent approval/publication; changes unpublish NPCs |
| No orphan reconciliation | Delayed staging jobs, crash-safe final-object jobs, live-object exclusion and repeatable cleanup |
| Default function EXECUTE exposure | Explicit revoke PUBLIC/anon and allow only authenticated admin RPCs or service-role contributor/maintenance RPCs; fixed search_path |

## Application authorization

The privileged Supabase key is server-only and never used by Phaser or a client component. The service client is used only for narrowly scoped exchange/throttling, freshly authorized contributor workflows, private media delivery after ownership/admin checks, and maintenance. Admin content reads/writes use the user's JWT and DB policies/verified admin functions. `getUser(token)` verifies identity with Supabase Auth on every admin request; membership is rechecked each time. No public sign-up, role claim trusted from a form, browser service key, or client-set approved flag.

Admin access cookie: HttpOnly, SameSite=Strict, Secure in production, ≤1 hour, no localStorage and no client-visible JWT response; no refresh token is persisted. Administrators sign in again after expiry. Removing the admin_members row blocks the next request. Logout clears the cookie. Contributor cookie: 256-bit opaque random token, HttpOnly/SameSite=Strict/Secure in production, ≤2 hours; only its peppered HMAC is stored. Token exchange rotates older sessions. Revoked/expired invite/session denies every later contributor read, validation, submit and media request.

Same-origin Origin checks and cross-site request rejection protect mutations. JSON bodies are stream-counted and bounded, not trusted from Content-Length. Persistent PostgreSQL rate limits fail closed if unavailable; managed Vercel IP headers are used only on Vercel, otherwise a conservative shared local bucket is used. No raw IP is stored. Server errors are sanitized; code does not log SQL parameters, passwords, messages, tokens or signed upload URLs.

## File safety and reads

Reservation authorizes one random quarantine object. Actual bytes are validated before promotion to a different immutable key. A caller cannot attach another invitation's upload or mark an allocation validated. Every media request checks a currently active invitation owner or verified admin; rejected media is hidden from contributors, deleted media is denied to everyone. No recipient reads exist yet. Private responses use private/no-store, Vary: Cookie, no-referrer and nosniff. HTML/text/SVG uploads are rejected. The photo transformation strips metadata and active/trailing content; audio type/track/codec/duration are checked, but arbitrary uploaded audio tags are retained. The media proxy adds a restrictive CSP and never sends original filenames.

This migration grants no storage.objects policies. On an existing Supabase project, audit any pre-existing broad Storage policies separately: schema migrations must not assume unrelated policies are absent. Run on a fresh local project first. Private buckets and noindex headers alone are not authorization.

## Deliberate limits

The owner's fresh hosted development project is configured and has passed the synthetic HTTP rehearsal against real Auth/PostgREST/Storage. No pre-existing public tables, buckets or Storage policies were present. Public signup is disabled, the email provider remains enabled for existing administrators, and all 12 public tables have RLS. Test accounts and objects were removed. Browser microphone, real audio-container samples, cancellation/recovery, expiry and delayed quarantine cleanup still require device testing; checking preflight headers with Node does not establish browser CORS behavior. The earlier unit HTTP tests still use adapter mocks, and PGlite does not validate external services. Known five development ESLint transitive advisories remain from M1; run the recorded audit before release. The game remains synthetic. Recipient authorization and protected recipient media reads must be implemented in M3 before connecting real submissions.
