# Architecture proposal

M1 implementation: `/` serves a synthetic local house preview, with `GameBridge`, `HouseScene`, a pure TS foot-collision resolver and original runtime bear frames. No protected routes or database access are implemented yet. The following routes describe the later production design; `/` must become the recipient gate before real content is connected. See `MILESTONE_1.md`.

M2 update: `/admin`, `/invite#token` and `/contribute` are implemented with the `/api/manage/` server namespace. The game remains synthetic. Admin cookies carry a verified Supabase access token, contributor cookies carry opaque session secrets, and private media is proxied after authorization. Fragment invitation links replace token-bearing route paths to avoid token leakage in request/access logs. See `MILESTONE_2.md`; live local Supabase validation is pending Docker Desktop. The route list below is the broader release design, not a list of completed endpoints.

## System boundaries
```
Bubu browser ───────► Next.js App Router on Vercel ◄──── Contributor browser
  Phaser canvas             │                          invitation form
  React UI/dialogue         │ secure route handlers
                            ▼
                 Supabase Auth + Postgres + Storage
                            ▲
                     Admin dashboard
```

## Routes
- `/` recipient landing / unlock gate
- `/play` client-only Phaser scene and React dialogue controls
- `/invite#token` short-lived invitation exchange, token fragment stripped on exchange, no third-party scripts, noindex
- `/contribute` recipient-specific authorized submission session
- `/admin/login`, `/admin/invites`, `/admin/submissions`, `/admin/npcs`, `/admin/preview`
- `/api/recipient/scenes/[slug]` authenticated, approved and published scene projection only
- `/api/contributions` token-session-protected submission
- `/api/admin/invites` admin-only invite creation/revocation
- `/api/admin/submissions/[id]` admin-only moderation and placement

## Client scene design
Next.js renders shell and accessible controls; Phaser mounts **only on client** through dynamic import. `GameBridge` typed events `NPC_NEAR`, `NPC_INTERACT`, `DIALOGUE_OPEN`, `DIALOGUE_CLOSE`, `ZONE_CHANGE`, `LOAD_ERROR` connect scenes to React state. Scenes never query Supabase directly: fetch a sanitized scene projection from the server. Server-returned IDs/labels, spawn coordinates, variant keys and approved text are all validated.

Scene modules: `BootScene`, `PreloadScene`, `StaAnaScene`, `TuguegaraoScene`, `BaguioScene`, `FinaleScene` (last can be React overlay). Common modules: `PlayerController`, `NPCWanderController`, `InteractionManager`, `TileCollision`, `GameBridge`, `CameraScaler`.

## Mobile and rendering
Keyboard WASD/arrows + E/Space; touch D-pad plus large context action. On-screen controls avoid covering interaction dialogue. Browser tab blur pauses input; touch movement supports pointer cancel. Disable pinch/scroll only inside game input region, never entire contributor/admin document. Handle high DPI and browser resize. No image smoothing. Prefer fixed logical resolution with integer scaling and optional edge crop/letterboxing, tested on portrait and landscape.

## API / auth
Use Supabase Auth for admin allowlisted users. Recipient receives short-lived server-set httpOnly session cookie after private unlock (implemented as signed session or database-bound opaque session); never a hardcoded public client password check. A contributor's invitation exchanges to scoped server-side session, with token DB digest, expiry, revoked status, max usage and rate limit checks. All privileged operations executed server-side and protected by RLS/security boundaries. For the admin, prefer user JWT-scoped clients with RLS rather than a blanket service role. If using service-role key in Vercel server code, isolate it from importable client modules and do explicit authorization checks before every query.

## Data / caching
Supabase Postgres with RLS. Game fetches small JSON per scene; no direct open database access. Mark API routes as dynamic and `Cache-Control: private, no-store`. Avoid putting approved message content in public static assets, build artifacts, edge caches, SEO metadata, or client prefetched routes accessible before unlock. Asset art can be public because it is non-sensitive.

## Deploy
Vercel Next.js frontend/API; Supabase managed DB/Auth/Storage. Environment example: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable), server-only `SUPABASE_SECRET_KEY` (if necessary), `APP_ORIGIN`, `SESSION_SIGNING_SECRET`, `INVITE_TOKEN_PEPPER`. Set environment separately for preview/prod; rotate secrets and revoke old sessions if compromised. If Supabase uses a newer publishable key variant, adapt names accordingly.

## Realtime not required
Only approved content is loaded when player changes zone or reloads; editing while Bubu is playing need not push realtime updates.

## Confirmed architecture extensions

### Two-factor-by-knowledge recipient gate (not MFA)
- The **private link carries a high-entropy recipient-link token** distinct from the passcode (not an auth account).
- The recipient enters passcode on a server-rendered gate; server validates link-token digest and a deliberately slow password hash of the passcode (Argon2id preferred), applies throttling/temporary lockout, and issues an HttpOnly `Secure`, `SameSite=Lax`, short-lived recipient session cookie. Handle link secret via exchange flow; do not expose it in query strings to third-party assets or logs.
- Passcode is supplied and stored via secret management; never embed it in client code, static JSON, public environment variables or source control. A leaked private link *alone* must not grant game access.
- All private API routes and media delivery endpoints check server-issued sessions. Tokens may be rotated/revoked. Document re-entry/recovery UX without weakening the gate.

### Contributor uploads and protected delivery
1. Contributor redeems a high-entropy invite for a short-lived, HttpOnly invitation-scoped session. Upload initiated with a signed, limited upload target or server streaming endpoint after authorization, file count/size/type checks and rate limits.
2. Upload to a **private** Supabase Storage bucket at a randomized object path; create `contribution_media` rows in `pending` state. Require content sniffing, actual image decode/audio metadata probe and audio duration limits; reject SVG/HTML, executables, polyglots, and oversize uploads. Use safe rendering and `Content-Disposition` where applicable.
3. Admin previews authorized media, approves or rejects text and linked media together. Only approved contributions with published placements are projected into recipient responses. Do not return raw Storage paths or permanent public URLs to recipient.
4. Recipient requests a short-lived authorized media URL or protected stream. Server checks session + parent contribution approval + NPC publication before issuing. Don't cache media URLs in localStorage or telemetry. When revoked/unpublished, URLs may remain valid briefly until expiry; keep TTL very short and consider proxy streaming for strict instant revocation.
5. Orphan upload expiration/reconciliation, revocation, deletion and lifecycle cleanup are required. Strip EXIF GPS from photos and consider image normalization before sharing.

### Recommended app routes
- `POST /api/recipient/unlock` — validate link + passcode, set session cookie; rate limit.
- `POST /api/recipient/logout` — revoke cookie/session.
- `POST /api/contributions/media/init` and `POST /api/contributions/media/complete` — scoped uploaded media lifecycle.
- `GET /api/media/[id]` — authenticated media proxy or signed URL broker; applies context-dependent authorization.
- `GET /api/recipient/ending` — recipient-only authored sequence; no public static access.

### Device behavior
Responsive Phaser canvas uses crisp integer scaling where feasible, adapts logical viewport/aspect without stretching or cropping critical gameplay UI, and keeps browser-visible controls accessible. React manages touch input, focus, dialogue and media players; Phaser moves sprites from an input abstraction. Audio clip playback is explicitly user-initiated.
