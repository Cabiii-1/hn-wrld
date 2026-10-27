# Visual placement editor — 2026-10-27

The admin placement tab now edits one selected contributor on their scene background. Original bear proportions, foot anchors and exact 836×470 collision geometry are preserved. Other saved bears appear faintly. Dragging the bear changes its foot position; a separate radius handle/slider changes its square wander bounds. Unsafe drafts disable Save. The existing authenticated endpoint and database validation remain unchanged.

Desktop and phone controls include keyboard arrows (Shift for larger moves), 44px nudge buttons, radius slider, and optional 1:1 zoom/pan centered on the selected bear. Pointer cancellation restores the pre-drag draft; secondary pointers cannot end the active drag. Zoomed scenery swipes pan without moving the bear. Changes remain local until Save.

Verification uses a temporary local-only synthetic fixture, removed before build/deployment. No real database rows were created, edited or deleted.

- Full suite: 193 tests passed before the final zoom regression test. Final placement suite: 7 tests passed. ESLint and production build passed.
- Browser: drag moved (470,290) to (500,313), preserving grab offset. Resizing to radius55 marked an obstacle collision and disabled Save; shrinking to zero re-enabled it. Synthetic save payload matched the visual draft.
- Scene switch to SLU selected its (430,360) safe start and background.
- Phone390px: no horizontal document overflow; nudge controls44×44px. Zoom uses836px map with native horizontal scrolling and centers the bear.
- A fresh browser page had no console errors after correcting SVG title hydration.
