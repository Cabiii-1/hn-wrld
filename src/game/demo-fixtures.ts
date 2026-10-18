import { SPRITE_VARIANTS } from "./characters/catalog";
import type { WorldNpc } from "./connected";
import { SCENES, safePlacement, type SceneKey } from "./scenes";
export function demoNpcs(
  map: SceneKey,
  count: number,
  mixed = false,
): WorldNpc[] {
  const variants: readonly WorldNpc["variant"][] = mixed
    ? SPRITE_VARIANTS
    : ["npc-cream-1", "npc-brown-scarf", "npc-rose-bow"];
  const points: { x: number; y: number; radius: number }[] = [];
  if (count === 1) points.push(SCENES[map].npc);
  else
    for (const y of [
      ...Array.from({ length: 12 }, (_, i) => 180 + i * 20),
      390,
    ])
      for (let x = 50; x <= 790; x += 22) {
        if (points.length >= count) break;
        if (Math.hypot(x - SCENES[map].player.x, y - SCENES[map].player.y) < 45)
          continue;
        const radius = safePlacement(map, x, y, 8) ? 8 : 0;
        if (safePlacement(map, x, y, radius)) points.push({ x, y, radius });
      }
  return points.map((p, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name:
      count === 1
        ? "Teddy · sample"
        : `Sample ${mixed ? "friend" : "bear"} ${i + 1}`,
    variant: variants[i % variants.length],
    ...p,
    seen: false,
  }));
}
