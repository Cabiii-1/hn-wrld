import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier))
        return next(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const { animalSheetRgba } =
  await import("../src/game/characters/animal-art.ts");
const names = ["bear", "turtle", "capybara", "frog", "cat", "bee"];
await mkdir("public/game/characters", { recursive: true });
for (const name of names)
  await sharp(Buffer.from(animalSheetRgba(name)), {
    raw: { width: 384, height: 32, channels: 4 },
  })
    .png()
    .toFile(`public/game/characters/${name}-v1.png`);
console.log("Built six native-grid character sheets.");
const { paintLegacyBear } =
  await import("../src/game/characters/paint-legacy-bear.ts");
for (const [key, coat, accessory] of [
  ["npc-cream-1", "#f1d8b0", "#778b63"],
  ["npc-brown-scarf", "#b78459", "#778b63"],
  ["npc-rose-bow", "#f3dfc5", "#ce8796"],
]) {
  const raw = Buffer.alloc(384 * 32 * 4);
  let dx = 0;
  const stack = [];
  const context = {
    fillStyle: "#000000",
    save() {
      stack.push(dx);
    },
    restore() {
      dx = stack.pop();
    },
    translate(x) {
      dx += x;
    },
    fillRect(x, y, w, h) {
      const color = this.fillStyle.slice(1);
      const rgba = [
        parseInt(color.slice(0, 2), 16),
        parseInt(color.slice(2, 4), 16),
        parseInt(color.slice(4, 6), 16),
        color.length === 8 ? parseInt(color.slice(6, 8), 16) : 255,
      ];
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x + dx; xx < x + dx + w; xx++)
          for (let c = 0; c < 4; c++) raw[(yy * 384 + xx) * 4 + c] = rgba[c];
    },
  };
  paintLegacyBear(context, key, coat, accessory);
  await sharp(raw, { raw: { width: 384, height: 32, channels: 4 } })
    .png()
    .toFile(`public/game/characters/${key}-v1.png`);
}
