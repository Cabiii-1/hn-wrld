# Contributions, moderation and emotional reveal

## Contributor workflow
1. Admin creates a personalized, high-entropy invite token with the contributor's name as its label and an optional expiry. This label is the authoritative name saved with new submissions.
2. Admin privately shares `https://<domain>/invite#<token>` (never publish in a group chat for someone else to reuse). The fragment is read only in the browser, removed from history on exchange, and sent in a no-store POST body rather than a server-logged request URL.
3. Opening the link automatically exchanges the token for a scoped, httpOnly, short-lived submission session after server-side digest validation, then redirects to `/contribute` without a CTA. Existing `/invite#token` links keep working. Invalid links show a clear error; failed exchanges offer an explicit retry. Configure referrer policy `no-referrer`, no analytics on invite routes, no indexing.
4. Contributor receives a personal “Hello, [name]!” greeting using their invitation name, writes a message for Hanna, and optionally adds photos/audio. No connection or other identity details are requested. The server derives the saved name from the invitation even if a client submits different identity fields. Explain recipient visibility and allow contributor to request deletion.
5. Submission is `pending`; show thank-you confirmation without any raw token or privileged detail.
6. Admin verifies text, confirms name, sets `approved`, assigns zone and safe NPC spawn. No auto-publish.
7. Recipient's authorized API retrieves only explicitly published NPC/message rows for the scene. Bubu interacts → dialogue opens; don't collect unnecessary personal activity logs.

## Admin actions
Issue/revoke invite, see submission status, edit content with clear attribution, approve/reject, assign NPC visual and map, hide/unpublish, delete/withdraw, recipient preview. Preserve created/updated dates; log significant admin actions if privacy expectations support it.

## Boundaries / content
Do not store private addresses, phone numbers or other personal data unless strictly necessary. A friendly notice should explain the intended audience and that approved submissions become visible in a private game. Allow name aliases and withdrawal requests. Avoid sending previews, messages or secrets to analytics; exclude message text from telemetry and server logs.

## Narrative pacing
Warm welcome → family voices in the Sta. Ana house yard → friends in Tuguegarao plaza → future-facing Baguio → Dudu as last optional heartfelt stop → closing screen thanking her people. The order can be flexible if the recipient prefers roaming. Avoid preventing progress because an invitee did not respond.

## Rich message flow (confirmed)
- Each of the 15–30 invitees gets a separately revocable, scoped invite link. No account required.
- Contribution form: display name, relationship (optional), required text, optional **1–3 photos**, optional **one audio voice note**; accessible previews, file-size/duration validation and explicit permission to share with Bubu.
- To avoid surprises, explain that approved material is displayed **only within Bubu's private game**, that the game owner reviews submissions, and that photos/voice are optional. Do not imply perfect secrecy from server admins.
- Store uploads as pending private objects. A submission may not become visible until both message AND any included media pass approval and NPC placement is published.
- NPC conversation: message body first, then optional photo gallery and tap-to-play voice clip; default silent, full message always readable even if media fails.
- Admin may remove a specific photo/voice without deleting message, hide NPC immediately, or revoke invite. Log moderation actions but avoid storing unnecessary raw personal data.
- Dudu finale: a letter screen with continue/skip → small in-world reunion animation (reduced-motion replacement) → final interactable conversation with replay choice; text authored and editable privately in admin/config, not hardcoded into public scene bundle.
