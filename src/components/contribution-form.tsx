"use client";
/* eslint-disable @next/next/no-img-element -- Private cookie-bound media must bypass the public image optimizer. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  Check,
  Heart,
  ImagePlus,
  Mic,
  Send,
  Trash2,
} from "lucide-react";
import { ContributionShell, SetupNotice } from "./contribution-shell";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
import { MAX, type Upload } from "@/lib/backend/contracts";

type Snapshot = {
  displayName: string;
  submitted: boolean;
  uploads: Upload[];
  limits: Pick<typeof MAX, "photoBytes" | "audioBytes" | "audioSeconds">;
};
export function ContributionForm({ configured }: { configured: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [description, setDescription] = useState("");
  const [recording, setRecording] = useState(false),
    [recordSupported, setRecordSupported] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const refresh = async () => {
    const data = await api<Snapshot>("contributor");
    if (alive.current) setSnapshot(data);
  };
  useEffect(() => {
    alive.current = true;
    if (configured)
      void api<Snapshot>("contributor")
        .then((data) => setSnapshot(data))
        .catch((e) => setError(e.message));
    queueMicrotask(() =>
      setRecordSupported(
        typeof MediaRecorder !== "undefined" &&
          !!navigator.mediaDevices?.getUserMedia,
      ),
    );
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [configured]);
  async function upload(file: File, kind: "photo" | "audio") {
    setBusy(`Checking ${kind === "photo" ? "your photo" : "your voice note"}…`);
    setError("");
    try {
      const reserved = await api<{ id: string; uploadUrl: string }>(
        "uploads",
        "POST",
        {
          kind,
          filename: file.name,
          bytes: file.size,
          mime: file.type.split(";")[0],
          description,
        },
      );
      const result = await fetch(reserved.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type.split(";")[0],
          "x-upsert": "false",
        },
        referrerPolicy: "no-referrer",
      });
      if (!result.ok)
        throw new Error(
          "The upload didn’t finish. Remove the unfinished attachment and try again.",
        );
      await api(`uploads/${reserved.id}/complete`, "POST");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Upload failed. Please try again.",
      );
    } finally {
      await refresh().catch(() => {});
      setBusy("");
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("Tucking your message safely away…");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("contributions", "POST", {
        message,
        consent: form.get("consent") === "on",
        uploadIds:
          snapshot?.uploads
            .filter((u) => u.state === "validated")
            .map((u) => u.id) ?? [],
      });
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your message wasn’t saved. Please retry.",
      );
      // A response can be lost after the transaction committed. Recover the
      // receipt instead of telling the contributor to create a duplicate.
      await refresh().catch(() => {});
    } finally {
      setBusy("");
    }
  }
  async function startRecording() {
    setError("");
    try {
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      if (!mimeType)
        throw new Error(
          "Recording is not supported here. You can upload an audio file instead.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!alive.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      const chunks: BlobPart[] = [];
      const instance = new MediaRecorder(stream.current, { mimeType });
      recorder.current = instance;
      instance.onerror = () => {
        if (timer.current) clearTimeout(timer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        if (alive.current) {
          setRecording(false);
          setError(
            "Recording stopped unexpectedly. You can upload a voice file instead.",
          );
        }
      };
      instance.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      instance.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        if (!alive.current) return;
        setRecording(false);
        const ext = mimeType.startsWith("audio/mp4")
          ? "m4a"
          : mimeType.startsWith("audio/ogg")
            ? "ogg"
            : "webm";
        void upload(
          new File(chunks, `voice-note.${ext}`, {
            type: mimeType.split(";")[0],
          }),
          "audio",
        );
      };
      instance.start();
      setRecording(true);
      // Stop early enough to leave room for encoder/container padding under 90s.
      timer.current = setTimeout(
        () => {
          if (instance.state === "recording") instance.stop();
        },
        Math.max(1, (snapshot?.limits.audioSeconds ?? MAX.audioSeconds) - 2) *
          1000,
      );
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(
        e instanceof Error
          ? e.message
          : "Microphone unavailable. Upload a file instead.",
      );
    }
  }
  const disabled = !configured || !snapshot || !!busy || recording;
  if (snapshot?.submitted)
    return (
      <ContributionShell>
        <section className="letter-card thank-you">
          <span className="postmark">
            <Check size={35} />
          </span>
          <span className="eyebrow">SAFELY RECEIVED</span>
          <h1>
            A little love, <em>on its way.</em>
          </h1>
          <p>
            Thank you for leaving something lovely for Hanna. Dudu will review
            your message and attachments before they appear in her world.
          </p>
          <p className="quiet-copy">
            Received does not mean published. If you’d like anything removed,
            contact the person who invited you.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              void api("contributor/logout", "POST")
                .then(() => location.replace("/invite"))
                .catch((e) => setError(e.message));
            }}
          >
            Close my invitation
          </Button>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </section>
      </ContributionShell>
    );
  return (
    <ContributionShell>
      <section className="letter-intro">
        <span className="eyebrow">A HELLO SHE CAN COME BACK TO</span>
        <h1>
          Leave a little <em>love.</em>
          <Heart size={25} className="title-heart" />
        </h1>
        <p>A memory, a thank-you, or just a few words for Hanna.</p>
      </section>
      {!configured && <SetupNotice />}
      <form className="letter-card contribution-form" onSubmit={submit}>
        <div className="form-section-heading">
          <span>01</span>
          <div>
            <h2>
              Hello{snapshot?.displayName ? `, ${snapshot.displayName}` : ""}!
            </h2>
            <p>
              You’re someone special to Hanna. As she follows her dream of
              becoming a lawyer, a few words from you can remind her she’s never
              alone—and that she has people cheering her on, every step of the
              way.
            </p>
          </div>
        </div>
        <div className="form-section-heading">
          <span>02</span>
          <div>
            <h2>Words worth keeping.</h2>
            <p>You don’t have to find perfect words. Just your words.</p>
          </div>
        </div>
        <label>
          Your message for Hanna <span>Required</span>
          <textarea
            name="message"
            required
            maxLength={2000}
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Dear Hanna…"
            disabled={disabled}
          />
          <small className="character-count">
            {message.length.toLocaleString()} / 2,000
          </small>
        </label>
        <div className="form-section-heading">
          <span>03</span>
          <div>
            <h2>A little something extra.</h2>
            <p>Entirely optional. Your words are already enough.</p>
          </div>
        </div>
        <label className="attachment-description">
          Photo description or voice transcript <span>Optional</span>
          <input
            name="attachmentDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            disabled={disabled}
            placeholder="A little context for the next attachment"
          />
          <small>This will stay with the next file you choose or record.</small>
        </label>
        <div className="attachment-choices">
          <label className="attachment-choice">
            <ImagePlus size={24} />
            <strong>Add a memory</strong>
            <span>
              Up to 3 photos ·{" "}
              {(snapshot?.limits.photoBytes ?? MAX.photoBytes) / 1048576} MiB
              each
            </span>
            <small>JPG, PNG or WebP</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={
                disabled ||
                (snapshot?.uploads.filter((u) => u.kind === "photo").length ??
                  0) >= 3
              }
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) void upload(file, "photo");
              }}
              aria-label="Upload a photo"
            />
          </label>
          <label className="attachment-choice">
            <Mic size={24} />
            <strong>A hello in your voice</strong>
            <span>
              One recording · up to{" "}
              {snapshot?.limits.audioSeconds ?? MAX.audioSeconds} seconds
            </span>
            <small>
              MP3, M4A, OGG or WebM ·{" "}
              {(snapshot?.limits.audioBytes ?? MAX.audioBytes) / 1048576} MiB
            </small>
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/webm"
              disabled={
                disabled || !!snapshot?.uploads.some((u) => u.kind === "audio")
              }
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) void upload(file, "audio");
              }}
              aria-label="Upload a voice note"
            />
          </label>
        </div>
        {recordSupported && (
          <div className="recording-row">
            <Button
              type="button"
              variant="outline"
              disabled={
                !!busy ||
                !snapshot ||
                !!snapshot.uploads.some((u) => u.kind === "audio")
              }
              onClick={() =>
                recording ? recorder.current?.stop() : void startRecording()
              }
            >
              <Mic size={16} />
              {recording ? "Stop & keep recording" : "Record a voice note"}
            </Button>
            <span>
              {recording
                ? "Recording… stops automatically before the limit."
                : "Your microphone is used only after you tap Record."}
            </span>
          </div>
        )}
        <div className="uploaded-list">
          {snapshot?.uploads.map((u) => (
            <article key={u.id} className="uploaded-item">
              <div className="upload-preview">
                {u.state === "validated" ? (
                  u.kind === "photo" ? (
                    <img
                      src={`/api/manage/media/${u.id}`}
                      alt={u.description || "Your uploaded photo"}
                    />
                  ) : (
                    <audio
                      controls
                      preload="none"
                      src={`/api/manage/media/${u.id}`}
                    />
                  )
                ) : (
                  <Camera size={24} />
                )}
              </div>
              <div>
                <strong>
                  {u.kind === "photo" ? "Photo memory" : "Voice note"}
                </strong>
                <span>
                  {u.state === "validated"
                    ? "Checked and ready · private"
                    : "Unfinished — remove and retry"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Remove ${u.kind}`}
                disabled={!!busy || recording}
                onClick={async () => {
                  setBusy("Removing attachment…");
                  try {
                    await api(`uploads/${u.id}`, "DELETE");
                    await refresh();
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Could not remove file.",
                    );
                  } finally {
                    setBusy("");
                  }
                }}
              >
                <Trash2 size={17} />
              </Button>
            </article>
          ))}
        </div>
        <div className="consent-box">
          <Heart size={18} />
          <div>
            <p>Kept with care.</p>
            <span>
              Your words and media are private to you, Dudu as reviewer, and
              Hanna once approved. Please leave out addresses, phone numbers,
              and anything you don’t have permission to share.
            </span>
            <label>
              <input
                type="checkbox"
                name="consent"
                required
                disabled={disabled}
              />
              I have permission to share this message and any attached photos or
              audio.
            </label>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {error && configured && (
          <Button
            type="button"
            variant="outline"
            disabled={!!busy || recording}
            onClick={async () => {
              setBusy("Refreshing attachments…");
              try {
                await refresh();
                setError("");
              } catch {
                setError(
                  "The connection is still unavailable. Your message stays here; please try again.",
                );
              } finally {
                setBusy("");
              }
            }}
          >
            Refresh attachments
          </Button>
        )}
        {busy && (
          <p className="form-progress" role="status">
            {busy}
          </p>
        )}
        <div className="submission-footer">
          <span>Only you can send this little hello.</span>
          <Button
            type="submit"
            disabled={
              disabled ||
              !!snapshot?.uploads.some((u) => u.state !== "validated")
            }
          >
            {busy ? "Please wait…" : "Send my little hello"}
            <Send size={16} />
          </Button>
        </div>
        {!snapshot && configured && !error && (
          <p role="status">Opening your invitation…</p>
        )}
      </form>
    </ContributionShell>
  );
}
