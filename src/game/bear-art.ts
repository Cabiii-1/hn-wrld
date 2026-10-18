import { paintLegacyBear } from "./characters/paint-legacy-bear";
import * as Phaser from "phaser";

// Original 32px programmer art. Six poses: idle/walk × down/up/side.
export function makeBearTextures(
  scene: Phaser.Scene,
  key: string,
  coat: string,
  accessory: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 32 * 12;
  canvas.height = 32;
  const c = canvas.getContext("2d")!;
  paintLegacyBear(c, key, coat, accessory);
  const texture = scene.textures.addCanvas(key, canvas)!;
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  for (let i = 0; i < 12; i++) texture.add(i, 0, i * 32, 0, 32, 32);
  for (const [index, direction] of ["down", "up", "side"].entries()) {
    for (const [action, offset, rate] of [
      ["idle", 0, 2],
      ["walk", 2, 8],
    ] as const) {
      scene.anims.create({
        key: `${key}-${action}-${direction}`,
        frames: [
          { key, frame: index * 4 + offset },
          { key, frame: index * 4 + offset + 1 },
        ],
        frameRate: rate,
        repeat: -1,
      });
    }
  }
}
