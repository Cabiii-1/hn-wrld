import type { WorldNpc } from "./connected";
import { safePlacement, SCENES } from "./scenes";

/** A recipient-only display projection; never rewrites saved placements. */
export function parkGathering(source: WorldNpc[]): WorldNpc[] {
  const npcs = [...new Map(source.map((n) => [n.id, n])).values()].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  let points: { x: number; y: number; radius: number }[] = [];
  for (const spacing of [36, 14, 10]) {
    points = [];
    const radius = spacing === 36 ? 5 : 0;
    for (let y = 185; y <= 395; y += spacing)
      for (let x = 45; x <= 790; x += spacing)
        if (
          safePlacement("tuguegarao_park", x, y, radius) &&
          Math.hypot(
            x - SCENES.tuguegarao_park.player.x,
            y - SCENES.tuguegarao_park.player.y,
          ) > 45
        )
          points.push({ x, y, radius });
    if (points.length >= npcs.length) break;
  }
  if (points.length < npcs.length)
    throw new Error("The Park gathering is too large.");
  return npcs.map((npc, i) => ({
    ...npc,
    ...points[Math.floor((i * points.length) / npcs.length)],
  }));
}
