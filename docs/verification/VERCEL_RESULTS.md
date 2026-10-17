# Vercel deployment — 2026-10-17

The owner signed in, approved project creation and explicitly approved copying the existing server credentials into Vercel Production and deploying.

## Created and deployed

- Workspace: **Cj Cabildo's projects**, existing Hobby plan.
- Project: [hn-wrld](https://vercel.com/cj-cabildos-projects/hn-wrld), imported from `Cabiii-1/hn-wrld`, root `./`, Next.js, branch `main`.
- First verified Production code commit: `90e47737ea2f792090f1f5be52d2e911d37134a5`.
- [Deployment](https://vercel.com/cj-cabildos-projects/hn-wrld/Ac7DAddNuER8R3GQrQCBxqwEJEW8) reached **Ready**, with a successful webpack build and TypeScript check. Production domain: [hn-wrld.vercel.app](https://hn-wrld.vercel.app).
- Six **Production-only Secret variables** were saved: Supabase URL, publishable key, secret key, invitation pepper, cleanup secret and `APP_ORIGIN`. Values were copied privately from ignored `.env.local`, except the origin was set to `https://hn-wrld.vercel.app`. No values were printed, committed or put in URLs. Preview/Development received none of these secrets; local configuration was preserved.
- Vercel lists cron jobs as **Enabled**, with `/api/manage/internal/cleanup` on `0 2 * * *`. This schedules the daily run for 10 AM Asia/Manila, with the one-hour Hobby scheduling window shown in the dashboard. The job was not manually run during verification; its first scheduled execution remains unobserved.

## HTTPS verification

Unauthenticated HTTP checks passed against the stable Production domain:

- **13 private API reads** returned 401 JSON with private/no-store and no-referrer headers: admin dashboard/finale, contributor, legacy house, all three scene projections, ending/status, message/media and internal cleanup.
- Five protected shells (`/`, `/play`, `/admin`, `/invite`, `/contribute`) rendered with 200, no-store and noindex.
- A single POST with a random nonexistent recipient link returned 401 from the configured backend with the correct Production Origin. The same request with a foreign Origin returned 403. This did not create a recipient session or modify contributor content.
- All three supplied WebP background assets returned 200 with image content types.
- The Production entry page rendered the private-link-plus-passcode explanation and the synthetic-demo link. No private names, messages or attachments appeared before authorization.

Saved evidence: [live entry](vercel-live-entry.png), [enabled cleanup schedule](vercel-cleanup-schedule.png). The machine-readable, non-sensitive HTTP report is in ignored `test-results/vercel-production-smoke.json`.

## Follow-up

Sign in at [live admin](https://hn-wrld.vercel.app/admin) with the existing allowlisted administrator. Generate hosted invitation/recipient links there; previously copied localhost links still open localhost. Local and hosted deployments use the same Supabase records, so moderation/publication changes affect both.

The synthetic full workflow and 101 tests passed before deployment (see [M5 results](M5_RESULTS.md)). A fresh authenticated contributor/recipient rehearsal on HTTPS, real-phone touch/performance/Safari recording/recovery checks, background-rights confirmation and the owner's personal finale authoring remain open release work. The GitHub Actions workflow is pushed, but its remote result was not independently verified. No claim is made that the final surprise release checklist is complete.
