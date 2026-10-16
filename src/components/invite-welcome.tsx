"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Mail, ArrowRight } from "lucide-react";
import { ContributionShell, SetupNotice } from "./contribution-shell";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
export function InviteWelcome({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  async function open() {
    setBusy(true);
    setError("");
    const token = location.hash.slice(1);
    // The server never receives the token in a URL, page request or referrer.
    history.replaceState(null, "", "/invite");
    try {
      await api("invitations/exchange", "POST", { token });
      router.replace("/contribute");
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} Reopen the original invitation to try again.`
          : "Please reopen your invitation.",
      );
      setBusy(false);
    }
  }
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
        <h2>There’s a place for you here.</h2>
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
        <Button onClick={open} disabled={busy || !configured}>
          {busy ? "Opening your invitation…" : "Open my invitation"}
          <ArrowRight size={16} />
        </Button>
        <small>One personal invitation. One thoughtful message.</small>
      </section>
    </ContributionShell>
  );
}
