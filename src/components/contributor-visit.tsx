"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/backend/browser-api";
import {
  contributorVisitSchema,
  type ContributorVisit,
} from "@/game/connected";
import { World } from "./world";
import { Button } from "./ui/button";

export function ContributorVisitView({
  initialVisit,
  initialError = "",
}: {
  initialVisit: ContributorVisit | null;
  initialError?: string;
}) {
  const [visit, setVisit] = useState(initialVisit),
    [error, setError] = useState(initialError),
    [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let live = true;
    async function refresh() {
      const request = ++generation.current;
      try {
        const result = contributorVisitSchema.parse(
          await api("contributor/visit"),
        );
        if (live && request === generation.current) {
          setVisit(result);
          setError("");
        }
      } catch (e) {
        if (live && request === generation.current) {
          setVisit(null);
          setError(
            e instanceof Error ? e.message : "Your place couldn’t load.",
          );
        }
      }
    }
    if (attempt) void refresh();
    const check = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [attempt]);
  if (!visit)
    return (
      <main className="letter-card recipient-entry">
        <h1>Your little place.</h1>
        <p role="alert">{error}</p>
        <Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>
        <p>
          <Link href="/contribute?edit=1">Edit your message</Link>
        </p>
      </main>
    );
  return (
    <div className="contributor-visit">
      <World
        key={
          visit.mapKey +
          JSON.stringify(visit.visitor) +
          JSON.stringify(visit.npcs)
        }
        npcs={visit.npcs}
        mapKey={visit.mapKey}
        visitor={visit.visitor}
      />
    </div>
  );
}
