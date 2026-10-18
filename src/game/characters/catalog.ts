import { CAPYBARA } from "./capybara";

export const CHARACTER_KEYS = [
  "bear",
  "turtle",
  "capybara",
  "frog",
  "cat",
  "bee",
] as const;
export type CharacterKey = (typeof CHARACTER_KEYS)[number];
export const LEGACY_VARIANTS = [
  "npc-cream-1",
  "npc-brown-scarf",
  "npc-rose-bow",
] as const;
export const ANIMAL_VARIANTS = [
  "animal-bear",
  "animal-turtle",
  "animal-capybara",
  "animal-frog",
  "animal-cat",
  "animal-bee",
] as const;
export const SPRITE_VARIANTS = [
  ...LEGACY_VARIANTS,
  ...ANIMAL_VARIANTS,
] as const;
export type SpriteVariant = (typeof SPRITE_VARIANTS)[number];
export const CHARACTERS = CHARACTER_KEYS.map((key) => ({
  key,
  variant: `animal-${key}` as (typeof ANIMAL_VARIANTS)[number],
  name: key.charAt(0).toUpperCase() + key.slice(1),
  src: key === "capybara" ? CAPYBARA.src : `/game/characters/${key}-v1.png`,
  frameSize: 32,
  frameCount: 12,
}));
export function characterInfo(key: CharacterKey) {
  return CHARACTERS.find((c) => c.key === key)!;
}
