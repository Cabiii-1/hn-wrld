"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Mail } from "lucide-react";
import { ContributionShell, SetupNotice } from "./contribution-shell";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
export function InviteWelcome({ configured }: { configured: boolean }) {
  const [phase, setPhase] = useState<
    "opening" | "missing" | "failed" | "unconfigured"
  >("opening");
  const [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const captured = useRef("");
  const request = useRef<{
    token: string;
    attempt: number;
    promise: Promise<unknown>;
  } | null>(null);
  const router = useRouter();
  useEffect(() => {
    let live = true;
    function readLink() {
      if (location.hash) {
        captured.current = location.hash.slice(1);
        // Bearer secret stays in memory and the POST body, never history/storage.
        history.replaceState(null, "", location.pathname);
      }
      const token = captured.current;
      if (!configured || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        queueMicrotask(() => {
          if (live) setPhase(configured ? "missing" : "unconfigured");
        });
        return;
      }
      queueMicrotask(() => {
        if (live) {
          setPhase("opening");
          setError("");
        }
      });
      // StrictMode reuses the in-flight exchange; duplicate redemption would
      // rotate the contributor cookie/session unnecessarily.
      if (
        !request.current ||
        request.current.token !== token ||
        request.current.attempt !== attempt
      ) {
        const previous = request.current;
        request.current = {
          token,
          attempt,
          // Serialize different links so an older response cannot overwrite
          // the latest invitation's cookie after its redirect.
          promise: previous
            ? previous.promise
                .catch(() => {})
                .then(() => api("invitations/exchange", "POST", { token }))
            : api("invitations/exchange", "POST", { token }),
        };
      }
      const pending = request.current;
      void pending.promise
        .then(() => {
          if (
            live &&
            request.current === pending &&
            captured.current === pending.token
          )
            router.replace("/contribute");
        })
        .catch((e: unknown) => {
          if (
            live &&
            request.current === pending &&
            captured.current === pending.token
          ) {
            setPhase("failed");
            setError(
              e instanceof Error
                ? e.message
                : "Your invitation couldn’t open. Please try again.",
            );
          }
        });
    }
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => {
      live = false;
      window.removeEventListener("hashchange", readLink);
    };
  }, [configured, router, attempt]);
  return (
    <ContributionShell>
      <section className="letter-intro">
        <span className="eyebrow">SOME WORDS ARE WORTH KEEPING</span>
        <h1>
          A little note. <em>A lot of love.</em>
        </h1>
        <p>
          You’ve been invited to leave something lovely in Bubu’s little world.
        </p>
      </section>
      <section className="letter-card invitation-card">
        <span className="postmark">
          <Mail size={32} />
          <Heart size={14} />
        </span>
        <h2>
          {phase === "opening"
            ? "Opening your invitation…"
            : "There’s a place for you here."}
        </h2>
        <p>
          A memory, a wish, a tiny everyday thing you love about her. Your words
          will become a hello from a little bear in her world.
        </p>
        <div className="letter-divider" />
        <p className="quiet-copy">
          Your message will be reviewed by Dudu before Bubu can see it. Photos
          and voice notes are optional. No account needed.
        </p>
        {!configured && <SetupNotice />}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {phase === "opening" && (
          <p role="status">Taking you to your contribution form…</p>
        )}
        {phase === "missing" && (
          <p role="alert" className="form-error">
            Open the complete invitation link Dudu sent you.
          </p>
        )}
        {phase === "failed" && (
          <Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>
        )}
        <small>One personal invitation. One thoughtful message.</small>
      </section>
    </ContributionShell>
  );
}
