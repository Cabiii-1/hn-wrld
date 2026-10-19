import reference from "./reference-pixels.json" with { type: "json" };
import { paintLegacyBear } from "./paint-legacy-bear";
import type { CharacterKey } from "./catalog";

// Each direction: idle, idle, idle, walk. Keep all six supplied poses exact.
export const REFERENCE_POSES = [0, 0, 0, 1, 2, 2, 2, 3, 4, 4, 4, 5] as const;

function originalBearFrames() {
  const frames: (string | null)[][] = Array.from({ length: 12 }, () =>
    Array(1024).fill(null),
  );
  let dx = 0;
  const stack: number[] = [];
  paintLegacyBear(
    {
      fillStyle: "#000000",
      save() {
        stack.push(dx);
      },
      restore() {
        dx = stack.pop()!;
      },
      translate(x: number) {
        dx += x;
      },
      fillRect(x: number, y: number, width: number, height: number) {
        for (let yy = y; yy < y + height; yy++)
          for (let xx = x; xx < x + width; xx++)
            frames[Math.floor(dx / 32)][yy * 32 + xx] = String(this.fillStyle);
      },
    },
    "npc-cream-1",
    "#f1d8b0",
    "#778b63",
  );
  return frames;
}
const bearFrames = originalBearFrames();

/** Exact 16px reference pixels, expanded 2x into the existing 32px contract. */
export function animalFrame(
  character: CharacterKey,
  frame: number,
): (string | null)[] {
  if (!Number.isInteger(frame) || frame < 0 || frame >= 12)
    throw new RangeError("Invalid character frame");
  if (character === "bear") return [...bearFrames[frame]];
  const { palette, poses } = reference[character];
  const pose = poses[REFERENCE_POSES[frame]];
  return Array.from({ length: 1024 }, (_, i) => {
    const x = Math.floor((i % 32) / 2),
      y = Math.floor(i / 32 / 2);
    return palette[parseInt(pose[y][x], 16)];
  });
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
      data[offset + 3] = rgb.length === 9 ? parseInt(rgb.slice(7, 9), 16) : 255;
    });
  return data;
}
