import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CHARACTERS } from "../src/game/characters/catalog";
import {
  animalFrame,
  animalSheetRgba,
  REFERENCE_POSES,
} from "../src/game/characters/animal-art";
import {
  CHARACTER_DIRECTIONS,
  characterAnimation,
} from "../src/game/characters/capybara";

describe("Approved character reference", () => {
  it("ships all six atlases identical to their reproducible sources", async () => {
    const sheets = new Set<string>();
    for (const character of CHARACTERS) {
      const { data, info } = await sharp(`public${character.src}`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([info.width, info.height, info.channels]).toEqual([384, 32, 4]);
      expect(data.equals(Buffer.from(animalSheetRgba(character.key)))).toBe(
        true,
      );
      sheets.add(data.toString("base64"));
    }
    expect(sheets.size).toBe(6);
  });

  it("preserves every sampled reference pixel, palette and pose at exact 2x scale", async () => {
    const { data, info } = await sharp(
      "assets/characters/references/approved-16px-sheet.png",
    )
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const columns = [288, 474, 660, 846, 1032, 1218];
    const rows = {
      turtle: 146,
      capybara: 304,
      cat: 462,
      bee: 620,
      frog: 778,
    } as const;
    const background = new Set(["#f8f6ec", "#e6e2d6", "#d2cdbe", "#d7d2c4"]);
    for (const [name, top] of Object.entries(rows)) {
      for (let frame = 0; frame < 12; frame++) {
        const actual = animalFrame(name as keyof typeof rows, frame);
        const expected = Array.from({ length: 1024 }, (_, i) => {
          const x = Math.floor((i % 32) / 2),
            y = Math.floor(i / 64);
          const offset =
            ((top + 2 + y * 5) * info.width +
              columns[REFERENCE_POSES[frame]] +
              2 +
              x * 5) *
            3;
          const color = "#" + data.subarray(offset, offset + 3).toString("hex");
          return background.has(color) ? null : color;
        });
        expect(actual, `${name}, frame ${frame}`).toEqual(expected);
      }
    }
  });

  it("retains the original bear including its shadow and animation", async () => {
    const original = await sharp("public/game/characters/npc-cream-1-v1.png")
      .ensureAlpha()
      .raw()
      .toBuffer();
    expect(Buffer.from(animalSheetRgba("bear")).equals(original)).toBe(true);
  });

  it("uses the supplied idle/stride pairs in each directional animation", () => {
    for (const direction of CHARACTER_DIRECTIONS) {
      const idle = characterAnimation(direction, "idle"),
        walk = characterAnimation(direction, "walk");
      expect(idle.end + 1).toBe(walk.start);
      expect(walk.end).toBeLessThan(12);
      expect([idle.rate, walk.rate]).toEqual([2, 8]);
      for (const name of [
        "turtle",
        "capybara",
        "cat",
        "bee",
        "frog",
      ] as const) {
        expect(animalFrame(name, idle.start)).toEqual(
          animalFrame(name, idle.end),
        );
        expect(animalFrame(name, walk.start)).not.toEqual(
          animalFrame(name, walk.end),
        );
      }
    }
    expect(() => animalFrame("capybara", -1)).toThrow(RangeError);
    expect(() => animalFrame("capybara", 12)).toThrow(RangeError);
  });
});
