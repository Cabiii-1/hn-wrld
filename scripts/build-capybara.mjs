import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import {
  CAPYBARA,
  capybaraSheetRgba,
} from "../src/game/characters/capybara.ts";

await mkdir("public/game/characters", { recursive: true });
await sharp(Buffer.from(capybaraSheetRgba()), {
  raw: {
    width: CAPYBARA.frameSize * CAPYBARA.frameCount,
    height: CAPYBARA.frameSize,
    channels: 4,
  },
})
  .png()
  .toFile(`public${CAPYBARA.src}`);
console.log(
  "Built original 384x32 capybara sheet: 12 frames, 5 colors, binary transparency.",
);
