# Confirmed decisions and remaining non-blockers

**Confirmed by project owner on 2026-10-16. These override earlier defaults in all documents.**

| Decision | Final requirement |
|---|---|
| Primary devices | Desktop **and mobile equally**, both release-blocking |
| Recipient access | **Private link + passcode**, required together |
| Expected contributors | **15–30** invited people (capacity test at 50 NPCs) |
| Contribution format | **Text with optional photo(s) and optional audio/voice recording** |
| Dudu finale | **Personal letter + animated reunion scene + final interactive conversation** |
| Surprise date | Not decided: **no hard deadline**, keep milestones flexible |
| Privacy | Recipient-only approved messages and attachments; pending submissions admin-only |

## Implementation defaults (not additional blocking questions)
- Working title **Bubu's Little World**; three final locations: Sta. Ana family house (Raze car), open Tuguegarao park (no gazebo/foreground planters), SLU Baguio entrance.
- Static, original, non-isometric three-quarter/front-view pixel maps with 16px terrain and 32px character frames; inspect art references as inspiration, not production-licensed assets.
- Keyboard: WASD/arrows plus E/Enter to interact; mobile: virtual directional pad/joystick plus contextual interaction button. Touch controls must not obscure dialog.
- Unique invited links, one submission per invite. Plain message required, 1–2000 characters; photo/audio optional. Upload **up to 3 photos**, each ≤5 MiB, JPEG/PNG/WebP; **one audio file** ≤15 MiB, ≤90 seconds, MP3/M4A/OGG/WebM (validate actual codecs, not just extension/MIME). Limits are design defaults adjustable via config.
- Contributor media visible to the contributor only in their active, scoped submission session, and to admin. Recipient sees it **only once parent submission is approved and NPC is published**.
- Recipient can replay ending and revisit world. Reveal is progress-driven, not real-date-driven; do not gate on every contributor having submitted.
- No contributor accounts required; admin via Supabase Auth + explicit admin allowlist; browser receives short-lived media access URLs only after server authorization.
- Quiet background audio default and obvious opt-in/volume controls; uploaded voice clips only play on user action.

## Remaining optional creative decisions (do not block vertical slice)
- Exact House details, Tuguegarao park decorations, SLU entrance interaction bounds; day or sunset palette.
- Sprite accessory set, nickname labels and dialogue languages (Filipino/English/Ilocano/Ibanag mixtures).
- Exact reunion animation beats, timing and Dudu's final letter text; add editable placeholders.
- Confirmed 2026-10-18: invitees may reopen active links and edit their letter text. Each edit returns the parent to pending and unpublishes its NPC; unchanged photos/audio are preserved. No duplicate letter is created. Admin can recover new links or explicitly replace older hash-only links.
- Launch date, once known, determines freeze and test schedule, not product architecture.

## Completion policy

M5 defaults (2026-10-17): owner will author the letter/conversation later in the private admin editor. Initial finale is unpublished. Default hello threshold is 3, capped at the current eligible cast; 0 means immediate entry. Reunion uses the SLU entrance with Bubu and Dudu meeting beneath a heart, plus a still alternative. No ambient track or launch deadline was introduced. Deployment remains pending a Vercel connection and release QA.

M4 implementation assumption (2026-10-17): SLU's lower central and lower left stair flights and connecting sidewalk are navigable. Upper stairs, building, retaining walls and road are blocked. The plaza is the preferred large gathering area; maintain room between real placements on SLU's narrow walkway.
The agent must not re-ask the six confirmed choices above. Ask only if a new *blocking* contradiction emerges; otherwise implement the defaults and record them.
