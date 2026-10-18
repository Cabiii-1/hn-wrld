# Contributions, moderation and emotional reveal

## Contributor workflow
1. Admin creates a personalized, high-entropy invite token with the contributor's name as its label and an optional expiry. This label is the authoritative name saved with new submissions.
2. Admin privately shares `https://<domain>/invite#<token>` (never publish in a group chat for someone else to reuse). The fragment is read only in the browser, removed from history on exchange, and sent in a no-store POST body rather than a server-logged request URL.
3. Opening the link automatically exchanges the token for a scoped, httpOnly, short-lived submission session after server-side digest validation, then redirects to `/contribute` without a CTA. Existing `/invite#token` links keep working. Invalid links show a clear error; failed exchanges offer an explicit retry. Configure referrer policy `no-referrer`, no analytics on invite routes, no indexing.
4. Contributor receives a personal “Hello, [name]!” greeting using their invitation name, writes a message for Hanna, and optionally adds photos/audio. No connection or other identity details are requested. The server derives the saved name from the invitation even if a client submits different identity fields. Explain recipient visibility and allow contributor to request deletion.
5. Submission is `pending`; show thank-you confirmation without any raw token or privileged detail. Active invitation links can be reopened to edit the existing letter text (no duplicate submission). The scoped snapshot includes only that invitation’s letter and version. Edits require fresh consent and an unchanged version, reset the parent to pending, and unpublish its NPC until reviewed again; existing attachments are preserved. Expiry and revocation still apply.
6. Admin verifies text, confirms name, sets `approved`, assigns zone and safe NPC spawn. No auto-publish.
7. Recipient's authorized API retrieves only explicitly published NPC/message rows for the scene. Bubu interacts → dialogue opens; don't collect unnecessary personal activity logs.

## Admin actions
View/copy invitation links, explicitly replace legacy links, issue/revoke invite, see submission status, edit content with clear attribution, approve/reject, assign NPC visual and map, hide/unpublish, delete/withdraw, recipient preview. Preserve created/updated dates; log significant admin actions if privacy expectations support it.

## Boundaries / content
Do not store private addresses, phone numbers or other personal data unless strictly necessary. A friendly notice should explain the intended audience and that approved submissions become visible in a private game. Allow name aliases and withdrawal requests. Avoid sending previews, messages or secrets to analytics; exclude message text from telemetry and server logs.

## Narrative pacing
Warm welcome → family voices in the Sta. Ana house yard → friends in Tuguegarao plaza → future-facing Baguio → Dudu as last optional heartfelt stop → closing screen thanking her people. The order can be flexible if the recipient prefers roaming. Avoid preventing progress because an invitee did not respond.

## Rich message flow (confirmed)
- Each of the 15–30 invitees gets a separately revocable, scoped invite link. No account required.
- Contribution form: personal greeting using the administrator-assigned invitation name, required text, optional **1–3 photos**, optional **one audio voice note**; accessible previews, file-size/duration validation and explicit permission to share with Bubu.
- To avoid surprises, explain that approved material is displayed **only within Bubu's private game**, that the game owner reviews submissions, and that photos/voice are optional. Do not imply perfect secrecy from server admins.
- Store uploads as pending private objects. A submission may not become visible until both message AND any included media pass approval and NPC placement is published.
- NPC conversation: message body first, then optional photo gallery and tap-to-play voice clip; default silent, full message always readable even if media fails.
- Admin may remove a specific photo/voice without deleting message, hide NPC immediately, or revoke invite. Log moderation actions but avoid storing unnecessary raw personal data.
- Dudu finale: a letter screen with continue/skip → small in-world reunion animation (reduced-motion replacement) → final interactable conversation with replay choice; text authored and editable privately in admin/config, not hardcoded into public scene bundle.

## Returning contributors (2026-10-18)
New invitation URLs can be retrieved from the authenticated admin Invitations tab. The database stores an AES-256-GCM encrypted recovery copy bound to the invitation ID, alongside the verification HMAC; a server-only, domain-separated key is derived from INVITE_TOKEN_PEPPER. No raw tokens are stored. Admin-only no-store endpoints decrypt one requested link. Pre-existing hash-only links cannot be recovered: Replace link requires an explicit warning, rotates the token, revokes old sessions, preserves the existing letter and retains expiry/revocation rules. Never share links publicly. Changing the pepper invalidates both token verification and recovery.

## Contributor visits (owner update, 2026-10-18)
An invitation now has an administrator-selected place beside the contributor name: Sta. Ana House, Tuguegarao Plaza, or SLU Baguio. Existing placed contributors retain their scene; unplaced invitations default to the house and can be changed in Invitations. The detailed NPC editor defaults to the invitation place and updates that destination when saving another scene. Moving a published bear through Invitations suggests safe default coordinates and unpublishes it until the admin publishes its new spot.

After a successful first submission, a short heart animation transitions to /contribute/visit. Reduced-motion visitors skip the delay. Returning contributors can choose Visit your place from their receipt and go back to edit their letter. The visitor controls their own named bear (assigned style when available, cream otherwise) using keyboard or touch in their designated scene. The visual cast includes only other approved, published, safely placed bears in published areas, with their saved contributor display names (owner update, 2026-10-18). The contributor’s pending letter does not publish their NPC to Hanna automatically.

This is a narrow, visual-only contributor capability, separate from /play. Every contributor visit requires an active, unexpired, non-revoked contributor session AND an existing submission. The service-only contributor_visit RPC returns only map, own avatar name/style and named visual NPC projections using placement IDs. It returns other published contributors’ display names, but never contribution IDs, letters, media, seen state or finale data. Talk controls and interactions are disabled in the renderer and bridge. Recipient endpoints continue to require Hanna’s private link plus passcode session. Revalidate on tab return/every minute and clear the scene on denial. No cross-session or persistent private browser cache is added.
