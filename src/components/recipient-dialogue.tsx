"use client";
import { useEffect, useState } from "react";
import { LetterPhoto, LetterVoice } from "./letter-media";
import { LetterWindow } from "./letter-window";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
import {
  messageSchema,
  type WorldMessage,
  type WorldNpc,
} from "@/game/connected";
export function RecipientDialogue({
  id,
  onSeen,
  onClose,
  variant,
  name,
}: {
  id: string;
  onSeen: (id: string) => void;
  onClose: () => void;
  variant: WorldNpc["variant"];
  name: string;
}) {
  const [message, setMessage] = useState<WorldMessage | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void api(`recipient/messages/${id}`)
      .then(async (value) => {
        const m = messageSchema.parse(value);
        if (!live) return;
        setMessage(m);
        try {
          await api(`recipient/seen/${id}`, "POST");
          if (live) onSeen(id);
        } catch {
          if (live)
            setError(
              "Your hello is open, but progress could not save. You can try again.",
            );
        }
      })
      .catch(() => {
        if (live) {
          setMessage(null);
          setError(
            "This hello couldn’t open. It may have changed, or your visit may have ended.",
          );
        }
      });
    return () => {
      live = false;
    };
  }, [id, attempt, onSeen]);
  return (
    <LetterWindow
      key={message?.message ?? "unavailable"}
      name={message?.name ?? name}
      subtitle={message?.relationship || "From someone who cares about you."}
      message={message?.message ?? ""}
      variant={variant}
      onClose={onClose}
      returnLabel="Back to the sunshine"
      loading={!message && !error}
      notice={
        <>
          {error && (
            <div role="alert">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setError("");
                  setAttempt((v) => v + 1);
                }}
              >
                Try again
              </Button>
            </div>
          )}
        </>
      }
      attachments={message?.media.map((m) => (
        <figure className="windowskin-attachment" key={m.id}>
          <p className="windowskin-attachment-title">
            {m.kind === "photo"
              ? "A memory, just for you."
              : "A hello in their voice."}
          </p>
          {m.kind === "photo" ? (
            <LetterPhoto id={m.id} description={m.description} />
          ) : (
            <LetterVoice id={m.id} description={m.description} />
          )}
        </figure>
      ))}
    />
  );
}
