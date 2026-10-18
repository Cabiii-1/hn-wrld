"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { World } from "./world";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
import { sceneSchema, type WorldNpc } from "@/game/connected";
import { SCENES, SCENE_KEYS, type SceneKey } from "@/game/scenes";
export function RecipientPlayer({
  initialScene,
  initialResolved = false,
  initialError = "",
}: {
  initialScene?: { mapKey: SceneKey; npcs: WorldNpc[] } | null;
  initialResolved?: boolean;
  initialError?: string;
}) {
  const [npcs, setNpcs] = useState<WorldNpc[] | null>(
      initialScene?.npcs ?? null,
    ),
    [error, setError] = useState(initialError);
  const [attempt, setAttempt] = useState(0);
  const [mapKey, setMapKey] = useState<SceneKey>(
    initialScene?.mapKey ?? "sta_ana_house",
  );
  const navigated = useRef(false);
  useEffect(() => {
    let live = true;
    let generation = 0;
    async function load() {
      const request = ++generation;
      try {
        const result = sceneSchema.parse(
          await api(`recipient/scenes/${mapKey}`),
        );
        if (result.mapKey !== mapKey)
          throw new Error("This place couldn’t load. Please try again.");
        if (live && request === generation) {
          setNpcs(result.npcs);
          setError("");
        }
      } catch (e) {
        if (live && request === generation) {
          setNpcs(null);
          setError(
            e instanceof Error ? e.message : "Your world could not load.",
          );
        }
      }
    }
    if (!initialResolved || navigated.current || attempt > 0) void load();
    const refresh = () => {
      if (!document.hidden) {
        void load();
      }
    };
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [attempt, mapKey, initialResolved]);
  function changeScene(map: SceneKey) {
    navigated.current = true;
    setNpcs(null);
    setError("");
    setMapKey(map);
  }
  if (!npcs)
    return (
      <main className="recipient-entry letter-card">
        <h1>{SCENES[mapKey].name}</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Making a little room for you…"}
        </p>
        {error && (
          <>
            <Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>
            <p>
              <Link href="/">Return to the entry</Link>
            </p>
          </>
        )}
        {error && (
          <nav aria-label="Choose another place">
            {SCENE_KEYS.filter((key) => key !== mapKey).map((key) => (
              <Button
                variant="ghost"
                key={key}
                onClick={() => changeScene(key)}
              >
                {SCENES[key].name}
              </Button>
            ))}
          </nav>
        )}
      </main>
    );
  // A changed projection remounts Phaser, removing unpublished/revoked NPCs.
  return (
    <World
      key={
        mapKey +
        JSON.stringify(
          npcs.map((n) => [n.id, n.name, n.variant, n.x, n.y, n.radius]),
        )
      }
      npcs={npcs}
      mapKey={mapKey}
      onSceneChange={changeScene}
    />
  );
}
