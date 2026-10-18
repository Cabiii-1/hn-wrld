import type * as Phaser from "phaser";
import { CAPYBARA, CHARACTER_DIRECTIONS, characterAnimation } from "./capybara";

export function registerCapybaraAnimations(scene: Phaser.Scene) {
  for (const direction of CHARACTER_DIRECTIONS)
    for (const action of ["idle", "walk"] as const) {
      const { start, end, rate } = characterAnimation(direction, action);
      const key = `${CAPYBARA.key}-${action}-${direction}`;
      if (!scene.anims.exists(key))
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(CAPYBARA.key, {
            start,
            end,
          }),
          frameRate: rate,
          repeat: -1,
        });
    }
}
