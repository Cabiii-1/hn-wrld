import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CHARACTERS } from "../src/game/characters/catalog";
import {
  animalFrame,
  animalSheetRgba,
} from "../src/game/characters/animal-art";
import {
  CAPYBARA,
  CAPYBARA_PALETTE,
  CHARACTER_DIRECTIONS,
  capybaraFrame,
  capybaraSheetRgba,
  characterAnimation,
} from "../src/game/characters/capybara";

describe("Native capybara sprite contract", () => {
  it("ships all six native-grid atlases with distinct silhouettes, solid pixels and consistent feet anchors", async () => {
    const sheets = new Set<string>();
    for (const character of CHARACTERS) {
      const { data, info } = await sharp(`public${character.src}`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([384, 32]);
      expect(data.equals(Buffer.from(animalSheetRgba(character.key)))).toBe(
        true,
      );
      sheets.add(data.toString("base64"));
      for (let frame = 0; frame < 12; frame++) {
        const pixels = animalFrame(character.key, frame);
        expect(
          Math.max(
            ...pixels.flatMap((v, i) => (v ? [Math.floor(i / 32)] : [])),
          ),
        ).toBe(29);
        expect(new Set(pixels.filter(Boolean)).size).toBeLessThanOrEqual(6);
        expect(pixels.slice(0, 32)).toEqual(Array(32).fill(null));
      }
    }
    expect(sheets.size).toBe(6);
  });
  it("ships an atlas identical to its reproducible pixel source", async () => {
    const { data, info } = await sharp(`public${CAPYBARA.src}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([384, 32, 4]);
    expect(data.equals(Buffer.from(capybaraSheetRgba()))).toBe(true);
    const alphas = new Set(Array.from(data).filter((_, i) => i % 4 === 3));
    expect([...alphas].sort()).toEqual([0, 255]);
  });
  it("keeps coarse 2x2 pixels, transparent margins, shared feet baseline and a five-color palette in every pose", () => {
    for (let frame = 0; frame < 12; frame++) {
      const pixels = capybaraFrame(frame);
      const occupied = pixels.flatMap((pixel, i) => (pixel ? [i] : []));
      expect(Math.max(...occupied.map((i) => Math.floor(i / 32)))).toBe(29);
      expect(Math.min(...occupied.map((i) => i % 32))).toBeGreaterThanOrEqual(
        2,
      );
      expect(Math.max(...occupied.map((i) => i % 32))).toBeLessThanOrEqual(29);
      expect(new Set(pixels.filter(Boolean)).size).toBeLessThanOrEqual(
        Object.keys(CAPYBARA_PALETTE).length,
      );
      for (let y = 0; y < 32; y += 2)
        for (let x = 0; x < 32; x += 2) {
          expect(
            new Set([
              pixels[y * 32 + x],
              pixels[y * 32 + x + 1],
              pixels[(y + 1) * 32 + x],
              pixels[(y + 1) * 32 + x + 1],
            ]).size,
          ).toBe(1);
        }
    }
  });
  it("addresses two valid frames per direction/action and moves feet without shifting the body", () => {
    for (const direction of CHARACTER_DIRECTIONS) {
      const idle = characterAnimation(direction, "idle"),
        walk = characterAnimation(direction, "walk");
      expect(idle.end + 1).toBe(walk.start);
      expect(walk.end).toBeLessThan(12);
      expect([idle.rate, walk.rate]).toEqual([2, 8]);
      const a = capybaraFrame(walk.start),
        b = capybaraFrame(walk.end);
      expect(a).not.toEqual(b);
      expect(a.slice(0, 22 * 32)).toEqual(b.slice(0, 22 * 32));
    }
    expect(() => capybaraFrame(-1)).toThrow(RangeError);
    expect(() => capybaraFrame(12)).toThrow(RangeError);
  });
});
