# Data model and security posture

M5 migration `0006_private_finale.sql` adds RLS-protected `finale_settings` (separate draft/published JSON snapshots and revisions) and `recipient_finale` (per-link completion). Allowlisted admin RPCs use optimistic revision checks. Service-only recipient status/ending/completion RPCs recheck session authorization and progress against the current eligible cast. Required seen count is capped at published, approved, safely placed contributors; no missing-invitation dependency exists. No author text was seeded or published.

M4 migration `0005_three_places.sql` adds RLS-protected `scene_geometry`, exact-union `scene_safe` checks and a service-only `recipient_scene` projection. Admin publication, scene reads, messages and media enforce approved parent + published placement + published area + scene-specific safe bounds for all three maps. Geometry is mirrored from `src/game/scene-geometry.json` and tested for parity. Existing house reads remain compatible. No contributor records are automatically moved or published.

M3 migration `0004_recipient_world.sql` adds per-link passcode verifiers, link-bound sessions, RLS-protected seen state and service-only projections. Admin link RPCs are JWT-scoped and allowlisted. Every recipient function rechecks expiry/revocation, approved parent, published safe house placement and published area; media additionally requires approval. See `MILESTONE_3.md`; earlier notes retain the seed/M2 history.

## Tables
- `areas` (three areas, publish flag, map key)
- `invitations` (hashed token, label, expiry, revoked and limit; never expose to clients)
- `contributions` (invite, display name, optional relationship, message body, moderation status)
- `npc_placements` (approved contribution, map, visual variant, spawn/roam bounds, published)
- `admin_members` (allowlisted Supabase Auth uid)
- `recipient_sessions` and `contributor_sessions` (opaque session digests and expiration; application/server only)

## Key invariants
1. No recipient API returns an NPC unless placement is `published=true` AND linked contribution is `approved` AND area is live.
2. An invite does not grant access to any other submission or to recipient content.
3. Admin identity is authenticated server-side and authorizes moderation/invite operations.
4. Coordinates must lie in safe map bounds and inside designated traversable zones (map-level check in app).
5. Raw invite/access codes never stored in DB or logs; only hashes. Recipient session cookie is `httpOnly`, `secure`, `sameSite=lax`, short-lived.
6. DB tables default to RLS deny for anonymous browser users. Server-only routes should apply authorization in app code even when a privileged key bypasses RLS.
7. Keep data deletion/unpublish possible and define retention after the event.

## How to use starter migration
`supabase/migrations/0001_initial.sql` defines private-by-default baseline schema. **It is not a complete operational backend**: deliberately does not include client-facing write policies or SECURITY DEFINER access functions. Build authenticated route handlers and policies jointly, test with unauthorized identities, and only then deploy.

## Query projection
Recipient scene response example:
```json
{
  "area": {"slug":"sta-ana","mapKey":"sta_ana_house"},
  "npcs": [{"id":"uuid","name":"Sample Friend","message":"Synthetic example only","spriteVariant":"npc-cream-1","x":425,"y":352,"wanderRadius":20}]
}
```
Never return invitation hashes, moderator notes, unapproved texts, session IDs or admin metadata.

Migration 0003 implements M2 contributor/admin operations, upload reservations, rate limits, role-restricted transaction functions and cleanup jobs. Radius is now **world pixels** (0–80), replacing the starter's tile-based 0–12 assumption. No recipient projection is implemented until M3. See `SECURITY_M2.md` for the audited role/grant boundaries and test limitations.

## Media and access schema additions
The follow-up migration `supabase/migrations/0002_media_recipient_gate.sql` adds:
- `contribution_media`: contribution FK, type (photo/audio), private bucket/key, MIME, bytes, status, sanitized descriptive metadata, moderation lifecycle.
- `recipient_access_links`: revocable random link-token digest records separate from the passcode hash in app server secrets/secure server-side verifier.
- private `bubu-contributions` Storage bucket with conservative upload size; backend must still enforce stricter media-specific limits, authorization and content verification.

**Policy:** No generic browser-side `SELECT`/`INSERT` RLS policies on content/media/session tables. All privileged operations are in server-only handlers with tested session authorization. Postgres RLS enabled and deny-by-default. A private bucket alone is not authorization; signed URLs must only be created after the server checks the calling identity *and* parent content approval/publication.

**Important:** Migration 0002 provides storage structure, not a complete upload implementation. Implement pending-file reconciliation, codec sniffing, media metadata verification, EXIF stripping and orphan cleanup in server workflows before production.
