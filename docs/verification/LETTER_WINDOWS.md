# In-world letter windows — 2026-10-20

NPC letters use an original JRPG-inspired windowskin inside the Phaser stage: dark sage, cream pixel frame, sender name and matching bear portrait, short paged text, Previous/Continue/close controls. Scenery stays visible without a full-screen backdrop. React/Radix retains focus trapping, semantic title/description and Escape. Enter/Space/Right advances from the reading surface; Left revisits pages. Native media controls retain their own keyboard behavior.

Recipient photos and voice notes appear on a final memories page, using the same authorized endpoints and user-initiated audio. Shared letters remain text-only with existing 15-second/tab-return authorization refresh and denial clearing. Game movement and Park audio pause while reading. No database migration, data mutation or access-policy change.

A ResizeObserver reserves the measured window height in the canvas viewport so speakers remain visible. Closing releases that space and returns focus to the canvas. Paging preserves Unicode and paragraph boundaries; text is immediate rather than typed. Large text/media can scroll internally. Reduced motion disables the short entrance animation.

Validation: 178 tests pass across 18 files, including Unicode/long-letter paging, inline containment/no backdrop, touch pagination, Escape, recipient media deferral, and delayed-open viewport reservation/cleanup. Existing contributor privacy and SQL/RLS tests pass. ESLint passes.

Local browser: sample Park Talk opens the windowskin, Enter advances, Previous revisits and Escape closes. The dialog is within game-stage. The phone override produced a measured 375px content width at 844px height; no horizontal overflow, first sample page fits its reading region, touch buttons remain visible, and bears remain above the window. Closing clears the reserved height and focuses CANVAS. Screenshots: ignored test-results/windowskin-desktop.png and windowskin-mobile.png. These are desktop and responsive-browser checks, not physical-phone or microphone tests. No real messages were used.

Final production build passes, including TypeScript and prerendering. Local development hot reload and repeated viewport resizing emitted two WebGL framebuffer warnings; the final loaded sample remained renderable. Hosted runtime verification follows deployment.

Hosted result: 6eeb593 deployed Ready. Production sample Park Talk opens the inline windowskin, Enter advances to the final page, Previous returns, and Escape closes while clearing reserved space and returning focus to CANVAS. Responsive 375px content width was rechecked on the hosted app. No browser errors were reported during these fresh production checks, including the viewport change; the local hot-reload framebuffer warnings did not reproduce. Screenshots: test-results/windowskin-live-desktop.png and windowskin-live-mobile.png. No real submissions or recipient sessions were touched.

## Overlay/typewriter refinement
The owner requested a true overlay, continued Park music, gradual text, and natural page breaks. Canvas reservation/resize code is removed. The soundtrack no longer pauses for letter dialogue; other pause conditions remain.

layoutLetterPages now uses a DOM line-height/width measurement probe rather than a character quota. Authored line breaks take priority, then sentence endings and word boundaries. Long unbroken strings fall back to a fitting Unicode code-point boundary so content always progresses. Paragraph whitespace inside a page remains intact. A character-offset reading anchor preserves the place when responsive layout changes.

TypewriterText reveals whole graphemes every 24ms, supports instant reveal before advance, cancels timers on unmount, and bypasses animation for reduced motion. Screen readers get the complete page without character-by-character live announcements. Unrevealed text reserves its layout, so the window does not move during typing.

182 tests pass, including content preservation, measured line fit, explicit line breaks, complete sentences, no fixed character cap, grapheme reveal, instant finish, reduced motion and reveal-before-advance. ESLint passes. Local browser checks measured the Park canvas at 612px both before and during dialogue; music remained unpaused and its playback time increased while the window was open. Phone content width was 375px at 844px height; landscape was 829px at 390px height. No horizontal overflow, reading scroll height matched the available height, and the reveal-first keyboard flow passed. No real content or database state changed. Screenshots: test-results/windowskin-overlay-desktop.png and windowskin-overlay-mobile.png.

The overlay/typewriter production build passes, including TypeScript and prerendering.

Hosted overlay result: a69ecc3 deployed Ready. After refreshing the promoted bundle, the Park canvas measured 504px both before and during dialogue; no reserved height remained. The supplied soundtrack stayed unpaused and advanced from 15s through 37s during reading. Enter first completed page 1 without advancing, then the next Enter opened page 2 with a partial typewriter reveal. Pagination adapted to 3 pages at that viewport. No production browser errors were recorded. Screenshot: test-results/windowskin-overlay-live.png. Existing real invitation/submission data was untouched.
