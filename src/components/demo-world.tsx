"use client";
import { useState } from "react";
import { World } from "./world";
import { demoNpcs } from "@/game/demo-fixtures";
import type { SceneKey } from "@/game/scenes";
import { FinaleGateway } from "./finale-gateway";
import { CharacterStudy } from "./character-study";
import { CAPYBARA } from "@/game/characters/capybara";
export function DemoWorld() {
  const [map, setMap] = useState<SceneKey>("sta_ana_house"),
    [count, setCount] = useState(1),
    [character, setCharacter] = useState<"hanna" | "capybara">("hanna");
  return (
    <FinaleGateway sample>
      <div className="demo-cast">
        <label>
          Sample character{" "}
          <select
            aria-label="Sample character"
            value={character}
            onChange={(e) => {
              const next = e.target.value === "capybara" ? "capybara" : "hanna";
              setCharacter(next);
              if (next === "capybara") setMap("tuguegarao_park");
            }}
          >
            <option value="hanna">Hanna (existing bear)</option>
            <option value="capybara">Capybara · art preview</option>
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
        <span>
          Synthetic characters only · private messages require your recipient
          link.
        </span>
      </div>
      <World
        key={`${map}-${count}-${character}`}
        mapKey={map}
        npcs={demoNpcs(map, count)}
        preview
        artPreview={character === "capybara" ? CAPYBARA.key : undefined}
        onSceneChange={setMap}
      />
      {character === "capybara" && <CharacterStudy />}
    </FinaleGateway>
  );
}
