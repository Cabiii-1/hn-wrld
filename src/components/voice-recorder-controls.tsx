"use client";

import { LoaderCircle, Mic, Square } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./ui/button";
import { recordingTime, useVoiceRecorder } from "./use-voice-recorder";

export function VoiceRecorderControls({
  recorder,
  disabled,
  maxSeconds,
  savingMessage,
  uploadControl,
  heading,
  previewActions,
}: {
  recorder: ReturnType<typeof useVoiceRecorder>;
  disabled: boolean;
  maxSeconds: number;
  savingMessage: string;
  uploadControl?: ReactNode;
  heading?: ReactNode;
  previewActions?: ReactNode;
}) {
  const { phase, preview } = recorder;
  const recording = phase === "recording";
  const pending = phase === "requesting" || phase === "stopping";
  const stopButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (recording) stopButton.current?.focus();
  }, [recording]);
  return (
    <div className="voice-recorder">
      {heading}
      <div className="recording-row voice-input-actions">
        {uploadControl}
        {recorder.supported && phase === "idle" && !preview && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => void recorder.start()}
            >
              <Mic size={16} /> Record a voice note
            </Button>
          </>
        )}
      </div>
      {recorder.supported && !preview && phase === "idle" && (
        <p className="microphone-hint">
          Your microphone is used only after you tap Record.
        </p>
      )}
      {(recording || pending) && (
        <section
          className={`recording-panel ${recording ? "is-recording" : ""}`}
          aria-label="Voice recording"
        >
          <div className="recording-heading" role="status">
            {recording ? (
              <span className="recording-dot" aria-hidden="true" />
            ) : (
              <LoaderCircle
                size={18}
                className="recording-spinner"
                aria-hidden="true"
              />
            )}
            <strong>
              {recording
                ? "Recording your voice"
                : phase === "requesting"
                  ? "Opening your microphone…"
                  : "Preparing your recording…"}
            </strong>
          </div>
          {recording ? (
            <>
              <div
                className="recording-clock"
                role="timer"
                aria-label="Recording time"
                aria-live="off"
              >
                {recordingTime(recorder.elapsed)}{" "}
                <small>/ {recordingTime(maxSeconds)}</small>
              </div>
              <progress
                className="recording-progress"
                aria-label="Recording duration"
                value={recorder.elapsed}
                max={maxSeconds}
              />
              <p>
                Your microphone is on. Say your hello to Hanna.
                <br />
                Stops automatically before {recordingTime(maxSeconds)}.
              </p>
              <Button
                type="button"
                className="recording-stop"
                ref={stopButton}
                onClick={recorder.stop}
              >
                <Square size={16} fill="currentColor" /> Stop recording
              </Button>
            </>
          ) : (
            <>
              <p>
                {phase === "requesting"
                  ? "Allow microphone access in your browser to begin. The timer starts when recording does."
                  : "Your microphone is off. Your preview will appear here in a moment."}
              </p>
              {phase === "requesting" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={recorder.cancelOpening}
                >
                  Cancel microphone request
                </Button>
              )}
            </>
          )}
        </section>
      )}
      {preview && (
        <section
          className="recording-preview"
          aria-label="Your recorded voice note"
        >
          <div className="recording-preview-heading">
            <strong>Your voice note</strong>
            {previewActions}
          </div>
          <audio
            controls
            preload="metadata"
            src={preview.url}
            aria-label="Preview your recording"
          />
          <p role="status">
            {preview.state === "saving"
              ? `${savingMessage || "Saving your voice note…"} You can listen while it saves.`
              : preview.state === "ready"
                ? "Your voice note is ready to include with your letter."
                : "Your recording is still here on this page. It hasn’t been saved—please retry."}
          </p>
          {preview.state === "error" && (
            <div className="recording-actions">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={recorder.retry}
              >
                Retry saving voice note
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!!savingMessage}
                onClick={recorder.discard}
              >
                Discard recording
              </Button>
            </div>
          )}
        </section>
      )}
      {recorder.error && (
        <p role="alert" className="form-error">
          {recorder.error}
        </p>
      )}
    </div>
  );
}
