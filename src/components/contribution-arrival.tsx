"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { ContributionShell } from "./contribution-shell";
import { Button } from "./ui/button";

export function ContributionArrival() {
  const router = useRouter();
  useEffect(() => {
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 900;
    const timer = setTimeout(() => router.replace("/contribute/visit"), delay);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <ContributionShell>
      <section
        className="letter-card thank-you contributor-arrival"
        aria-live="polite"
      >
        <Heart className="arrival-heart" size={46} aria-hidden />
        <span className="eyebrow">SAFELY RECEIVED</span>
        <h1>
          You’re part of <em>her little world.</em>
        </h1>
        <p>Your hello is in her world. Let’s take you to your little place.</p>
        <p className="quiet-copy">
          Your letter follows the sharing choice you made. You can come back and
          update it whenever you like.
        </p>
        <Button
          variant="outline"
          onClick={() => router.replace("/contribute/visit")}
        >
          Visit your place now
        </Button>
      </section>
    </ContributionShell>
  );
}
