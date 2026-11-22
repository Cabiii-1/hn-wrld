import { expect, it } from "vitest";
import { parkGathering } from "../src/game/park-gathering";
import { demoNpcs } from "../src/game/demo-fixtures";
import { safePlacement, SCENES } from "../src/game/scenes";
it.each([0, 30, 50, 600])(
  "gathers %i identities into safe Park positions without changing source data",
  (count) => {
    const template = demoNpcs("sta_ana_house", 1)[0];
    const input = Array.from({ length: count }, (_, i) => ({
      ...template,
      id: `friend-${i}`,
      seen: i % 2 === 0,
    }));
    const saved = structuredClone(input);
    const result = parkGathering(input);
    expect(input).toEqual(saved);
    expect(result).toHaveLength(count);
    expect(new Set(result.map((n) => `${n.x},${n.y}`)).size).toBe(count);
    for (const n of result) {
      expect(safePlacement("tuguegarao_park", n.x, n.y, n.radius)).toBe(true);
      expect(
        Math.hypot(
          n.x - SCENES.tuguegarao_park.player.x,
          n.y - SCENES.tuguegarao_park.player.y,
        ),
      ).toBeGreaterThan(45);
      expect(n.seen).toBe(input.find((source) => source.id === n.id)?.seen);
    }
    expect(parkGathering([...input].reverse())).toEqual(result);
  },
);
