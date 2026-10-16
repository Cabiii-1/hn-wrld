// Background coordinates normalized to an 836 × 470 world (source: 1672 × 941).
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
export function canStand(x: number, y: number) {
  return (
    x - FOOT.halfWidth >= YARD.left &&
    x + FOOT.halfWidth <= YARD.right &&
    y - FOOT.height >= YARD.top &&
    y <= YARD.bottom &&
    !OBSTACLES.some(
      (o) =>
        x + FOOT.halfWidth > o.x &&
        x - FOOT.halfWidth < o.x + o.width &&
        y > o.y &&
        y - FOOT.height < o.y + o.height,
    )
  );
}
export function moveFeet(
  from: Point,
  dx: number,
  dy: number,
  other?: Point,
): Point {
  const separated = (x: number, y: number) =>
    !other || Math.hypot(x - other.x, y - other.y) >= 19;
  let { x, y } = from;
  if (canStand(x + dx, y) && separated(x + dx, y)) x += dx;
  if (canStand(x, y + dy) && separated(x, y + dy)) y += dy;
  return { x, y };
}
export function normalizedInput(x: number, y: number) {
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}
export function nextRandom(seed: number) {
  return (seed * 1664525 + 1013904223) >>> 0;
}
