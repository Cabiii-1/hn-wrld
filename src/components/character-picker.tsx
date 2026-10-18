"use client";
import { Check } from "lucide-react";
import {
  CHARACTERS,
  characterInfo,
  type CharacterKey,
  type SpriteVariant,
} from "@/game/characters/catalog";
import { CharacterSprite } from "./character-sprite";

export function CharacterPicker({
  value,
  legacyVariant = "npc-cream-1",
  onChange,
  disabled,
}: {
  value: CharacterKey | null;
  legacyVariant?: SpriteVariant;
  onChange: (key: CharacterKey) => void;
  disabled: boolean;
}) {
  const chosen = characterInfo(value ?? "bear");
  return (
    <fieldset className="character-picker" disabled={disabled}>
      <legend>Which little friend feels like you?</legend>
      <p>Pick a crochet friend to carry your hello into Hanna’s world.</p>
      <div className="character-picker-body">
        <div className="character-options">
          {CHARACTERS.map((character) => (
            <label className="character-option" key={character.key}>
              <input
                type="radio"
                name="characterKey"
                value={character.key}
                checked={chosen.key === character.key}
                onChange={() => onChange(character.key)}
                onClick={() => onChange(character.key)}
              />
              <span className="character-option-art">
                <CharacterSprite variant={character.variant} animate={false} />
                <Check size={14} aria-hidden="true" />
              </span>
              <span>{character.name}</span>
            </label>
          ))}
        </div>
        <div
          className="character-selected"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="eyebrow">A LITTLE YOU</span>
          <CharacterSprite
            variant={value === null ? legacyVariant : chosen.variant}
            label={`Your character: ${chosen.name}`}
          />
          <strong>{chosen.name}</strong>
          <small>Your little friend, ready to say hello.</small>
        </div>
      </div>
    </fieldset>
  );
}
