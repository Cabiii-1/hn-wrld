// Native-grid original art, informed by the owner's simple capybara reference.
// This is the production source, not a resize of the generated concept image.
export const CAPYBARA = {
  key: "animal-capybara",
  name: "Capybara",
  src: "/game/characters/capybara-v1.png",
  frameSize: 32,
  frameCount: 12,
  origin: { x: 0.5, y: 30 / 32 },
} as const;

export const CHARACTER_DIRECTIONS = ["down", "up", "side"] as const;
export type CharacterDirection = (typeof CHARACTER_DIRECTIONS)[number];
export type CharacterAction = "idle" | "walk";
export const CAPYBARA_PALETTE = {
  o: "#65483b", // warm outline / eyes / paws
  b: "#cc986f", // flat tan body
  m: "#ad7957", // broad capybara muzzle
  p: "#eaa09e", // square blush
  l: "#e8c7a0", // small belly accent
} as const;
type Ink = keyof typeof CAPYBARA_PALETTE;

export function characterAnimation(
  direction: CharacterDirection,
  action: CharacterAction,
) {
  const start =
    CHARACTER_DIRECTIONS.indexOf(direction) * 4 + (action === "walk" ? 2 : 0);
  return { start, end: start + 1, rate: action === "walk" ? 8 : 2 };
}

/** Each logical pixel is a solid 2x2 block; all poses share the same feet baseline. */
export function capybaraFrame(frame: number): (Ink | null)[] {
  if (!Number.isInteger(frame) || frame < 0 || frame >= CAPYBARA.frameCount)
    throw new RangeError("Unknown capybara frame");
  const pixels: (Ink | null)[] = Array(32 * 32).fill(null);
  const paint = (
    x: number,
    y: number,
    w: number,
    h: number,
    ink: Ink | null,
  ) => {
    for (let row = y * 2; row < (y + h) * 2; row++)
      for (let col = x * 2; col < (x + w) * 2; col++)
        pixels[row * 32 + col] = ink;
  };
  const direction = CHARACTER_DIRECTIONS[Math.floor(frame / 4)];
  const pose = frame % 4;
  const walking = pose >= 2;
  // Tiny ears, broad head, short body and two clearly separated paws.
  paint(4, 2, 2, 2, "o");
  paint(10, 2, 2, 2, "o");
  paint(4, 3, 8, 3, "o");
  paint(3, 5, 10, 6, "o");
  paint(2, 7, 12, 4, "o");
  paint(3, 10, 10, 4, "o");
  paint(4, 4, 8, 2, "b");
  paint(3, 6, 10, 4, "b");
  paint(4, 10, 8, 4, "b");
  paint(3, 14, 4, 1, "o");
  paint(9, 14, 4, 1, "o");
  if (walking) {
    // Alternate the small feet, never shift the head or ground anchor.
    paint(pose === 2 ? 3 : 9, 13, 4, 2, null);
    paint(pose === 2 ? 4 : 8, 13, 4, 2, "o");
  }
  if (direction === "up") {
    paint(5, 3, 1, 1, "b");
    paint(10, 3, 1, 1, "b");
    paint(7, 9, 2, 1, "m");
    paint(3, 11 + (walking && pose === 2 ? 1 : 0), 1, 2, "m");
    paint(12, 11 + (walking && pose === 3 ? 1 : 0), 1, 2, "m");
  } else if (direction === "side") {
    // The protruding rectangular muzzle distinguishes this from a bear.
    paint(11, 7, 4, 4, "o");
    paint(11, 7, 3, 3, "m");
    paint(13, 8, 1, 1, "o");
    paint(10, 6, pose === 1 ? 2 : 1, 1, "o");
    paint(8, 8, 2, 2, "p");
    paint(6, 3, 2, 2, "o");
    paint(7, 4, 1, 1, "b");
    paint(9, 11 + (walking && pose === 3 ? 1 : 0), 2, 1, "o");
  } else {
    paint(5, 6, pose === 1 ? 2 : 1, 1, "o");
    paint(10, 6, pose === 1 ? 2 : 1, 1, "o");
    paint(3, 8, 2, 2, "p");
    paint(11, 8, 2, 2, "p");
    paint(6, 7, 4, 4, "m");
    paint(7, 8, 1, 1, "o");
    paint(9, 8, 1, 1, "o");
    paint(8, 9, 1, 1, "o");
    paint(7, 10, 3, 1, "o");
    paint(6, 12, 4, 2, "l");
    paint(3, 11 + (walking && pose === 2 ? 1 : 0), 2, 1, "o");
    paint(11, 11 + (walking && pose === 3 ? 1 : 0), 2, 1, "o");
  }
  return pixels;
}

export function capybaraSheetRgba() {
  const width = CAPYBARA.frameSize * CAPYBARA.frameCount;
  const data = new Uint8Array(width * CAPYBARA.frameSize * 4);
  for (let frame = 0; frame < CAPYBARA.frameCount; frame++) {
    const pixels = capybaraFrame(frame);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const ink = pixels[y * 32 + x];
        if (!ink) continue;
        const rgb = CAPYBARA_PALETTE[ink];
        const offset = (y * width + frame * 32 + x) * 4;
        data[offset] = parseInt(rgb.slice(1, 3), 16);
        data[offset + 1] = parseInt(rgb.slice(3, 5), 16);
        data[offset + 2] = parseInt(rgb.slice(5, 7), 16);
        data[offset + 3] = 255;
      }
  }
  return data;
}
