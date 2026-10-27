"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/backend/browser-api";
import {
  sharedLetterSchema,
  type SharedLetter,
  type WorldNpc,
} from "@/game/connected";
import { Button } from "./ui/button";
import { LetterWindow } from "./letter-window";

export function SharedLetterBody({
  id,
  onClose,
  name,
  variant,
}: {
  id: string;
  onClose: () => void;
  name: string;
  variant: WorldNpc["variant"];
}) {
  const [letter, setLetter] = useState<SharedLetter | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let live = true;
    async function read() {
      const request = ++generation.current;
      try {
        const value = sharedLetterSchema.parse(
          await api(`contributor/letters/${id}`),
        );
        if (live && request === generation.current) {
          setLetter(value);
          setError("");
        }
      } catch {
        if (live && request === generation.current) {
          setLetter(null);
          setError(
            "This letter is no longer shared, or your invitation has ended.",
          );
        }
      }
    }
    void read();
    const check = () => {
      if (!document.hidden) void read();
    };
    const timer = setInterval(check, 15000);
    document.addEventListener("visibilitychange", check);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [id, attempt]);
  return (
    <LetterWindow
      key={letter?.message ?? "unavailable"}
      name={letter?.name ?? name}
      subtitle="Shared with invited friends. Photos and voice notes stay private."
      message={letter?.message ?? ""}
      variant={variant}
      onClose={onClose}
      returnLabel="Back to our little place"
      loading={!letter && !error}
      notice={
        <>
          {error && (
            <div role="alert">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setError("");
                  setAttempt((n) => n + 1);
                }}
              >
                Try again
              </Button>
            </div>
          )}
        </>
      }
    />
  );
}
