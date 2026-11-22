import { expect, it } from "vitest";
import {
  roadsideCheerers,
  sluCheeringCast,
  roadCheeringSpot,
} from "../src/game/slu-cheerers";
import { demoNpcs } from "../src/game/demo-fixtures";
import { canStand } from "../src/game/world";
import { Crowd } from "../src/game/crowd";
import { contributorVisitSchema, sceneSchema } from "../src/game/connected";

const roster = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name: `Sample friend ${i + 1}`,
    variant: "npc-cream-1" as const,
  }));
it("forms a stable, balanced road crowd, one bear for every contributor", () => {
  const source = roster(30),
    snapshot = JSON.stringify(source);
  const result = roadsideCheerers(source);
  expect(result).toEqual(roadsideCheerers([...source].reverse()));
  expect(result).toHaveLength(30);
  expect(new Set(result.map((p) => `${p.x},${p.y}`)).size).toBe(30);
  expect(result.every((p) => p.y === 422)).toBe(true);
  expect(result.filter((p) => p.x < 364).length).toBeGreaterThan(10);
  expect(result.filter((p) => p.x > 422).length).toBeGreaterThan(10);
  expect(JSON.stringify(source)).toBe(snapshot);
});
it("fits fifty bears in two road rows while leaving the entrance axis clear", () => {
  const result = roadsideCheerers(roster(50));
  expect(result).toHaveLength(50);
  for (const p of result) {
    expect(roadCheeringSpot(p.x, p.y)).toBe(true);
    expect(p.x <= 364 || p.x >= 422).toBe(true);
  }
  expect(canStand(385, 365, "slu_baguio")).toBe(true);
  expect(canStand(400, 410, "slu_baguio")).toBe(false);
  expect(new Set(result.map((p) => `${p.x},${p.y}`)).size).toBe(50);
});
it("never silently truncates a large authorized roster, and deduplicates IDs", () => {
  const source = roster(600);
  const result = roadsideCheerers([...source, source[0]]);
  expect(result).toHaveLength(600);
  expect(new Set(result.map((p) => `${p.x},${p.y}`)).size).toBe(600);
  expect(
    result.every((p) => Number.isFinite(p.x) && roadCheeringSpot(p.x, p.y)),
  ).toBe(true);
});
it("reuses native SLU dialogue IDs once and does not modify stored placements", () => {
  const original = demoNpcs("slu_baguio", 1),
    snapshot = JSON.stringify(original);
  const cast = sluCheeringCast(original, roster(30));
  expect(cast.npcs[0].id).toBe(original[0].id);
  expect(cast.npcs[0].radius).toBe(0);
  expect(cast.decorative).toHaveLength(29);
  expect(cast.decorative.some((p) => p.id === original[0].id)).toBe(false);
  expect(JSON.stringify(original)).toBe(snapshot);
  const crowd = new Crowd("slu_baguio", cast.npcs, cast.cheeringIds);
  expect(crowd.bears).toHaveLength(1); // Decorative bears never enter Talk or collisions.
  expect(crowd.bears[0].y).toBe(422);
  expect(new Crowd("slu_baguio", cast.npcs).bears).toHaveLength(0);
  expect(canStand(crowd.bears[0].x, crowd.bears[0].y, "slu_baguio")).toBe(
    false,
  );
  Object.assign(crowd.player, { x: 385, y: 392 });
  for (let i = 0; i < 200; i++) crowd.step({ x: 1, y: 0 }, 0.04);
  expect(crowd.player.x).toBeGreaterThan(650);
  expect(crowd.bears[0].x).toBe(cast.npcs[0].x);
});
it("keeps the roster metadata-only and out of contributor visits", () => {
  const cheerers = roster(1);
  expect(
    sceneSchema.parse({ mapKey: "slu_baguio", npcs: [], cheerers }).cheerers,
  ).toEqual(cheerers);
  expect(
    sceneSchema.safeParse({
      mapKey: "slu_baguio",
      npcs: [],
      cheerers: [{ ...cheerers[0], message: "private" }],
    }).success,
  ).toBe(false);
  expect(
    contributorVisitSchema.safeParse({
      mapKey: "slu_baguio",
      npcs: [],
      cheerers,
      visitor: { name: "Sample", variant: "npc-cream-1" },
    }).success,
  ).toBe(false);
});
