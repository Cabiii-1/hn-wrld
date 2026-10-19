// Import the owner's approved, grid-aligned sheet without resampling the art.
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
const input = process.argv[2];
if (!input) throw new Error("Pass the approved reference PNG path.");
await mkdir("assets/characters/references", { recursive: true });
await copyFile(input, "assets/characters/references/approved-16px-sheet.png");
const { data, info } = await sharp(input)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (info.width !== 1440 || info.height !== 960)
  throw new Error("Expected the approved 1440x960 sheet.");
const background = new Set(["#f8f6ec", "#e6e2d6", "#d2cdbe", "#d7d2c4"]);
const result = {};
for (const [name, top] of [
  ["turtle", 146],
  ["capybara", 304],
  ["cat", 462],
  ["bee", 620],
  ["frog", 778],
]) {
  const palette = [null];
  const poses = [288, 474, 660, 846, 1032, 1218].map((left) => {
    const rows = [];
    for (let y = 0; y < 16; y++) {
      let row = "";
      for (let x = 0; x < 16; x++) {
        const offset = ((top + 2 + y * 5) * info.width + left + 2 + x * 5) * 3;
        const color = "#" + data.subarray(offset, offset + 3).toString("hex");
        const pixel = background.has(color) ? null : color;
        if (!palette.includes(pixel)) palette.push(pixel);
        row += palette.indexOf(pixel).toString(16);
      }
      rows.push(row);
    }
    return rows;
  });
  if (palette.length > 16)
    throw new Error(`${name}: unexpected sampled colors ${palette}`);
  result[name] = { palette, poses };
  console.log(name, palette);
}
await writeFile(
  "src/game/characters/reference-pixels.json",
  JSON.stringify(result, null, 2) + "\n",
);
