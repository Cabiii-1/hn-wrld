"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "./ui/button";
import type { Finale } from "@/game/finale";
const ReunionCanvas = dynamic(() => import("./reunion-canvas"), { ssr: false });

export function FinaleExperience({
  ending,
  onExit,
  onComplete,
  sample = false,
  preview = false,
}: {
  ending: Finale;
  onExit: () => void;
  onComplete?: () => Promise<void>;
  sample?: boolean;
  preview?: boolean;
}) {
  const [phase, setPhase] = useState<
      "letter" | "reunion" | "conversation" | "complete"
    >("letter"),
    [line, setLine] = useState(0);
  const [systemStill, setSystemStill] = useState(false),
    [still, setStill] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setSystemStill(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [phase, line]);
  const { content } = ending;
  async function finish() {
    setBusy(true);
    setError("");
    try {
      await onComplete?.();
      setPhase("complete");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your progress couldn’t save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="finale-shell">
      <div className="finale-top">
        <span>
          <Heart size={18} />{" "}
          {preview
            ? "PRIVATE DRAFT PREVIEW · PROGRESS IS NOT SAVED"
            : sample
              ? "SAMPLE ENDING · SYNTHETIC TEXT"
              : "A LITTLE MOMENT, JUST FOR YOU"}
        </span>
        <Button variant="ghost" onClick={onExit} disabled={busy}>
          {preview ? "Back to the editor" : "Back to the world"}
        </Button>
      </div>
      <article className="letter-card finale-card" aria-label="Dudu’s finale">
        <p className="eyebrow" role="status">
          {phase === "letter"
            ? "01 · A LITTLE LETTER"
            : phase === "reunion"
              ? "02 · SIDE BY SIDE"
              : phase === "conversation"
                ? `03 · ONE MORE HELLO · ${line + 1} / ${content.conversation.length}`
                : "ALWAYS HERE TO REVISIT"}
        </p>
        <h1 tabIndex={-1} ref={heading}>
          {phase === "letter"
            ? content.title
            : phase === "reunion"
              ? "A familiar little face."
              : phase === "conversation"
                ? content.conversation[line].speaker
                : "Stay a little longer. ♡"}
        </h1>
        {phase === "letter" && (
          <>
            <div className="finale-prose">{content.letter}</div>
            <div className="finale-actions">
              <Button onClick={() => setPhase("reunion")}>Meet Dudu</Button>
              <Button variant="ghost" onClick={() => setPhase("reunion")}>
                Skip letter
              </Button>
            </div>
          </>
        )}
        {phase === "reunion" && (
          <>
            <ReunionCanvas still={still || systemStill} />
            <p className="finale-narration">
              {still || systemStill
                ? "Bubu and Dudu are together at the entrance, side by side beneath a little heart."
                : "Bubu and Dudu take a few small steps toward each other. A little heart says the rest."}
            </p>
            <label className="finale-still">
              <input
                type="checkbox"
                checked={still || systemStill}
                disabled={systemStill}
                onChange={(e) => setStill(e.target.checked)}
              />{" "}
              Use a still scene{" "}
              {systemStill && "(your device’s reduced-motion preference)"}
            </label>
            <div className="finale-actions">
              <Button onClick={() => setPhase("conversation")}>
                Talk with Dudu
              </Button>
              <Button variant="ghost" onClick={() => setPhase("conversation")}>
                Skip animation
              </Button>
            </div>
          </>
        )}
        {phase === "conversation" && (
          <>
            <div className="finale-prose">
              {content.conversation[line].text}
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="finale-actions">
              {line > 0 && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setLine((v) => v - 1)}
                >
                  Previous line
                </Button>
              )}
              <Button
                disabled={busy}
                onClick={() =>
                  line + 1 < content.conversation.length
                    ? setLine((v) => v + 1)
                    : void finish()
                }
              >
                {busy
                  ? "Saving your little moment…"
                  : line + 1 < content.conversation.length
                    ? "Continue"
                    : "Keep this little moment"}
              </Button>
            </div>
          </>
        )}
        {phase === "complete" && (
          <>
            <p>
              Your world and its little hellos are here whenever you want to
              return.
            </p>
            <div className="finale-actions">
              <Button onClick={onExit}>Keep wandering</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setLine(0);
                  setPhase("letter");
                }}
              >
                Read it again
              </Button>
            </div>
          </>
        )}
      </article>
    </main>
  );
}
