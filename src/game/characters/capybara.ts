import { animalFrame, animalSheetRgba } from "./animal-art";

export const CAPYBARA = {
  key: "animal-capybara",
  name: "Capybara",
  src: "/game/characters/capybara-v3.png",
  frameSize: 32,
  frameCount: 12,
  origin: { x: 0.5, y: 30 / 32 },
} as const;

export const CHARACTER_DIRECTIONS = ["down", "up", "side"] as const;
export type CharacterDirection = (typeof CHARACTER_DIRECTIONS)[number];
export type CharacterAction = "idle" | "walk";

export function characterAnimation(
  direction: CharacterDirection,
  action: CharacterAction,
) {
  const start =
    CHARACTER_DIRECTIONS.indexOf(direction) * 4 + (action === "walk" ? 2 : 0);
  return { start, end: start + 1, rate: action === "walk" ? 8 : 2 };
}
export const capybaraFrame = (frame: number) => animalFrame("capybara", frame);
export const capybaraSheetRgba = () => animalSheetRgba("capybara");
