# M3 — Hanna's key and connected house

The owner approved M3 on 2026-10-17 after the hosted M2 rehearsal and their own invitation/review use. Physical-phone recording and interrupted-upload checks remain release work; the earlier checklist was not silently marked complete. No M4 scenes or M5 finale are included.

## Use the connected world

1. Sign in at `http://127.0.0.1:3000/admin` with the confirmed, allowlisted app administrator.
2. In **Their little places**, assign a reviewed, approved contribution to **Sta. Ana House**, select a bear style and safe foot coordinates/wander radius, check **Published**, then save. Use separate spawn positions for different bears. Approval alone is not publication. Park/SLU remain drafts until M4.
3. Open **Hanna's little key**. Choose a passcode of at least eight characters, optionally set expiry, and create a recipient link. Copy the fragment link immediately; it is shown once. Keep the passcode privately and share it separately. Creating a link sends no message. Revocation ends all its sessions; forgotten passcodes require a new link.
4. Open that private link and enter the chosen passcode. The fragment is removed from history and sent only in a POST body. `/play` loads approved, published house bears. Approach one and press E/Space/Enter or tap **Talk**. The world pauses while the message is open. Approved photos and user-initiated audio appear only inside the dialogue.
5. Opened hellos save per recipient link in PostgreSQL and survive repeat visits. **Refresh the world** reloads publication changes; returning to a browser tab revalidates access, and visible tabs check every minute. Every new message/media request checks current authorization. **Leave for now** revokes the current visit.

`/` is now the recipient entry. `/demo` contains only synthetic Teddy. `/play` is a generic shell until its protected API succeeds; that path or a link alone exposes no names, messages or media. Existing contributions and placements are preserved; nothing is automatically approved or published. No permanent recipient passcode was chosen for the owner. Loopback links remain local testing links; deployment is M5.

## Authorization

- Migration `0004_recipient_world.sql` binds sessions to links, adds passcode verifiers and RLS-protected `recipient_seen`, and defines service-only recipient functions. Legacy links/sessions without a passcode cannot authorize. Every function checks current session/link expiry and revocation. Browser roles cannot execute recipient RPCs or read progress. Admin link RPCs require the existing JWT-scoped allowlist.
- Node scrypt uses `N=32768,r=8,p=3`, a 16-byte salt and 64-byte key, with 64 MiB maximum memory. Invalid/missing verifiers still perform derivation; comparison is constant-time. Persistent throttling runs first: 20 attempts per trusted address and eight per link per ten minutes. Development retains M2's conservative shared address bucket. Raw passcodes/link tokens are neither stored in DB nor logged by app code.
- Unlock returns `{ok:true}` and a new opaque 256-bit HttpOnly/SameSite=Strict cookie, Secure in production, lasting at most eight hours. DB expiry may shorten a visit. Logout revokes one visit; link revocation ends all visits. Seen state belongs to the link, not the cookie.
- House JSON contains IDs, names, placements/variants and seen flags. Messages load on interaction. SQL requires approved parent + published safe house placement + published area; media additionally needs approval. Recipient JSON excludes hashes, storage paths and moderator metadata.
- Media uses an authorized no-store proxy instead of reusable signed read URLs. Every image/audio/Range request rechecks access; unpublish/rejection/revocation denies future requests. Already-delivered bytes cannot be recalled. Private images bypass the public image optimizer; audio never autoplays.
- Phaser owns sprites, deterministic bounded wandering, feet separation, proximity, animation, Y sorting and camera. The bridge carries the nearest bear ID. Names distinguish bears independently of color; the original template supports cream/scarf/rose-bow styles. React owns entry/dialogue/gallery. M4 still owns crowded-scene/performance tuning.

## Rehearsal

See `verification/M3_RESULTS.md`. With the development app running, use `node scripts/smoke-hosted.mjs hxvcbwhaqtpqaokgwojz --allow-test-writes`. Optional `--browser-check` writes temporary test credentials only to ignored `test-results/m3-browser.json` and waits up to six minutes for `m3-browser.done`; cleanup revokes/deletes them and removes the file. Never commit credentials or screenshots containing real contributions.
