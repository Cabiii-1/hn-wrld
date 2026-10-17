import geometry from "./scene-geometry.json";
export const SCENE_KEYS = [
  "sta_ana_house",
  "tuguegarao_park",
  "slu_baguio",
] as const;
export type SceneKey = (typeof SCENE_KEYS)[number];
export const SCENES = {
  sta_ana_house: {
    name: "Sta. Ana House",
    location: "Sta. Ana, Cagayan",
    chapter: "01",
    eyebrow: "WHERE IT ALL BEGAN",
    title: "A little closer to",
    accent: "home.",
    caption: "THE FAMILY YARD",
    welcome: "You’re home, Bubu.",
    description: "Home is a feeling ♡",
    player: { x: 340, y: 350 },
    npc: { x: 425, y: 352, radius: 20 },
  },
  tuguegarao_park: {
    name: "Tuguegarao Plaza",
    location: "Tuguegarao, Cagayan",
    chapter: "02",
    eyebrow: "LITTLE MOMENTS, LOVELY PEOPLE",
    title: "A little space for",
    accent: "friendship.",
    caption: "THE OPEN PLAZA",
    welcome: "A little sunshine, Bubu.",
    description: "Some friendships feel like sunshine ♡",
    player: { x: 415, y: 300 },
    npc: { x: 470, y: 290, radius: 20 },
  },
  slu_baguio: {
    name: "SLU Baguio",
    location: "Baguio City",
    chapter: "03",
    eyebrow: "A CHAPTER CLOSE TO YOUR HEART",
    title: "A little way toward",
    accent: "tomorrow.",
    caption: "THE UNIVERSITY ENTRANCE",
    welcome: "A familiar little corner, Bubu.",
    description: "More little moments to come ♡",
    player: { x: 385, y: 365 },
    npc: { x: 430, y: 360, radius: 12 },
  },
} as const;
export function isSceneKey(value: string): value is SceneKey {
  return SCENE_KEYS.includes(value as SceneKey);
}
export type Box = { left: number; right: number; top: number; bottom: number };
// Exact coverage by a UNION of closed rectangles. Corner-only checks would let
// a wide SLU wander box bridge the blocked wall between its two stairways.
export function coveredBox(box: Box, map: SceneKey) {
  const regions = geometry[map].regions;
  const inside = (x: number, y: number) =>
    regions.some(
      (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
    );
  if (
    regions.some(
      (r) =>
        box.left >= r.left &&
        box.right <= r.right &&
        box.top >= r.top &&
        box.bottom <= r.bottom,
    )
  )
    return true;
  const xs = [
    ...new Set([
      box.left,
      box.right,
      ...regions
        .flatMap((r) => [r.left, r.right])
        .filter((x) => x > box.left && x < box.right),
    ]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([
      box.top,
      box.bottom,
      ...regions
        .flatMap((r) => [r.top, r.bottom])
        .filter((y) => y > box.top && y < box.bottom),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++)
      if (!inside((xs[i - 1] + xs[i]) / 2, (ys[j - 1] + ys[j]) / 2))
        return false;
  return true;
}
export function safeBox(box: Box, map: SceneKey) {
  return (
    coveredBox(box, map) &&
    !geometry[map].obstacles.some(
      (o) =>
        box.right > o.x &&
        box.left < o.x + o.width &&
        box.bottom > o.y &&
        box.top < o.y + o.height,
    )
  );
}
export function safePlacement(
  map: SceneKey,
  x: number,
  y: number,
  radius: number,
) {
  return (
    [x, y, radius].every(Number.isInteger) &&
    radius >= 0 &&
    radius <= 80 &&
    safeBox(
      {
        left: x - radius - 7,
        right: x + radius + 7,
        top: y - radius - 7,
        bottom: y + radius,
      },
      map,
    )
  );
}
