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
5. Raw invite/access codes are never stored in DB or logs. Verification uses hashes. Migration 0008 additionally stores an authenticated encrypted recovery copy of contributor invitation tokens for allowlisted admin retrieval; the encryption key stays server-side. Recipient session cookie is `httpOnly`, `secure`, `sameSite=lax`, short-lived.
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

Migration 0008 supports returning contributors. `admin_issue_invite` atomically issues or replaces an encrypted recoverable link after an allowlisted JWT check. Replacement revokes old sessions and leaves the existing letter intact. `contributor_snapshot` returns only the active invitation’s letter/version; service-only `edit_contribution` checks scope, expiry/revocation, message length, and optimistic version under row locks. Edits reset moderation to pending and unpublish the NPC without changing attachments. Active links can re-exchange after submission; submission quota enforcement remains in `submit_contribution`.

## Private-page loading (2026-10-18)
Admin, contribution, and recipient pages prepare their first authorized projection during the current server request, reusing the API authorization implementation without an HTTP loopback. The client hydrates that result without repeating the same initial read or flashing a sign-in form. Entry pages reuse the checked session only when no new secret fragment is present; a fresh private link always takes precedence. No authorization result or private projection is cached across server requests or persisted in browser storage. Private pages/APIs retain private no-store responses.

The browser API shares only simultaneous GET requests and discards the promise after completion; writes clear the in-flight lookup. Scene/finale updates remain periodic and revalidate on tab return. The existing world stays mounted while a tab-return check runs, but a denied read clears it. Only public background artwork under /game/backgrounds is browser-cacheable (one hour, stale-while-revalidate up to one day); private text, uploads, links, and credentials are excluded. A full reload still initializes the Phaser canvas.

## Contributor visits (owner update, 2026-10-18)
An invitation now has an administrator-selected place beside the contributor name: Sta. Ana House, Tuguegarao Plaza, or SLU Baguio. Existing placed contributors retain their scene; unplaced invitations default to the house and can be changed in Invitations. The detailed NPC editor defaults to the invitation place and updates that destination when saving another scene. Moving a published bear through Invitations suggests safe default coordinates and unpublishes it until the admin publishes its new spot.

After a successful first submission, a short heart animation transitions to /contribute/visit. Reduced-motion visitors skip the delay. Returning contributors can choose Visit your place from their receipt and go back to edit their letter. The visitor controls their own named bear (assigned style when available, cream otherwise) using keyboard or touch in their designated scene. The visual cast includes only other approved, published, safely placed bears in published areas, with their saved contributor display names (owner update, 2026-10-18). The contributor’s pending letter does not publish their NPC to Hanna automatically.

This is a narrow, visual-only contributor capability, separate from /play. Every contributor visit requires an active, unexpired, non-revoked contributor session AND an existing submission. The service-only contributor_visit RPC returns only map, own avatar name/style and named visual NPC projections using placement IDs. It returns other published contributors’ display names, but never contribution IDs, letters, media, seen state or finale data. Talk controls and interactions are disabled in the renderer and bridge. Recipient endpoints continue to require Hanna’s private link plus passcode session. Revalidate on tab return/every minute and clear the scene on denial. No cross-session or persistent private browser cache is added.
