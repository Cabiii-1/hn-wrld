import type { Cheerer, WorldNpc } from "./connected";
import { safePlacement } from "./scenes";

export type CheeringBear = Cheerer & { x: number; y: number; phase: number };

/** Display-only positions. Never write these over an administrator's placement. */
export function roadsideCheerers(roster: Cheerer[]): CheeringBear[] {
  const slots: { x: number; y: number }[] = [];
  const used = new Set<string>();
  function add(x: number, y: number) {
    const key = `${x},${y}`;
    // Keep the entrance corridor and Hanna's spawn clear, including her foot width.
    if (
      (x > 364 && x < 422) ||
      used.has(key) ||
      !safePlacement("slu_baguio", x, y, 0)
    )
      return;
    used.add(key);
    slots.push({ x, y });
  }
  // Thirty curbside places, filled from the entrance outward on both sides.
  for (let i = 0; i < 16; i++) {
    if (i < 14) add(313 - i * 22, 392);
    add(477 + i * 22, 392);
  }
  // A larger gathering spills onto the stair landings, never into the road.
  for (const y of [340, 364, 388]) {
    for (const x of [358, 428, 336, 450]) add(x, y);
    if (y < 388) for (const x of [277, 205, 253, 229]) add(x, y);
  }
  // Preserve every name even for rosters beyond the intended 50-person cast.
  // These overflow positions are denser but remain on the curb, not the route.
  for (let x = 27; slots.length < roster.length && x <= 809; x++) add(x, 392);
  const unique = [
    ...new Map(roster.map((bear) => [bear.id, bear])).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
  return unique.map((bear, index) => ({
    ...bear,
    ...slots[index],
    phase: index * 1.71,
  }));
}

export function sluCheeringCast(npcs: WorldNpc[], roster: Cheerer[]) {
  const positions = roadsideCheerers(roster);
  const byId = new Map(positions.map((p) => [p.id, p]));
  const nativeIds = new Set(npcs.map((n) => n.id));
  return {
    // Already-interactive SLU bears keep their IDs/dialogue, with a display-only
    // stationary spot in the same formation. Their stored placements stay intact.
    npcs: npcs.map((n) => {
      const spot = byId.get(n.id);
      return spot ? { ...n, x: spot.x, y: spot.y, radius: 0 } : n;
    }),
    decorative: positions.filter((p) => !nativeIds.has(p.id)),
    cheeringIds: new Set(positions.map((p) => p.id)),
  };
}
