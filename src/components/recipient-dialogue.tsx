"use client";
/* eslint-disable @next/next/no-img-element -- Session-authorized media bypasses the public optimizer. */
import { useEffect, useState } from "react";
import { DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
import { messageSchema, type WorldMessage } from "@/game/connected";
export function RecipientDialogue({
  id,
  onSeen,
}: {
  id: string;
  onSeen: (id: string) => void;
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
    <>
      <DialogTitle>{message?.name ?? "A little hello"}</DialogTitle>
      <DialogDescription>
        {message?.relationship || "From someone who cares about you."}
      </DialogDescription>
      {!message && !error && <p role="status">Opening your hello…</p>}
      {message && (
        <div className="message-body">
          <p className="private-message-text">{message.message}</p>
          <div className="recipient-gallery">
            {message.media.map((m) => (
              <figure key={m.id}>
                {m.kind === "photo" ? (
                  <Photo id={m.id} description={m.description} />
                ) : (
                  <>
                    <audio
                      controls
                      preload="none"
                      src={`/api/manage/recipient/media/${m.id}`}
                      aria-label={m.description || "Voice note"}
                      onError={() =>
                        setError(
                          "The voice note couldn’t load. Your message is still here.",
                        )
                      }
                    />
                    {m.description && <figcaption>{m.description}</figcaption>}
                  </>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}
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
  );
}
function Photo({ id, description }: { id: string; description: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p role="status">
      This photo couldn’t load. You can still read the message.
    </p>
  ) : (
    <>
      <a
        href={`/api/manage/recipient/media/${id}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Open photo at full size"
      >
        <img
          src={`/api/manage/recipient/media/${id}`}
          alt={description || "A photo shared with this hello"}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </a>
      {description && <figcaption>{description}</figcaption>}
    </>
  );
}
