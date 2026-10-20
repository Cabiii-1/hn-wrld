# In-world letter windows — 2026-10-20

NPC letters use an original JRPG-inspired windowskin inside the Phaser stage: dark sage, cream pixel frame, sender name and matching bear portrait, short paged text, Previous/Continue/close controls. Scenery stays visible without a full-screen backdrop. React/Radix retains focus trapping, semantic title/description and Escape. Enter/Space/Right advances from the reading surface; Left revisits pages. Native media controls retain their own keyboard behavior.

Recipient photos and voice notes appear on a final memories page, using the same authorized endpoints and user-initiated audio. Shared letters remain text-only with existing 15-second/tab-return authorization refresh and denial clearing. Game movement and Park audio pause while reading. No database migration, data mutation or access-policy change.

A ResizeObserver reserves the measured window height in the canvas viewport so speakers remain visible. Closing releases that space and returns focus to the canvas. Paging preserves Unicode and paragraph boundaries; text is immediate rather than typed. Large text/media can scroll internally. Reduced motion disables the short entrance animation.

Validation: 178 tests pass across 18 files, including Unicode/long-letter paging, inline containment/no backdrop, touch pagination, Escape, recipient media deferral, and delayed-open viewport reservation/cleanup. Existing contributor privacy and SQL/RLS tests pass. ESLint passes.

Local browser: sample Park Talk opens the windowskin, Enter advances, Previous revisits and Escape closes. The dialog is within game-stage. The phone override produced a measured 375px content width at 844px height; no horizontal overflow, first sample page fits its reading region, touch buttons remain visible, and bears remain above the window. Closing clears the reserved height and focuses CANVAS. Screenshots: ignored test-results/windowskin-desktop.png and windowskin-mobile.png. These are desktop and responsive-browser checks, not physical-phone or microphone tests. No real messages were used.

Final production build passes, including TypeScript and prerendering. Local development hot reload and repeated viewport resizing emitted two WebGL framebuffer warnings; the final loaded sample remained renderable. Hosted runtime verification follows deployment.
