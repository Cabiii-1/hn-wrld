"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { World } from "./world";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
import { houseSchema, type WorldNpc } from "@/game/connected";
export function RecipientPlayer() {
  const [npcs, setNpcs] = useState<WorldNpc[] | null>(null),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const result = houseSchema.parse(await api("recipient/house"));
        if (live) {
          setNpcs(result.npcs);
          setError("");
        }
      } catch (e) {
        if (live) {
          setNpcs(null);
          setError(
            e instanceof Error ? e.message : "Your world could not load.",
          );
        }
      }
    }
    void load();
    const refresh = () => {
      if (!document.hidden) {
        setNpcs(null);
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
  }, [attempt]);
  if (!npcs)
    return (
      <main className="recipient-entry letter-card">
        <h1>Your little world</h1>
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
      </main>
    );
  // A changed projection remounts Phaser, removing unpublished/revoked NPCs.
  return <World key={JSON.stringify(npcs)} npcs={npcs} />;
}
