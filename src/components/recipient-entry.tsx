"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, KeyRound } from "lucide-react";
import { ContributionShell } from "./contribution-shell";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
export function RecipientEntry() {
  const router = useRouter();
  const captured = useRef<string | null>(null);
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    function readLink() {
      if (location.hash) {
        captured.current = location.hash.slice(1);
        // Keep the bearer secret only in component memory, never history/storage.
        history.replaceState(null, "", location.pathname);
      }
      const secret = captured.current ?? "";
      if (/^[A-Za-z0-9_-]{43}$/.test(secret))
        queueMicrotask(() => {
          if (live) setToken(secret);
        });
      else
        void api("recipient/session")
          .then(() => {
            if (live) router.replace("/play");
          })
          .catch(() => {});
    }
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => {
      live = false;
      window.removeEventListener("hashchange", readLink);
    };
  }, [router]);
  async function unlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      passcode = new FormData(form).get("passcode");
    try {
      await api("recipient/unlock", "POST", { token, passcode });
      form.reset();
      captured.current = null;
      setToken("");
      router.replace("/play");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ContributionShell>
      <section className="letter-intro">
        <span className="eyebrow">A LITTLE WORLD, JUST FOR YOU</span>
        <h1>
          Your people. <em>Your little place.</em>
        </h1>
        <p>A few familiar faces are waiting to say hello.</p>
      </section>
      <form className="letter-card recipient-entry" onSubmit={unlock}>
        <Heart size={30} aria-hidden />
        <h2>Welcome home, Bubu.</h2>
        {token ? (
          <>
            <p>Enter the passcode Dudu shared with you.</p>
            <label>
              Passcode
              <input
                name="passcode"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={busy}
              />
            </label>
            <Button disabled={busy} type="submit">
              <KeyRound size={17} />
              {busy ? "Opening your little world…" : "Come on in"}
            </Button>
          </>
        ) : (
          <p>
            Open the private link Dudu shared with you to enter your world. Your
            link and passcode are both needed.
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </form>
      <p className="preview-note">
        <Link href="/demo">Explore the sample house</Link>
      </p>
    </ContributionShell>
  );
}
