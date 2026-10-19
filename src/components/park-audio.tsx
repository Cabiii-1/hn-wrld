"use client";
import { useEffect, useRef } from "react";

/** Park-only soundtrack. Browser autoplay denial is retried on normal input. */
export function ParkAudio({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.volume = 0.22;
    const play = () => {
      if (paused || document.hidden || !audio.paused) return;
      // A denied autoplay or interrupted load must never block the world.
      void audio.play().catch(() => {});
    };
    const visibility = () => {
      if (document.hidden) audio.pause();
      else play();
    };
    if (paused) audio.pause();
    else play();
    window.addEventListener("pointerup", play, { passive: true });
    window.addEventListener("touchend", play, { passive: true });
    window.addEventListener("keydown", play);
    document.addEventListener("visibilitychange", visibility);
    audio.addEventListener("canplay", play);
    return () => {
      window.removeEventListener("pointerup", play);
      window.removeEventListener("touchend", play);
      window.removeEventListener("keydown", play);
      document.removeEventListener("visibilitychange", visibility);
      audio.removeEventListener("canplay", play);
      audio.pause();
    };
  }, [paused]);
  return (
    <audio
      ref={ref}
      src="/game/audio/park-adults-v1.mp3"
      loop
      preload="auto"
      hidden
    />
  );
}
