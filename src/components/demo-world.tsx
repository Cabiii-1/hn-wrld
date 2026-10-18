"use client";
import { useState } from "react";
import { World } from "./world";
import { demoNpcs } from "@/game/demo-fixtures";
import type { SceneKey } from "@/game/scenes";
import { FinaleGateway } from "./finale-gateway";
import { CharacterStudy } from "./character-study";
import {
  CHARACTERS,
  characterInfo,
  type CharacterKey,
  CHARACTER_KEYS,
} from "@/game/characters/catalog";
export function DemoWorld() {
  const [map, setMap] = useState<SceneKey>("sta_ana_house"),
    [count, setCount] = useState(1),
    [character, setCharacter] = useState<"hanna" | CharacterKey>("hanna");
  const [mixed, setMixed] = useState(false);
  return (
    <FinaleGateway sample>
      <div className="demo-cast">
        <label>
          Sample character{" "}
          <select
            aria-label="Sample character"
            value={character}
            onChange={(e) => {
              const next =
                CHARACTER_KEYS.find((key) => key === e.target.value) ?? "hanna";
              setCharacter(next);
              if (next !== "hanna") {
                setMap("tuguegarao_park");
                setMixed(true);
              }
            }}
          >
            <option value="hanna">Hanna (existing bear)</option>
            {CHARACTERS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name} · art preview
              </option>
            ))}
          </select>
        </label>
        <label>
          Sample cast{" "}
          <select
            aria-label="Sample bear count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[1, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "bear" : "bears"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={mixed}
            onChange={(e) => setMixed(e.target.checked)}
          />{" "}
          Mixed animal cast
        </label>
        <span>
          Synthetic characters only · private messages require your recipient
          link.
        </span>
      </div>
      <World
        key={`${map}-${count}-${character}-${mixed}`}
        mapKey={map}
        npcs={demoNpcs(map, count, mixed)}
        preview
        artPreview={
          character === "hanna" ? undefined : characterInfo(character).variant
        }
        onSceneChange={setMap}
      />
      {character !== "hanna" && <CharacterStudy character={character} />}
    </FinaleGateway>
  );
}
