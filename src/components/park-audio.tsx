"use client";
import { useEffect, useRef, useState } from "react";
import { Disc3, Pause, Play } from "lucide-react";

const tracks = [
  { title: "Haikyuu!! OST - Adults", src: "/game/audio/park-adults-v1.mp3" },
  {
    title: "Frieren OST - The Precious Moments We Share",
    src: "/game/audio/park-frieren.mp3",
  },
] as const;

/** Park-only soundtrack. Browser autoplay denial is retried on normal input. */
export function ParkAudio({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const manuallyPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const track = tracks[trackIndex];
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.volume = 0.22;
    const play = (event?: Event) => {
      // Let the player's explicit click handle its own playback action.
      if (
        event?.target instanceof Element &&
        event.target.closest(".park-music-player button")
      )
        return;
      if (paused || manuallyPaused.current || document.hidden || !audio.paused)
        return;
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
  }, [paused, trackIndex]);
  function toggle() {
    const audio = ref.current;
    if (!audio || paused) return;
    manuallyPaused.current = !audio.paused;
    if (manuallyPaused.current) audio.pause();
    else void audio.play().catch(() => {});
  }
  return (
    <div className="park-music-player" data-playing={playing} hidden={paused}>
      <Disc3 className="music-vinyl" size={30} aria-hidden="true" />
      <span className="music-track" title={track.title}>
        {track.title}
      </span>
      <button
        type="button"
        aria-label={playing ? "Pause Park music" : "Play Park music"}
        onClick={toggle}
      >
        {playing ? (
          <Pause size={16} aria-hidden="true" />
        ) : (
          <Play size={16} aria-hidden="true" />
        )}
      </button>
      <audio
        ref={ref}
        src={track.src}
        preload="auto"
        hidden
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setPlaying(false)}
        onError={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTrackIndex((index) => (index + 1) % tracks.length);
        }}
      />
    </div>
  );
}
