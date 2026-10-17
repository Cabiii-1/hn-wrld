import { describe, it, expect } from "vitest";
import {
  SCENE_KEYS,
  SCENES,
  safePlacement,
  coveredBox,
} from "../src/game/scenes";
import { canStand, moveFeet, normalizedInput } from "../src/game/world";
import { Crowd } from "../src/game/crowd";
import { demoNpcs } from "../src/game/demo-fixtures";
describe("M4 scene geometry and crowded movement", () => {
  it("keeps all default spawns and complete wander footprints on safe ground", () => {
    for (const map of SCENE_KEYS) {
      const s = SCENES[map];
      expect(canStand(s.player.x, s.player.y, map)).toBe(true);
      expect(safePlacement(map, s.npc.x, s.npc.y, s.npc.radius)).toBe(true);
    }
  });
  it("blocks park lamps/edges and the SLU road/building/wall between stairs", () => {
    expect(canStand(293, 350, "tuguegarao_park")).toBe(false);
    expect(canStand(543, 360, "tuguegarao_park")).toBe(false);
    expect(canStand(100, 190, "tuguegarao_park")).toBe(false);
    expect(canStand(400, 410, "slu_baguio")).toBe(false);
    expect(canStand(400, 310, "slu_baguio")).toBe(false);
    expect(canStand(310, 360, "slu_baguio")).toBe(false);
    expect(
      coveredBox(
        { left: 210, right: 420, top: 350, bottom: 390 },
        "slu_baguio",
      ),
    ).toBe(false);
    expect(canStand(400, 384, "slu_baguio")).toBe(true);
    expect(canStand(230, 360, "slu_baguio")).toBe(true);
  });
  it("joins SLU stairs to the sidewalk and prevents tunnelling into the road", () => {
    let p = { x: 385, y: 365 };
    for (let i = 0; i < 25; i++) p = moveFeet(p, 0, 1, undefined, "slu_baguio");
    expect(p.y).toBe(390);
    for (let i = 0; i < 31; i++)
      p = moveFeet(p, -5, 0, undefined, "slu_baguio");
    expect(p.x).toBe(230);
    for (let i = 0; i < 30; i++)
      p = moveFeet(p, 0, -1, undefined, "slu_baguio");
    expect(p.y).toBe(360);
    expect(moveFeet(p, 0, 200, undefined, "slu_baguio").y).toBeLessThanOrEqual(
      395,
    );
  });
  for (const map of SCENE_KEYS)
    for (const count of [20, 30, 50])
      it(`${map}: ${count} synthetic bears stay bounded during movement`, () => {
        const fixture = demoNpcs(map, count);
        expect(fixture).toHaveLength(count);
        const crowd = new Crowd(map, fixture);
        for (let frame = 0; frame < 900; frame++) {
          crowd.step(
            normalizedInput(
              Math.floor(frame / 150) % 2 ? 1 : -1,
              Math.floor(frame / 300) % 2 ? 0.5 : -0.5,
            ),
            1 / 60,
          );
          expect(canStand(crowd.player.x, crowd.player.y, map)).toBe(true);
          if (frame % 30 === 0)
            for (const b of crowd.bears) {
              expect(canStand(b.x, b.y, map)).toBe(true);
              expect(Math.abs(b.x - b.spawnX)).toBeLessThanOrEqual(b.radius);
              expect(Math.abs(b.y - b.spawnY)).toBeLessThanOrEqual(b.radius);
            }
        }
        expect(crowd.bears).toHaveLength(count);
      });
  it("separates duplicated starts and advances deterministically", () => {
    const fixture = demoNpcs("tuguegarao_park", 1),
      np = fixture[0];
    const copies = Array.from({ length: 6 }, (_, i) => ({
      ...np,
      id: String(i),
    }));
    const a = new Crowd("tuguegarao_park", copies),
      b = new Crowd("tuguegarao_park", copies);
    expect(new Set(a.bears.map((n) => `${n.x},${n.y}`)).size).toBeGreaterThan(
      1,
    );
    for (let i = 0; i < 600; i++) {
      a.step({ x: 0, y: 0 }, 1 / 60);
      b.step({ x: 0, y: 0 }, 1 / 60);
    }
    expect(a.bears).toEqual(b.bears);
  });
});
