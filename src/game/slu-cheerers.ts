import type { Cheerer, WorldNpc } from "./connected";

export type CheeringBear = Cheerer & { x: number; y: number; phase: number };

// Display-only road positions are separate from the player's walkable geometry.
export function roadCheeringSpot(x: number, y: number) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 27 &&
    x <= 809 &&
    (x <= 364 || x >= 422) &&
    (y === 422 || y === 452)
  );
}

/** Display-only positions. Never write these over an administrator's placement. */
export function roadsideCheerers(roster: Cheerer[]): CheeringBear[] {
  const slots: { x: number; y: number }[] = [];
  const used = new Set<string>();
  function add(x: number, y: number) {
    const key = `${x},${y}`;
    // Keep the entrance corridor and Hanna's spawn clear, including her foot width.
    if ((x > 364 && x < 422) || used.has(key) || !roadCheeringSpot(x, y))
      return;
    used.add(key);
    slots.push({ x, y });
  }
  // Two road rows facing the school, with the entrance axis open.
  for (const y of [422, 452]) {
    for (let i = 0; i < 16; i++) {
      if (i < 14) add(313 - i * 22, y);
      add(477 + i * 22, y);
    }
  }
  // Preserve every name even for rosters beyond the intended 50-person cast.
  // Overflow stays on the road, outside the entrance axis.
  for (const y of [422, 452])
    for (let x = 27; slots.length < roster.length && x <= 809; x++) add(x, y);
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
