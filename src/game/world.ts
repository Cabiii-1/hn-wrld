// Background coordinates normalized to an 836 × 470 world (source: 1672 × 941).
import { safeBox, type SceneKey } from "./scenes";
export const WORLD = { width: 836, height: 470 };
export const YARD = { left: 32, right: 804, top: 242, bottom: 424 };
export const OBSTACLES = [
  { name: "Raze car", x: 384, y: 216, width: 132, height: 72 },
  { name: "House and flower beds", x: 495, y: 40, width: 341, height: 257 },
];
export const PLAYER_START = { x: 340, y: 350 };
export const NPC_START = { x: 425, y: 352 };
export const WANDER = { left: 405, right: 490, top: 330, bottom: 395 };
export const FOOT = { halfWidth: 7, height: 7 };
export type Point = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";
export function canStand(
  x: number,
  y: number,
  map: SceneKey = "sta_ana_house",
) {
  return safeBox(
    {
      left: x - FOOT.halfWidth,
      right: x + FOOT.halfWidth,
      top: y - FOOT.height,
      bottom: y,
    },
    map,
  );
}
export function moveFeet(
  from: Point,
  dx: number,
  dy: number,
  other?: Point | Point[],
  map: SceneKey = "sta_ana_house",
): Point {
  const separated = (x: number, y: number) =>
    !other ||
    (Array.isArray(other) ? other : [other]).every(
      (p) =>
        Math.hypot(x - p.x, y - p.y) >= 19 ||
        Math.hypot(x - p.x, y - p.y) > Math.hypot(from.x - p.x, from.y - p.y),
    );
  let { x, y } = from;
  // Substeps also protect narrow sidewalk/stair boundaries after long frames.
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4),
  );
  for (let i = 0; i < steps; i++) {
    if (canStand(x + dx / steps, y, map) && separated(x + dx / steps, y))
      x += dx / steps;
    if (canStand(x, y + dy / steps, map) && separated(x, y + dy / steps))
      y += dy / steps;
  }
  return { x, y };
}
export function normalizedInput(x: number, y: number) {
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}
export function nextRandom(seed: number) {
  return (seed * 1664525 + 1013904223) >>> 0;
}
