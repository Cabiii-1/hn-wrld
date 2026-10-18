import { capybaraFrame, CAPYBARA_PALETTE } from "./capybara";
import type { CharacterKey } from "./catalog";

// Original flat-color 16px logical artwork, exported as 2x2 pixel clusters.
const palettes = {
  bear: {
    o: "#65483b",
    b: "#cf9c70",
    l: "#f0d9b2",
    p: "#eaa09e",
    a: "#77945e",
  },
  turtle: {
    o: "#485d38",
    b: "#9dbf72",
    l: "#c6d99a",
    p: "#eaa09e",
    a: "#e2bb4e",
  },
  frog: {
    o: "#536333",
    b: "#a0bd58",
    l: "#d6df9e",
    p: "#eaa09e",
    a: "#728940",
  },
  cat: { o: "#65483b", b: "#f0dfbd", l: "#d89b63", p: "#eaa09e", a: "#80614e" },
  bee: { o: "#65483b", b: "#e9c34f", l: "#f3e9c9", p: "#eaa09e", a: "#bb913c" },
};
type Ink = "o" | "b" | "l" | "p" | "a";
export function animalFrame(
  character: CharacterKey,
  frame: number,
): (string | null)[] {
  if (!Number.isInteger(frame) || frame < 0 || frame >= 12)
    throw new RangeError("Unknown animal frame");
  if (character === "capybara")
    return capybaraFrame(frame).map((ink) =>
      ink ? CAPYBARA_PALETTE[ink] : null,
    );
  const pixels: (string | null)[] = Array(1024).fill(null);
  const palette = palettes[character];
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    ink: Ink | null,
  ) => {
    for (let yy = y * 2; yy < (y + h) * 2; yy++)
      for (let xx = x * 2; xx < (x + w) * 2; xx++)
        pixels[yy * 32 + xx] = ink ? palette[ink] : null;
  };
  const back = frame >= 4 && frame < 8,
    side = frame >= 8,
    pose = frame % 4,
    walk = pose >= 2;
  const eye = (x: number, y: number) => rect(x, y, pose === 1 ? 2 : 1, 1, "o");
  const feet = (left = 3, right = 10) => {
    rect(left, 14, 3, 1, "o");
    rect(right, 14, 3, 1, "o");
    if (walk) {
      rect(pose === 2 ? left : right, 14, 3, 1, null);
      rect(pose === 2 ? left + 1 : right - 1, 13, 3, 2, "o");
    }
  };
  if (character === "turtle") {
    rect(5, 4, 6, 1, "o");
    rect(3, 5, 10, 7, "o");
    rect(4, 5, 8, 6, "a");
    rect(5, 6, 6, 5, "o");
    rect(2, 12, 3, 2, "b");
    rect(11, 12, 3, 2, "b");
    feet(2, 11);
    if (!back) {
      rect(side ? 8 : 5, 10, side ? 6 : 6, 4, "o");
      rect(side ? 8 : 5, 10, side ? 5 : 6, 3, "b");
      eye(side ? 11 : 6, 11);
      if (!side) eye(9, 11);
      rect(side ? 12 : 7, 12, 2, 1, "o");
    } else {
      rect(6, 7, 4, 3, "b");
      rect(7, 8, 2, 1, "o");
    }
    rect(7, 2, 2, 3, "a");
    rect(6, 3, 4, 1, "a");
    rect(7, 3, 2, 1, "o");
  } else if (character === "bee") {
    rect(5, 2, 1, 3, "o");
    rect(10, 2, 1, 3, "o");
    // Wings change shape, while the body and feet anchors remain stationary.
    rect(2, walk && pose === 3 ? 6 : 4, 3, 3, "o");
    rect(3, walk && pose === 3 ? 6 : 4, 2, 2, "l");
    rect(11, walk && pose === 3 ? 6 : 4, 3, 3, "o");
    rect(11, walk && pose === 3 ? 6 : 4, 2, 2, "l");
    rect(5, 5, 6, 1, "o");
    rect(4, 6, 8, 7, "o");
    rect(5, 6, 6, 7, "b");
    rect(4, 10, 8, 1, "o");
    rect(5, 12, 6, 1, "o");
    rect(6, 13, 4, 1, "b");
    feet(5, 8);
    if (!back) {
      eye(side ? 9 : 6, 7);
      if (!side) eye(9, 7);
      rect(5, 8, 1, 1, "p");
      rect(10, 8, 1, 1, "p");
    } else rect(7, 7, 2, 1, "a");
  } else {
    // Squat plush body shared by bear, cat and frog; silhouettes differ above.
    rect(4, 4, 8, 2, "o");
    rect(3, 6, 10, 5, "o");
    rect(4, 11, 8, 3, "o");
    rect(4, 5, 8, 5, "b");
    rect(5, 10, 6, 4, "b");
    feet();
    if (character === "frog") {
      rect(3, 2, 4, 4, "o");
      rect(9, 2, 4, 4, "o");
      rect(4, 3, 3, 4, "b");
      rect(9, 3, 3, 4, "b");
      rect(3, 6, 10, 4, "b");
      rect(5, 11, 6, 3, "l");
      rect(2, 11, 2, 3, "o");
      rect(12, 11, 2, 3, "o");
      if (!back) {
        eye(side ? 10 : 5, 4);
        if (!side) eye(10, 4);
        rect(6, 8, 1, 1, "o");
        rect(9, 8, 1, 1, "o");
        rect(7, 9, 2, 1, "o");
        rect(4, 8, 1, 1, "p");
        rect(11, 8, 1, 1, "p");
      }
    } else {
      if (character === "bear") {
        rect(3, 2, 3, 3, "o");
        rect(10, 2, 3, 3, "o");
        rect(4, 3, 1, 2, "b");
        rect(11, 3, 1, 2, "b");
      } else {
        rect(3, 2, 1, 4, "o");
        rect(4, 3, 2, 3, "l");
        rect(11, 2, 1, 4, "o");
        rect(10, 3, 2, 3, "a");
        rect(4, 5, 3, 2, "l");
        rect(9, 5, 3, 2, "a");
        rect(12, 11, 2, 3, "a");
        rect(13, 10, 1, 2, "a");
      }
      if (!back) {
        eye(side ? 10 : 5, 7);
        if (!side) eye(10, 7);
        if (character === "bear") {
          rect(side ? 10 : 6, 8, side ? 4 : 4, 3, "l");
          rect(side ? 12 : 7, 9, 2, 1, "o");
        } else {
          rect(side ? 11 : 7, 9, 1, 1, "p");
          rect(3, 9, 1, 1, "o");
          rect(12, 9, 1, 1, "o");
        }
        rect(4, 9, 1, 1, "p");
        if (!side) rect(11, 9, 1, 1, "p");
      }
      if (character === "bear") {
        rect(4, 11, 8, 1, "a");
        rect(side ? 9 : 10, 12, 1, 2, "a");
      } else if (back) rect(7, 10, 3, 2, "l");
    }
  }
  return pixels;
}

export function animalSheetRgba(character: CharacterKey) {
  const data = new Uint8Array(384 * 32 * 4);
  for (let frame = 0; frame < 12; frame++)
    animalFrame(character, frame).forEach((rgb, i) => {
      if (!rgb) return;
      const offset = (Math.floor(i / 32) * 384 + frame * 32 + (i % 32)) * 4;
      data[offset] = parseInt(rgb.slice(1, 3), 16);
      data[offset + 1] = parseInt(rgb.slice(3, 5), 16);
      data[offset + 2] = parseInt(rgb.slice(5, 7), 16);
      data[offset + 3] = 255;
    });
  return data;
}
