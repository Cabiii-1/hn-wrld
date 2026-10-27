# Windowskin loading — 2026-10-28

Recipient and shared letters now show an opening-envelope animation while fetching. Continue/tap cannot advance during loading; Close and Escape remain available. Letter loading stays screen-reader accessible with no visible loading copy.

Photos keep a stable preview area and image icon until loaded. Voice pages show an animated waveform during metadata loading, buffering or seeking; playback remains manual. Metadata preloads only when the authorized attachment page mounts. Failed loads stop animating; voice notes can be retried explicitly. Existing protected URLs, scoped APIs and opt-in sharing are unchanged. All animation styles disable motion for prefers-reduced-motion.

- 200 tests passed: loading blocks advance, photo load/error states, voice metadata/buffering/seeking/error/retry, existing letter/media/privacy checks.
- ESLint passed. Production build passed after temporary fixture removal.
- Synthetic browser preview: envelope centered, continue hint hidden, animation active; phone 390px has no horizontal overflow. Screenshot saved in ignored test-results/windowskin-loading-phone.png. No database content used or changed.
