"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/backend/browser-api";
import {
  finaleSchema,
  finaleStatusSchema,
  SAMPLE_FINALE,
  type Finale,
  type FinaleStatus,
} from "@/game/finale";
import { FinaleExperience } from "./finale-experience";
import { Button } from "./ui/button";

export function FinaleGateway({
  children,
  sample = false,
  initialStatus = null,
  initialResolved = false,
}: {
  children: ReactNode;
  sample?: boolean;
  initialStatus?: FinaleStatus | null;
  initialResolved?: boolean;
}) {
  const [status, setStatus] = useState<FinaleStatus | null>(initialStatus),
    [ending, setEnding] = useState<Finale | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    mounted = useRef(true),
    entry = useRef<HTMLButtonElement>(null);
  const refresh = useCallback(() => {
    if (sample) return;
    const request = ++generation.current;
    return api("recipient/ending/status")
      .then((result) => {
        const value = finaleStatusSchema.parse(result);
        if (!mounted.current || request !== generation.current) return;
        setStatus(value);
        if (!value.unlocked) setEnding(null);
      })
      .catch(() => {
        if (mounted.current && request === generation.current) {
          setStatus(null);
          setEnding(null);
        }
      });
  }, [sample]);
  useEffect(() => {
    mounted.current = true;
    if (!initialResolved) void refresh();
    const check = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("hanna:seen", check);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("hanna:seen", check);
    };
  }, [refresh, initialResolved]);
  async function open() {
    setBusy(true);
    setError("");
    try {
      setEnding(
        sample
          ? SAMPLE_FINALE
          : finaleSchema.parse(await api("recipient/ending")),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The letter couldn’t load. Try again.",
      );
      void refresh();
    } finally {
      setBusy(false);
    }
  }
  function close() {
    setEnding(null);
    void refresh();
    requestAnimationFrame(() => entry.current?.focus());
  }
  if (ending)
    return (
      <FinaleExperience
        ending={ending}
        sample={sample}
        onExit={close}
        onComplete={
          sample
            ? undefined
            : async () => {
                await api("recipient/ending/complete", "POST", {
                  revision: ending.revision,
                });
                void refresh();
              }
        }
      />
    );
  return (
    <>
      <aside
        className="finale-invitation"
        aria-label="A little moment with Cj"
      >
        <span>
          {sample
            ? "Try the sample letter, reunion and conversation."
            : status?.available
              ? status.unlocked
                ? "A little letter from Cj is waiting."
                : `A few more hellos before Cj’s letter · ${status.seen} / ${status.required}`
              : "Cj’s little letter will be here when it’s ready."}
        </span>
        <Button
          ref={entry}
          disabled={busy || (!sample && !status?.unlocked)}
          onClick={() => void open()}
        >
          {busy
            ? "Opening…"
            : sample
              ? "Try sample ending"
              : status?.completed
                ? "Revisit Cj’s letter"
                : "Open Cj’s letter"}
        </Button>
        {!sample && (
          <Button variant="ghost" onClick={() => void refresh()}>
            Check again
          </Button>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </aside>
      {children}
    </>
  );
}
