import type { CSSProperties } from "react";
import { CHARACTERS, type SpriteVariant } from "@/game/characters/catalog";
import {
  characterAnimation,
  type CharacterAction,
  type CharacterDirection,
} from "@/game/characters/capybara";

export function CharacterSprite({
  variant,
  label,
  animate = true,
  direction = "down",
  action = "idle",
}: {
  variant: SpriteVariant;
  label?: string;
  animate?: boolean;
  direction?: CharacterDirection;
  action?: CharacterAction;
}) {
  const character = CHARACTERS.find((c) => c.variant === variant);
  const { start, rate } = characterAnimation(direction, action);
  return (
    <span
      className={`character-sprite-preview ${animate ? "" : "is-still"}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={!label || undefined}
      style={
        {
          backgroundImage: `url(${character?.src ?? `/game/characters/${variant}-v1.png`})`,
          "--pose-start": `${-start * 64}px`,
          "--pose-end": `${-(start + 2) * 64}px`,
          "--pose-duration": `${2 / rate}s`,
        } as CSSProperties
      }
    />
  );
}
