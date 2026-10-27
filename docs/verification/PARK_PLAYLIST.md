# Park playlist — 2026-10-28

Park alternates Haikyuu!! OST - Adults and Frieren OST - The Precious Moments We Share, repeating in order. The compact player displays the current title; individual audio files no longer use the loop attribute. Existing quiet volume, explicit pause, tab visibility, gesture fallback and continuous playback during letters remain. The supplied MP3 is unchanged and is recorded in assets/manifest.json.

- New file verified as MPEG 1 Layer 3, 1,673,436 bytes, approximately 69.69 seconds.
- 196 tests passed, including playlist order/repeat and pause preservation on transitions. ESLint and production build passed.
- Local browser test used a temporary UI control to seek near each track end: Adults → Frieren → Adults, with actual subsequent playback confirmed. The temporary page was removed before production build.
- Phone 390px: second title shown, audio playing, no document overflow. Screenshot: ignored test-results/park-playlist-phone.png.
