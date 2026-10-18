"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "requesting" | "recording" | "stopping";
type Preview = {
  file: File;
  url: string;
  state: "saving" | "ready" | "error";
  uploadId?: string;
};
type Capture = {
  instance: MediaRecorder;
  stream: MediaStream;
  tick: ReturnType<typeof setInterval> | null;
};

export function recordingTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function useVoiceRecorder({
  maxSeconds,
  onRecorded,
}: {
  maxSeconds: number;
  onRecorded: (file: File) => Promise<string | null>;
}) {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const capture = useRef<Capture | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  const localUrl = useRef<string | null>(null);
  const alive = useRef(false);

  function release(current = capture.current) {
    if (!current) return;
    if (current.tick) clearInterval(current.tick);
    current.stream.getTracks().forEach((track) => track.stop());
    if (capture.current === current) capture.current = null;
  }
  function clearPreview() {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = null;
    setPreview(null);
  }
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current)
        setSupported(
          typeof MediaRecorder !== "undefined" &&
            !!navigator.mediaDevices?.getUserMedia,
        );
    });
    return () => {
      alive.current = false;
      // Invalidate the latest attempt, including permission requests still pending.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      const current = capture.current;
      if (current) {
        // Cleanup must never turn an abandoned capture into an upload.
        current.instance.onstop = null;
        current.instance.ondataavailable = null;
        current.instance.onerror = null;
        current.instance.onstart = null;
        if (current.instance.state !== "inactive") current.instance.stop();
      }
      release();
      locked.current = false;
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
      localUrl.current = null;
    };
  }, []);

  async function save(file: File, url: string, attempt: number) {
    setPreview({ file, url, state: "saving" });
    let id: string | null = null;
    try {
      id = await onRecorded(file);
    } catch {
      // Keep the local clip so a failed request never requires re-recording.
    }
    if (!alive.current || attempt !== generation.current) return;
    setPreview({
      file,
      url,
      state: id ? "ready" : "error",
      uploadId: id ?? undefined,
    });
    locked.current = false;
  }

  function stop() {
    const current = capture.current;
    if (!current || current.instance.state !== "recording") return;
    if (current.tick) clearInterval(current.tick);
    setPhase("stopping");
    current.instance.stop();
  }

  function cancelOpening() {
    // getUserMedia cannot be aborted. A late permission result is released below.
    generation.current++;
    const current = capture.current;
    if (current) {
      current.instance.onstop = null;
      current.instance.onstart = null;
      current.instance.ondataavailable = null;
      current.instance.onerror = null;
      if (current.instance.state !== "inactive") current.instance.stop();
      release(current);
    }
    locked.current = false;
    setPhase("idle");
  }

  async function start() {
    if (locked.current) return;
    locked.current = true;
    const attempt = ++generation.current;
    setError("");
    setElapsed(0);
    setPhase("requesting");
    clearPreview();
    try {
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mime)
        throw new Error(
          "Recording isn’t supported here. You can upload a voice file instead.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || attempt !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      let instance: MediaRecorder;
      try {
        // A speech bitrate keeps uploads small; the browser chooses the codec.
        instance = new MediaRecorder(stream, {
          mimeType: mime,
          audioBitsPerSecond: 64000,
        });
      } catch (e) {
        stream.getTracks().forEach((track) => track.stop());
        throw e;
      }
      const current: Capture = { instance, stream, tick: null };
      capture.current = current;
      const chunks: Blob[] = [];
      let failed = false;
      instance.onstart = () => {
        if (!alive.current || attempt !== generation.current) return;
        const started = performance.now();
        setPhase("recording");
        current.tick = setInterval(() => {
          const seconds = (performance.now() - started) / 1000;
          setElapsed(Math.min(maxSeconds, Math.floor(seconds)));
          // Allow a little room for container/encoder padding under the limit.
          if (seconds >= Math.max(1, maxSeconds - 2)) stop();
        }, 250);
      };
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      instance.onerror = () => {
        failed = true;
        release(current);
        if (alive.current && attempt === generation.current) {
          locked.current = false;
          setPhase("idle");
          setError(
            "Recording stopped unexpectedly. Please try again or upload a voice file.",
          );
        }
      };
      instance.onstop = () => {
        release(current);
        if (failed || !alive.current || attempt !== generation.current) return;
        setPhase("idle");
        const type = instance.mimeType || mime;
        const extension = type.startsWith("audio/mp4")
          ? "m4a"
          : type.startsWith("audio/ogg")
            ? "ogg"
            : "webm";
        const file = new File(chunks, `voice-note.${extension}`, {
          type: type.split(";")[0],
        });
        if (!file.size) {
          locked.current = false;
          setError("No audio was captured. Please try recording again.");
          return;
        }
        const url = URL.createObjectURL(file);
        localUrl.current = url;
        void save(file, url, attempt);
      };
      instance.start(250);
    } catch (e) {
      if (!alive.current || attempt !== generation.current) return;
      release();
      locked.current = false;
      setPhase("idle");
      const name =
        e instanceof Error || e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone access wasn’t allowed. Allow it in your browser, or upload a voice file instead."
          : name === "NotFoundError"
            ? "No microphone was found. You can upload a voice file instead."
            : e instanceof Error
              ? e.message
              : "The microphone couldn’t start. Please try again.",
      );
    }
  }

  function retry() {
    if (!preview || preview.state !== "error" || locked.current) return;
    locked.current = true;
    void save(preview.file, preview.url, generation.current);
  }
  function discard() {
    if (locked.current) return;
    clearPreview();
    setError("");
  }
  return {
    supported,
    phase,
    elapsed,
    preview,
    error,
    active: phase !== "idle",
    start,
    stop,
    cancelOpening,
    retry,
    discard,
  };
}
