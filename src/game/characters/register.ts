import type * as Phaser from "phaser";
import { CHARACTER_DIRECTIONS, characterAnimation } from "./capybara";
import type { CHARACTERS } from "./catalog";

export function registerCharacterAnimations(
  scene: Phaser.Scene,
  character: (typeof CHARACTERS)[number],
) {
  for (const direction of CHARACTER_DIRECTIONS)
    for (const action of ["idle", "walk"] as const) {
      const { start, end, rate } = characterAnimation(direction, action);
      const key = `${character.variant}-${action}-${direction}`;
      if (!scene.anims.exists(key))
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(character.variant, {
            start,
            end,
          }),
          frameRate: rate,
          repeat: -1,
        });
    }
}
