# Deployment and release handoff

The app builds locally and the owner's hosted Supabase project has migrations through `0006_private_finale.sql`. No Vercel project link or local Vercel login was found during M5 implementation, so **no public deployment was created**. Physical-phone QA and background-rights confirmation remain required by PRD v3 before final publication. The owner will author the finale privately in admin.

## Prepared configuration

- GitHub Actions runs lint, tests, production build and typecheck on Node 24 with read-only repository permissions. It needs no production keys; embedded PostgreSQL tests run without Docker. The workflow is prepared locally and has not yet run on GitHub.
- `vercel.json` selects Next.js, `npm ci`, the webpack production build and a daily cleanup request at 02:00 UTC. `package.json` pins Node 24.x, which [Vercel supports](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- `/api/manage/internal/cleanup` accepts GET for Vercel cron and retains POST for other trusted schedulers. Both require the matching `Authorization: Bearer …` secret. Missing/wrong credentials fail before backend work. [Vercel sends the configured CRON_SECRET](https://vercel.com/docs/cron-jobs/manage-cron-jobs) automatically for cron requests. Cleanup processes at most 100 eligible objects per run; the admin cleanup action remains available for an unusual backlog. Staging quarantine is not shortened.

## Connect the deployment

1. [Import the GitHub repository into Vercel](https://vercel.com/docs/git) as a Next.js project. The repository's application is at its root; use root directory `.`. Keep preview access restricted and do not add analytics to secret-link pages.
2. Configure these **server-only** environment variables in the intended Vercel environment, using the existing ignored local values privately: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `INVITE_TOKEN_PEPPER`, `CRON_SECRET`, and `APP_ORIGIN`. Do not paste values into Git, issue descriptions or chat. Do not add `NEXT_PUBLIC_` prefixes. Keep the existing pepper when retaining the same Supabase invitation/session hashes. [Environment variable changes apply to subsequent deployments](https://vercel.com/docs/environment-variables).
3. `APP_ORIGIN` must be the exact HTTPS origin used to open the app, with no path. Pin one stable domain for recipient links. Each preview needs its own matching origin and should use a separate Supabase project for synthetic tests; do not point arbitrary previews at personal data.
4. Deploy, then create **new** recipient/contributor links from that origin. Old localhost links remain localhost links. Do not change Supabase public-signup or Storage privacy to make deployment work. Existing password-based admin sign-in does not require OAuth redirects.
5. Verify unauthenticated `/play` and admin cannot retrieve scene, ending, message or media content; verify security/no-store headers. Check wrong passcode, revocation and logout on the HTTPS deployment. Run a fresh synthetic invite → media → approval → placement → recipient → ending rehearsal, preserving real records.
6. Verify scheduled cleanup in the Vercel dashboard. Never put the cron secret in a URL; do not disable its authorization for a health check.

## Remaining release verification

Complete the existing [acceptance criteria](ACCEPTANCE.md) on a physical phone in portrait and landscape and on desktop: touch/keyboard movement, all camera edges, scene switching, 20 active NPCs at ≥30 FPS, 30-NPC usability, long Unicode text, gallery/audio, Safari recording, interrupted upload recovery and the full finale including reduced motion/skip/replay. Browser viewport emulation is already checked but does not establish device performance or real touch behavior.

Confirm permission to publish supplied background artwork. Add and privately preview the authored letter/conversation; publish only when ready. No launch date or deadline was introduced.

## Backup and rollback

Before release, make an owner-controlled Supabase database backup and a separate private Storage export. Verify the project's backup/restore capability in its dashboard; do not assume a plan includes a particular retention period. Store exports encrypted outside this public repository and include the private finale in the data lifecycle/withdrawal policy.

Keep the known-good Git commit and matching environment settings. If access or content looks wrong, revoke affected recipient links and unpublish the finale/placements from admin. Revert the Vercel deployment to a tested build compatible with migration 0006; do not drop tables or undo migrations against live personal data. New finale tables and RPCs are additive and preserve the M4 house/scene APIs. Restore backups only through an owner-approved recovery procedure.
