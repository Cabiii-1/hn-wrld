"use client";
/* eslint-disable @next/next/no-img-element -- Media stays behind recipient authorization. */
import { useState } from "react";
import { WindowskinLoader } from "./windowskin-loader";

export function LetterPhoto({
  id,
  description,
}: {
  id: string;
  description: string;
}) {
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  return failed ? (
    <p role="alert">
      This photo couldn’t load. You can still read the message.
    </p>
  ) : (
    <>
      <a
        className="windowskin-photo"
        href={`/api/manage/recipient/media/${id}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Open photo at full size"
        aria-busy={!ready}
        aria-disabled={!ready}
        tabIndex={ready ? 0 : -1}
        onClick={(e) => {
          if (!ready) e.preventDefault();
        }}
      >
        {!ready && (
          <div className="windowskin-photo-loading">
            <WindowskinLoader kind="photo" />
          </div>
        )}
        <img
          src={`/api/manage/recipient/media/${id}`}
          alt={description || "A photo shared with this hello"}
          loading="lazy"
          className={ready ? undefined : "photo-loading"}
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      </a>
      {description && <figcaption>{description}</figcaption>}
    </>
  );
}

export function LetterVoice({
  id,
  description,
}: {
  id: string;
  description: string;
}) {
  const [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  return (
    <>
      <div className="windowskin-voice" aria-busy={loading && !failed}>
        {loading && !failed && <WindowskinLoader kind="voice" />}
        <audio
          key={attempt}
          controls
          preload="metadata"
          src={`/api/manage/recipient/media/${id}`}
          aria-label={description || "Voice note"}
          onLoadStart={() => setLoading(true)}
          onLoadedMetadata={() => setLoading(false)}
          onCanPlay={() => setLoading(false)}
          onPlaying={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onSeeking={() => setLoading(true)}
          onSeeked={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      </div>
      {failed && (
        <div role="alert">
          <p>The voice note couldn’t load. Your message is still here.</p>
          <button
            type="button"
            className="windowskin-media-retry"
            onClick={() => {
              setFailed(false);
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            Try voice note again
          </button>
        </div>
      )}
      {description && <figcaption>{description}</figcaption>}
    </>
  );
}
