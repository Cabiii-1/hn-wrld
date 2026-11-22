# Park playlist — 2026-10-28

Park alternates Haikyuu!! OST - Adults and Frieren OST - The Precious Moments We Share, repeating in order. The compact player displays the current title; individual audio files no longer use the loop attribute. Existing quiet volume, explicit pause, tab visibility, gesture fallback and continuous playback during letters remain. The supplied MP3 is unchanged and is recorded in assets/manifest.json.

- New file verified as MPEG 1 Layer 3, 1,673,436 bytes, approximately 69.69 seconds.
- 196 tests passed, including playlist order/repeat and pause preservation on transitions. ESLint and production build passed.
- Local browser test used a temporary UI control to seek near each track end: Adults → Frieren → Adults, with actual subsequent playback confirmed. The temporary page was removed before production build.
- Phone 390px: second title shown, audio playing, no document overflow. Screenshot: ignored test-results/park-playlist-phone.png.

## Scene assignment update - 2026-11-22

Supersedes the earlier Park playlist: Park loops Frieren; SLU loops Haikyuu. The shared compact player retains playback/visibility/gesture behavior and stops the old audio on scene exit. SLU greeting/caption overlays are replaced by the player. Existing audio files are reused.

Production build (including TypeScript), full lint plus lint of subsequent edits, and diff checks passed. The full suite passed 229/231 tests; two contributor tests lacked native media mocks now that their SLU scene includes audio. After adding those mocks, all 20 playback/navigation/contributor tests passed. Coverage checks scene-specific sources and accessible titles/controls, native looping, explicit pause, tab visibility, gesture fallback, scene cleanup and contributor isolation. Browser visual/audio verification is not claimed.
