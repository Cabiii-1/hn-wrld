"use client";
import { useState } from "react";
import { World } from "./world";
import { demoNpcs } from "@/game/demo-fixtures";
import type { SceneKey } from "@/game/scenes";
import { FinaleGateway } from "./finale-gateway";
export function DemoWorld() {
  const [map, setMap] = useState<SceneKey>("sta_ana_house"),
    [count, setCount] = useState(1);
  return (
    <FinaleGateway sample>
      <div className="demo-cast">
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
        key={`${map}-${count}`}
        mapKey={map}
        npcs={demoNpcs(map, count)}
        preview
        onSceneChange={setMap}
      />
    </FinaleGateway>
  );
}
