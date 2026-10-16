# Acceptance tests / definition of done

M1 phone layout was confirmed by the project owner before M2. M2 automated/database verification and remaining live-stack checks are tracked in `verification/M2_RESULTS.md`; unchecked release items below are not implied complete by that implementation.

## Playable experience
- [ ] WASD/arrow controls move Bubu; left/right display appropriate mirrored walk/idle; no sticky input after tab blur.
- [ ] D-pad or joystick + action button work on portrait phone without unintended page scroll.
- [ ] Player cannot walk into house, car, fence, trees or beyond yard bounds; NPCs remain inside allowed wander regions.
- [ ] Player passes visually in front of/behind props consistently by foot Y-depth.
- [ ] At least one NPC in Sta. Ana emits proximity prompt; E/Space/tap opens its approved text; input pauses while dialogue is shown.
- [ ] 3 locations load without frame jitter, missing tile assets or asset-scaling blur.
- [ ] Long messages in English/Filipino/emoji do not overflow; keyboard/touch can close dialog.
- [ ] A complete finale can be reached without requiring missing contributor replies.

## Submission and admin
- [ ] Unique invitation token leads to submission without signup and cannot access others' submissions.
- [ ] Expired/revoked/exhausted invite does not permit submission.
- [ ] Repeated invalid submissions are limited; invalid/oversized content returns sanitized error.
- [ ] An unauthenticated user cannot access admin endpoints or data.
- [ ] An authenticated non-admin cannot approve content.
- [ ] Unapproved/hidden messages never appear in recipient API, Phaser scene, HTML or network responses.
- [ ] Approved/published NPC appears only in assigned scene; unpublish hides it on next scene load.
- [ ] Contributor deletion/withdrawal or admin delete removes content from recipient API.

## Release gate
- [ ] Lint, typecheck, unit/integration and E2E suite pass in CI.
- [ ] Mobile 360×800 portrait + typical desktop smoke passes; test on one real phone.
- [ ] No secret keys, raw invite tokens or private message text in build logs, analytics or public bundles.
- [ ] Server response caching for sensitive routes disabled and access tokens protected.
- [ ] Invite email/link preview cannot reveal message contents; robots noindex configured.
- [ ] Backup/export plan and rollback noted; consent and content lifecycle are documented.

## Additional release-blocking tests from confirmed choices
- Desktop keyboard-only: traverse each zone, interact, view full long message, play/pause audio, exit/replay finale.
- Phone touch-only (portrait **and** landscape): move, interact, navigate photos, scroll long text, access all ending controls, no overlapping touch hit zones.
- Game link without passcode, wrong passcode, guessed path, expired session and revoked link all return **no private NPC/media content**.
- 15–30 submissions display in intended areas, with no persistent crowding; synthetic test at 50 NPCs.
- Submit text + three accepted photos + one 90-second accepted audio; file number/bytes/MIME/codec/duration violations rejected cleanly.
- Pending/rejected/hidden message and attached media cannot be retrieved by unauthenticated user, different contributor, or recipient; approved but **unpublished** NPC also inaccessible.
- Revoke or unpublish content then verify new protected-media URL requests fail. Note outstanding brief-lived signed URLs in security documentation.
- On failed upload, no orphan is publicly exposed; cleanup/retry works.
- Finale letter, animation and conversation play in order, skip/replay work, reduced-motion alternative is usable, no timed submit dependency.
- Mobile slow connection gracefully handles image/audio failures without losing readable text. No private tokens, passcodes or media URLs in logs, analytics, public source maps, or browser storage.
