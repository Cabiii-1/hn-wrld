# Milestone 1 verification — 2026-10-17

## Automated checks

| Check | Result |
| --- | --- |
| `npm run lint` | PASS, no warnings |
| `npm run typecheck` | PASS, strict TypeScript |
| `npm test` | PASS, 7 tests |
| `npm run build` | PASS, production webpack build, no compile warnings |
| `npm audit --omit=dev --json` | PASS, zero production advisories |
| Full `npm audit` | 5 high development-toolchain advisories: braces → micromatch → fast-glob → Next ESLint plugin/config. Registry reports no compatible patched dependency path. Do not force-downgrade Next's lint config to v14. Vitest was upgraded to remove its original critical/moderate advisories. |

Tests cover safe spawn points, car/house/fence/map blocking, diagonal wall sliding, 2,000 movement steps per direction, all points of the rectangular NPC roam region, character feet separation and diagonal speed normalization/seed repeatability.

Initial Turbopack builds failed to start the CSS worker inside and outside the Windows sandbox. Both development and production use the documented `--webpack` option. A Phaser ESM default-import warning was fixed with namespace imports. Dependency download and browser-reachable local server required outside-sandbox execution. Those environmental issues are resolved for the runnable preview.

## Connected Chromium browser observations

Tested the actual running Next.js app, then smoke-checked the production build. Debug URL `/?debug=1` exposes a hidden read-only output of positions, current animation, proximity, paused status and measured FPS for verification; the ordinary route does not create it. No mutable game or diagnostic API is attached to the window.

- Desktop 1366 × 1000, portrait 360 × 800, landscape 800 × 360: canvas renders supplied house art with original Hanna/Teddy sprites. Integer zoom follows the player on cropped views. Portrait/landscape document width equals viewport width; no horizontal overflow.
- Held D input moved Hanna from x=340 to x≈388 in 500ms. Facing and walk/idle state update. Held on-screen right button moved x=340 to x≈393 in 550ms; releasing stops movement. This uses the real pointer handlers, not injected game state.
- E in range opened the React dialogue and focused its return button. Touch/pointer Talk also opened the same complete synthetic English/Filipino/emoji message.
- While dialogue was open, holding W for 600ms left player and NPC coordinates exactly unchanged. Escape closed it and returned focus to How to play. Controls are hidden during modal interaction. Seen indicator changes to “1 hello shared.”
- Portrait controls measure 44 × 44 CSS px for every direction and 75 × 65 for Talk. Landscape measurements are identical. Dialog close button is 44 × 44. Short-screen dialogue scrolls; close remains reachable.
- Sustained keyboard tests: fence stopped foot Y at ≈249.12 (minimum 249); car stopped at ≈295.07 (minimum 295); house stopped at ≈304.06 (minimum 304); bottom edge stopped at ≈423.94 (maximum 424); right edge stopped at ≈796.84 (maximum 797). Player can walk around Teddy after feet separation stops direct movement into the NPC.
- Sampled NPC positions remain within the 405–490 × 330–395 wander rectangle. Both NPC and Hanna pause for help/dialogue and use foot Y sorting.
- Browser console: no application errors during successful scene play. Initial dev-origin restriction was fixed by explicitly allowing the loopback development origin.
- Final `npm start` production smoke: one canvas, no debug output on `/`, no console errors; held pointer movement and tap Talk opened/closed the portrait dialogue successfully. Saved production desktop (1280px default), portrait and portrait-dialogue screenshots. The desktop 1366px and 800px landscape checks were performed against the development build; the production slice uses the same scene and styles.
- Observed desktop renderer samples around 158–180 FPS with **one NPC** on this machine. This is not a physical-phone or crowded-scene performance result.

## Security and scope

Only labelled synthetic text is bundled. No real messages, credentials, passcodes, contributor tokens or user media were added. No Supabase calls occur during M1. Supabase client factory imports `server-only`, validates its environment and uses a publishable key; no service-role credentials exist. Robots metadata and noindex/no-referrer/nosniff headers are configured. These are supplemental headers, not recipient authentication. Existing migrations have not been applied or certified. The recipient gate and private APIs are intentionally deferred per the v3 milestones.

## Evidence and remaining verification

Screenshots in this folder show desktop, portrait and landscape dialogue. Physical touch hardware, mobile Safari, device DPR coverage, tab interruption on a physical phone, and representative midrange-phone performance are **not verified**. Long production-length messages and media belong to later data/UI tests. The synthetic slice is ready for review; the release-wide acceptance checklist remains open.

Next work requires the M2 approval gate: Supabase invitation/media/admin workflows and security tests. No work on M2 has started.
