import { describe, expect, it } from "vitest";
import {
  canStand,
  moveFeet,
  normalizedInput,
  nextRandom,
  PLAYER_START,
  NPC_START,
  YARD,
  WANDER,
} from "../src/game/world";
describe("house feet geometry", () => {
  it("keeps both spawns on safe ground", () => {
    expect(canStand(PLAYER_START.x, PLAYER_START.y)).toBe(true);
    expect(canStand(NPC_START.x, NPC_START.y)).toBe(true);
  });
  it("blocks the car, house, fence and map edges", () => {
    for (const p of [
      { x: 450, y: 270 },
      { x: 650, y: 285 },
      { x: 200, y: 230 },
      { x: 200, y: 460 },
      { x: 0, y: 350 },
      { x: 835, y: 350 },
    ])
      expect(canStand(p.x, p.y)).toBe(false);
  });
  it("slides along obstacles instead of sticking on diagonal input", () => {
    expect(moveFeet({ x: 375, y: 270 }, 4, 3)).toEqual({ x: 375, y: 273 });
  });
  it("cannot cross boundaries during sustained movement", () => {
    for (const [dx, dy] of [
      [4, 0],
      [-4, 0],
      [0, -4],
      [0, 4],
      [4, -4],
    ]) {
      let p = PLAYER_START;
      for (let i = 0; i < 2000; i++) {
        p = moveFeet(p, dx, dy);
        expect(canStand(p.x, p.y)).toBe(true);
      }
    }
  });
  it("keeps the whole NPC wander zone safe", () => {
    for (let x = WANDER.left; x <= WANDER.right; x++)
      for (let y = WANDER.top; y <= WANDER.bottom; y++)
        expect(canStand(x, y)).toBe(true);
  });
  it("separates feet and preserves a route around an NPC", () => {
    expect(moveFeet({ x: 400, y: 350 }, 4, 0, { x: 420, y: 350 }).x).toBe(400);
    expect(moveFeet({ x: 400, y: 350 }, 0, 4, { x: 420, y: 350 }).y).toBe(354);
  });
  it("normalizes diagonal speed and provides repeatable wandering", () => {
    expect(Math.hypot(...Object.values(normalizedInput(1, 1)))).toBeCloseTo(1);
    expect(normalizedInput(0, 0)).toEqual({ x: 0, y: 0 });
    expect(nextRandom(42)).toBe(1083814273);
    expect(YARD.bottom).toBeLessThan(470);
  });
  it("checks multiple bears and lets overlapping feet separate without trapping Hanna", () => {
    expect(
      moveFeet({ x: 400, y: 350 }, 4, 0, [
        { x: 420, y: 350 },
        { x: 360, y: 350 },
      ]).x,
    ).toBe(400);
    expect(moveFeet({ x: 400, y: 350 }, -4, 0, [{ x: 405, y: 350 }]).x).toBe(
      396,
    );
  });
});
