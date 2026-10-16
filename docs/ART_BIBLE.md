# Art bible and animation specifications

## Reference interpretation
PRD v3 is authoritative: the first scene is the **Sta. Ana family house and yard**, with trees left, fence, house right and cream Raze car. The other scenes are an open Tuguegarao plaza without a gazebo or foreground planters, and the SLU entrance. Use the supplied scenic PNGs with separately authored collision geometry. Keep the cute blocky three-quarter/front-facing view; no true isometric grid. Bear references guide rounded chibi proportions, warm cream/brown palettes, blush and simple facial detail. References are inspiration, not permission to trace or redistribute third-party art. M1 uses original 32px programmer-art bears; see `assets/manifest.json`.

## Art constraints
- Choose a **single consistent native pixel grid**; prefer 16×16 terrain and 32×32 character cell for MVP. Character visual silhouettes may exceed collision footprint.
- No interpolation, blur, fractional camera zoom or misaligned pixel outlines.
- Warm restrained colors and 1–2 px dark outline; consistent light direction; avoid excessive glossy gradients.
- Each NPC recolor should remain distinguishable via accessories/palette and visible nameplates on interaction; color alone should not encode role.
- Draw pixel tiles, original hand-crafted landmarks and modular props. Avoid tiny real-world logos or exact architecture until approved.

## Player sprite sheets
- Bubu and Dudu: idle_down/up/side: 2–4 frames each; walk_down/up/side: 4–6 each; blink/small emote optional.
- NPC shared template: idle_down/up/side, walk_down/up/side; mirror left/right unless asymmetry requires dedicated art.
- Make frame dimensions, origin (feet), fps and frame order explicit in a generated atlas JSON or TypeScript configuration.
- Prototype suggestion: 32×32 frame, feet anchor (0.5,0.88), 8 FPS walking; adjust after visual test.
- Animation map: `idle-down`, `idle-up`, `idle-side`, `walk-down`, `walk-up`, `walk-side`; `talk` can use idle + a subtle emote.

## Tilesets / layers
- **Sta. Ana:** warm broad front yard, left-side trees, fence, house and cream Raze car. House/car/fence are blocked.
- **Tuguegarao:** broad open paved plaza; trees, benches and lamps at the perimeter; no gazebo or foreground planters.
- **Baguio:** SLU-inspired entrance/sign, stairs, trees and crosswalk; safe path separated from blocked road and building.
- Map layers bottom-up: scenic background, floor, low decor, collision geometry, walkable characters (depth by foot Y), foreground canopy/roofs, weather/ambience, interaction markers.
- Use Tiled (.tmj/.json) to author separate map, tilesets, object layers (`spawn`, `npc_spawn`, `collider`, `portal`, `wander_region`).
- Animated decor: foam (4 frames), waving leaves (3–4), mist (subtle); run slower than player to preserve calm mood.

## Dialogue and UI
- Text is rendered as crisp, accessible HTML overlay (not baked into art), with 9-slice pixel border, high contrast, optional letter-by-letter effect but always instant-skip and reduced-motion mode.
- On mobile dialogue must not hide all gameplay context; reading longer text can expand to scrollable card.
- UI icons: interact, next, close, audio, map, subtle seen indicator; min 44×44 CSS-pixel tap targets.

## Asset manifest / naming
`public/game/characters/{bubu,dudu,npc_base}/...`; `public/game/tilesets/{sta_ana,tuguegarao,baguio}.png`; `public/game/maps/{zone}.tmj`; `public/game/props/...`; `public/game/effects/...`; `public/game/audio/...`.
Maintain `assets/manifest.json` when implemented: dimensions, frames, license/creator, visual purpose and map assignment.

## Placeholder-first rule
Use ORIGINAL programmer-art placeholders initially. Do not hold up data workflows on bespoke full maps. Replace placeholders after collision, scale, frame alignment and overlays are stable.

## Device and expanded media art notes
- Test pixel camera on desktop 16:9 and mobile portrait/landscape; **neither device class may be treated as a fallback**. Consider alternate viewport framing and dynamically positioned input pad, rather than stretching native sprites.
- Make all interactables comfortably tappable at **at least 44×44 CSS pixels** and avoid placing a joystick beneath home-indicator safe areas.
- NPC message dialogue supports text, photo previews and an accessible audio control; photographs are regular responsive HTML media, not pixelated or rasterized into the Phaser texture atlas.
- Finale sprites: Bubu and Dudu reunion idle, approach/walk, embrace/meet pose (if chosen), reaction/emote, end-frame. Animation may be 4–8 frames per short beat. Provide static storytelling for `prefers-reduced-motion`.
- Up to ~30 NPCs should share a template atlas/palette variants and distinctive optional accessories, not 30 unrelated animation rigs.
