"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/backend/browser-api";
import type { ContributorSnapshot } from "@/lib/backend/contracts";
import { ContributionForm } from "./contribution-form";
import { ContributionShell, SetupNotice } from "./contribution-shell";
import { Button } from "./ui/button";

export function ContributionEntry({
  configured,
  initialSnapshot = null,
  edit = false,
}: {
  configured: boolean;
  initialSnapshot?: ContributorSnapshot | null;
  edit?: boolean;
}) {
  const { replace } = useRouter();
  const [snapshot, setSnapshot] = useState<ContributorSnapshot | null>(null);
  const [opening, setOpening] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const captured = useRef("");
  const request = useRef<{
    token: string;
    attempt: number;
    promise: Promise<ContributorSnapshot>;
  } | null>(null);
  useEffect(() => {
    let live = true;
    function open() {
      if (location.hash) captured.current = location.hash.slice(1);
      // Canonicalize old links without a welcome screen or module navigation.
      history.replaceState(
        null,
        "",
        edit ? "/contribute?edit=1" : "/contribute",
      );
      const token = captured.current;
      queueMicrotask(() => {
        if (!live) return;
        setSnapshot(null);
        setError("");
        setOpening(true);
      });
      if (!token && initialSnapshot) {
        queueMicrotask(() => {
          if (live) {
            if (initialSnapshot.submitted && !edit)
              replace("/contribute/visit");
            else {
              setSnapshot(initialSnapshot);
              setOpening(false);
            }
          }
        });
        return;
      }
      if (!configured || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        queueMicrotask(() => {
          if (live) {
            setOpening(false);
            setError("Open the complete invitation link Cj sent you.");
          }
        });
        return;
      }
      if (
        !request.current ||
        request.current.token !== token ||
        request.current.attempt !== attempt
      ) {
        const previous = request.current;
        request.current = {
          token,
          attempt,
          promise: (previous
            ? previous.promise.catch(() => {})
            : Promise.resolve()
          )
            .then(() => api("invitations/exchange", "POST", { token }))
            .then(() => api<ContributorSnapshot>("contributor")),
        };
      }
      const pending = request.current;
      void pending.promise
        .then((value) => {
          if (
            live &&
            request.current === pending &&
            captured.current === pending.token
          ) {
            if (value.submitted && !edit) replace("/contribute/visit");
            else {
              setSnapshot(value);
              setOpening(false);
            }
          }
        })
        .catch((e: unknown) => {
          if (
            live &&
            request.current === pending &&
            captured.current === pending.token
          ) {
            setOpening(false);
            setError(
              e instanceof Error
                ? e.message
                : "Your letter couldn’t open. Please try again.",
            );
          }
        });
    }
    open();
    window.addEventListener("hashchange", open);
    return () => {
      live = false;
      window.removeEventListener("hashchange", open);
    };
  }, [configured, initialSnapshot, attempt, edit, replace]);
  if (snapshot)
    return (
      <ContributionForm
        configured={configured}
        initialSnapshot={snapshot}
        initialResolved
        directEntry
      />
    );
  return (
    <ContributionShell>
      <section className="letter-card recipient-entry">
        <h1>A little hello for Hanna.</h1>
        {opening ? (
          <p role="status">Opening your letter…</p>
        ) : (
          <>
            <p role="alert">{error}</p>
            {configured && (
              <Button onClick={() => setAttempt((v) => v + 1)}>
                Try again
              </Button>
            )}
          </>
        )}
        {!configured && <SetupNotice />}
      </section>
    </ContributionShell>
  );
}
