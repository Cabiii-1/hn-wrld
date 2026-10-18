"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Mail } from "lucide-react";
import { api } from "@/lib/backend/browser-api";
import {
  sharedLetterSchema,
  type SharedLetter,
  type WorldNpc,
} from "@/game/connected";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export function SharedLetters({
  npcs,
  onOpenChange,
}: {
  npcs: WorldNpc[];
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState("");
  const readable = npcs.filter((npc) => npc.readable);
  useEffect(() => {
    onOpenChange(!!selected);
    return () => onOpenChange(false);
  }, [selected, onOpenChange]);
  return (
    <section
      className="shared-letters"
      aria-label="Letters shared with invited friends"
    >
      <span className="eyebrow">
        <Heart size={15} /> OUR LITTLE CIRCLE
      </span>
      <h2>A few words from her people.</h2>
      <p>
        These friends chose to share their letters with the people cheering
        Hanna on. Open one whenever you like.
      </p>
      {readable.length ? (
        <div className="shared-letter-list">
          {readable.map((npc) => (
            <Button
              key={npc.id}
              variant="outline"
              onClick={() => setSelected(npc.id)}
              aria-label={`Read ${npc.name}’s shared letter`}
            >
              <Mail size={18} />
              {npc.name}
            </Button>
          ))}
        </div>
      ) : (
        <p className="quiet-copy">
          No shared letters here just yet. Everyone’s words are welcome, whether
          they keep them private or share them.
        </p>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected("");
        }}
      >
        <DialogContent className="message-dialog">
          {selected && <SharedLetterBody key={selected} id={selected} />}
          <div className="message-footer">
            <span>A little love, shared with care.</span>
            <Button onClick={() => setSelected("")}>
              Back to our little place
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

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
