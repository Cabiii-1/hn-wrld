"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/backend/browser-api";
import { sharedLetterSchema, type SharedLetter } from "@/game/connected";
import { Button } from "./ui/button";
import { DialogDescription, DialogTitle } from "./ui/dialog";

export function SharedLetterBody({ id }: { id: string }) {
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
    <>
      <DialogTitle>{letter?.name ?? "A shared letter"}</DialogTitle>
      <DialogDescription>
        Shared by its author with invited friends. Photos and voice notes remain
        private.
      </DialogDescription>
      {!letter && !error && <p role="status">Opening their letter…</p>}
      {letter && (
        <div className="message-body">
          <p className="private-message-text">{letter.message}</p>
        </div>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}
    </>
  );
}
