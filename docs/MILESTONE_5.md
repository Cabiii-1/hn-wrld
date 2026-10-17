# M5 — Dudu's little ending

The finale implementation is ready for private authoring. The owner chose to add personal text in admin later. Nothing personal or synthetic is automatically published. Production deployment and physical-device release checks remain outstanding; this document does not declare the surprise ready to launch.

## Author privately

1. Open `/admin` and select **Dudu's little ending**. Add the title and letter (up to 12,000 characters), choose the hello threshold (0–50), and add up to 30 conversation lines. Each line has a Dudu/Bubu speaker and up to 2,000 characters; use **Move up** to reorder.
2. **Save private draft** stores your work without changing the published version. **Preview draft** plays your current complete letter, reunion and conversation privately without writing recipient progress. Incomplete drafts may have no letter or no conversation; complete any added lines or remove them before saving.
3. **Publish ending** explicitly publishes a snapshot. **Unpublish ending** hides it while retaining the draft. Saving later edits does not expose them. Concurrent edits are rejected; **Reload saved draft** deliberately replaces unsaved changes with the stored draft.
4. Bubu uses her existing private link and passcode. The ending invitation appears above the world. Its threshold counts only approved, published, safely placed bears in published scenes, and only hellos opened by that recipient link. The requirement is capped at the available cast, so unsubmitted invitations never block it. With zero published bears, a published ending is immediately reachable; choose 0 for immediate access regardless of cast size.
5. Open the letter → **Meet Dudu** → **Talk with Dudu** → advance the conversation → **Keep this little moment**. Completion persists per recipient link and published revision. Replay stays available; publishing a new version makes that version a fresh ending. Draft saves do not reset completion. Newly published bears may change progress eligibility; the server always checks the current requirement.

No personal text is stored in repository assets, client fixtures or browser storage. Plain text is rendered with preserved line breaks and wrapping, not interpreted as HTML. The public `/demo` has **Try sample ending**, which uses clearly labelled synthetic content and makes no private API calls.

## Motion, controls and failure recovery

The reunion is a dedicated Phaser scene using the SLU backdrop and original 32px Bubu/Dudu bear frames. Bubu and Dudu approach and stop together beneath a heart. It replaces exploration while open; Phaser owns animation and React owns reading/buttons. Integer camera zoom and nearest-neighbour sprites preserve the pixel style.

- **Skip letter**, **Skip animation**, back, replay and conversation controls are user-driven, with no required wait or deadline.
- System reduced motion displays a still reunion; anyone can choose **Use a still scene**. The equivalent narrative is readable without canvas or sound.
- Headings receive focus as each phase/line changes. All actions have labelled keyboard controls and at least 44px targets. Long pages scroll naturally on phones.
- Failed background loading retains the narrative and continue controls. Failed completion writes retain the last line and offer retry. Scene re-entry returns to the house with the same server-side progress.
- No ambient audio was added; existing contributor voice clips remain user-initiated with native playback/volume controls. Understanding the finale never requires sound.

## Backend

Migration `0006_private_finale.sql` is applied to hosted `hn-wrld`, with an empty unpublished draft. `finale_settings` and `recipient_finale` have RLS and no anonymous/authenticated table grants. Admin authoring RPCs verify the existing JWT allowlist; recipient RPCs are service-only and recheck active link-bound sessions. Draft and published snapshots are separate. Optimistic revisions prevent lost edits; stale completion and unpublished/revoked access are denied.

Endpoints under `/api/manage`:

| Route                            | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `admin/finale` GET/POST          | Read private draft; save, publish or unpublish with expected revision |
| `recipient/ending/status` GET    | Availability and eligible seen/required counts, never letter content  |
| `recipient/ending` GET           | Freshly authorized, unlocked published sequence                       |
| `recipient/ending/complete` POST | Recheck eligibility/publication/session and persist matching revision |

Responses are private/no-store/no-referrer. Recipient content is fetched only when opening the ending; status refreshes after a hello, on return to the tab, on demand and every minute. Unpublication or access failure clears an open finale on the next status check. Already read content cannot be made unseen; all new reads and writes enforce current access.

See [verification](verification/M5_RESULTS.md), [deployment handoff](DEPLOYMENT.md) and the subsequent [Production verification](verification/VERCEL_RESULTS.md). The owner has now approved the Vercel project and deployment; local CLI linking is unnecessary for the GitHub-managed deployment.
