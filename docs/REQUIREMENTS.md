# Requirements specification

## Functional
| ID | Requirement | Priority |
|---|---|---|
| F01 | Recipient can enter the protected game | Must |
| F02 | Player moves with keyboard and touch controls | Must |
| F03 | Scenic backgrounds use explicit walkability/collision and camera bounds; tiled reconstruction is optional | Must |
| F04 | Sprite animations: idle/walk in 4 directions (left mirror acceptable) | Must |
| F05 | Assigned NPCs spawn and idle/wander within safe areas without moving through obstacles | Must |
| F06 | Interact within radius through E/Space or touch interaction button | Must |
| F07 | Dialogue shows NPC name and approved message, wrapping/paginating long content | Must |
| F08 | Contributors can submit via individualized expiring/revocable invitation without signup | Must |
| F09 | Admin signs in securely, creates invites and reviews submissions | Must |
| F10 | Only approved, visible submissions can become recipient-facing NPC dialogue | Must |
| F11 | Admin assigns scene, spawn, appearance to NPC | Must |
| F12 | Scene switching between Sta. Ana, Tuguegarao and Baguio | Must |
| F13 | Dudu's finale starts from a defined non-frustrating unlock condition | Should |
| F14 | Seen messages are distinguished subtly, never hidden on replay | Should |
| F15 | User can mute background music and SFX | Should |
| F16 | Admin can revoke invites, unpublish NPCs and delete content | Must |
| F17 | Admin can preview drafts privately before publishing | Should |

## Non-functional
| ID | Requirement | Verification |
|---|---|---|
| N01 | Consentful/private distribution | Access test from unauthenticated incognito browser |
| N02 | No secret or draft exposure | Audit client JS/network payloads, query RLS |
| N03 | Mobile-friendly and touch accessible | 360px wide viewport and midrange phone |
| N04 | Responsive gameplay | Profile ~20 wandering NPCs |
| N05 | Crisp non-blurry pixels | Screenshot inspection at DPR 1, 2, 3 |
| N06 | Reduced-motion and mute preferences | Accessibility smoke test |
| N07 | Readable dialogue (responsive, scrollable) | Long Unicode and emoji message test |
| N08 | Graceful recoverable API failures | Offline/slow network test |
| N09 | Reliable Vercel deployment | Preview/prod smoke checks |
| N10 | Secure data lifecycle | Revocation, unpublish, delete tests |

## Decisions intentionally deferred
Recipient access, contributor scale, media and device support are confirmed in `DECISIONS.md` and PRD v3. Remaining artistic defaults and the exact finale progress threshold do not block M1.

## Confirmed change requirements
- **FR-MOB-01:** Full core game playable by keyboard on desktop and touch-only phone; camera framing, interaction buttons, scroll locking, text sizes, and safe-area insets must work in both modes.
- **FR-ACCESS-02:** Recipient access requires a link-bound random secret AND a separate passcode; check on server, issue secure short-lived HttpOnly session; links alone cannot enumerate content.
- **FR-INV-03:** Invite workflow can create, revoke, resend/reissue, and track 15–30 individually scoped contributor links.
- **FR-MEDIA-04:** Accept optional photos and audio with the per-type size/count/duration rules in DECISIONS.md. Store originals privately with ownership/status references, validate bytes/decoding, and prevent unauthenticated reads.
- **FR-MEDIA-05:** Preview media to contributor during valid scoped session and to admin; include media in recipient NPC dialogue only after both submission approval and placement publication.
- **FR-MEDIA-06:** Media upload failures must be retryable without duplicating submissions or leaving unrestricted orphan uploads; provide cleanup of abandoned uploads.
- **FR-END-07:** Ending sequence includes final letter, scripted animated reunion and final conversation; supports keyboard/touch, replay, skip and reduced motion.
- **NFR-SEC-08:** URLs and caches must not leak content; `Cache-Control: private, no-store` on sensitive responses, restrict CDN caching, `Referrer-Policy: no-referrer` on invite and private routes.
- **NFR-UX-09:** Acceptance testing must cover phone portrait and landscape and desktop viewport, and slow-network/large-message/media-error fallbacks.
- **NFR-A11Y-10:** Photos have optional alt descriptions, audio has optional transcript or caption text, interactive controls are keyboard accessible with labelled focus states; never require audio alone to understand a message.
