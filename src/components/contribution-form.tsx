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
import { ContributionArrival } from "./contribution-arrival";
import { useVoiceRecorder } from "./use-voice-recorder";
import { VoiceRecorderControls } from "./voice-recorder-controls";
import { ParkPreview } from "./park-preview";
import Link from "next/link";
import { Button } from "./ui/button";
import { api } from "@/lib/backend/browser-api";
import {
  MAX,
  type ContributorSnapshot as Snapshot,
} from "@/lib/backend/contracts";

export function ContributionForm({
  configured,
  initialSnapshot = null,
  initialResolved = false,
  initialError = "",
  directEntry = false,
}: {
  configured: boolean;
  initialSnapshot?: Snapshot | null;
  initialResolved?: boolean;
  initialError?: string;
  directEntry?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initialSnapshot),
    [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState(
      directEntry ? (initialSnapshot?.letter?.message ?? "") : "",
    );
  const [shareWithInvitees, setShareWithInvitees] = useState(
    directEntry ? (initialSnapshot?.letter?.shareWithInvitees ?? false) : false,
  );
  const [editing, setEditing] = useState(
      directEntry && !!initialSnapshot?.letter,
    ),
    [retainedMedia, setRetainedMedia] = useState<
      NonNullable<NonNullable<Snapshot["letter"]>["media"]>
    >(directEntry ? (initialSnapshot?.letter?.media ?? []) : []),
    [letterVersion, setLetterVersion] = useState(
      directEntry ? (initialSnapshot?.letter?.version ?? "") : "",
    );
  const [arriving, setArriving] = useState(false);
  const alive = useRef(true);
  const voice = useVoiceRecorder({
    maxSeconds: snapshot?.limits.audioSeconds ?? MAX.audioSeconds,
    onRecorded: (file) => upload(file, "audio", true),
  });
  const recording = voice.active;
  const refresh = async () => {
    const data = await api<Snapshot>("contributor");
    if (alive.current) setSnapshot(data);
    return data;
  };
  useEffect(() => {
    alive.current = true;
    if (configured && !initialResolved)
      void api<Snapshot>("contributor")
        .then((data) => setSnapshot(data))
        .catch((e) => setError(e.message));
    return () => {
      alive.current = false;
    };
  }, [configured, initialResolved]);
  async function upload(
    file: File,
    kind: "photo" | "audio",
    recorded = false,
  ): Promise<string | null> {
    let reservedId: string | null = null;
    setBusy(
      `Preparing ${kind === "photo" ? "your photo" : "your voice note"}…`,
    );
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
        },
      );
      reservedId = reserved.id;
      if (alive.current)
        setBusy(
          `Uploading ${kind === "photo" ? "your photo" : "your voice note"}…`,
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
      if (alive.current)
        setBusy(
          `Checking ${kind === "photo" ? "your photo" : "your voice note"}…`,
        );
      await api(`uploads/${reserved.id}/complete`, "POST");
      if (alive.current) setBusy("Finishing your attachment…");
      await refresh();
      return reserved.id;
    } catch (e) {
      if (recorded && reservedId)
        await api(`uploads/${reservedId}`, "DELETE").catch(() => {});
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Upload failed. Please try again.",
        );
      await refresh().catch(() => {});
      return null;
    } finally {
      if (alive.current) setBusy("");
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("Tucking your message safely away…");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("contributions", editing ? "PATCH" : "POST", {
        message,
        shareWithInvitees,
        consent: form.get("consent") === "on",
        ...(editing
          ? {
              version: letterVersion,
              retainedMedia: retainedMedia.map(({ id, description }) => ({
                id,
                description,
              })),
            }
          : {}),
        uploadIds:
          snapshot?.uploads
            .filter((u) => u.state === "validated")
            .map((u) => u.id) ?? [],
      });
      if (editing) {
        await refresh();
        if (directEntry) setArriving(true);
        else setEditing(false);
      } else setArriving(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your message wasn’t saved. Please retry.",
      );
      // A response can be lost after the transaction committed. Recover the
      // receipt instead of telling the contributor to create a duplicate.
      if (!editing) {
        const recovered = await refresh().catch(() => null);
        if (recovered?.submitted) setArriving(true);
      }
    } finally {
      setBusy("");
    }
  }
  const disabled = !configured || !snapshot || !!busy || recording;
  const attachments = [
    ...(editing ? retainedMedia : []),
    ...(snapshot?.uploads ?? []),
  ];
  const savedAudio = attachments.filter(
    (u) => u.kind === "audio" && u.id !== voice.preview?.uploadId,
  );
  function openEditor(saved: Snapshot) {
    if (!saved.letter) return;
    setMessage(saved.letter.message);
    setShareWithInvitees(saved.letter.shareWithInvitees ?? false);
    setLetterVersion(saved.letter.version);
    setRetainedMedia(saved.letter.media ?? []);
    setError("");
    setEditing(true);
  }
  const renderRemoveAttachment = (u: (typeof attachments)[number]) => (
    <Button
      type="button"
      variant="ghost"
      aria-label={`Remove ${u.kind}`}
      disabled={!!busy || recording}
      onClick={async () => {
        if (u.state === "attached") {
          if (voice.preview?.uploadId === u.id) voice.discard();
          setRetainedMedia((items) => items.filter((item) => item.id !== u.id));
          return;
        }
        setBusy("Removing attachment…");
        try {
          await api(`uploads/${u.id}`, "DELETE");
          if (voice.preview?.uploadId === u.id) voice.discard();
          await refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not remove file.");
        } finally {
          setBusy("");
        }
      }}
    >
      <Trash2 size={17} />
    </Button>
  );
  const renderAttachment = (u: (typeof attachments)[number]) => (
    <article key={u.id} className="uploaded-item">
      <div className="upload-preview">
        {(u.state === "validated" || u.state === "attached") &&
        !("status" in u && u.status === "rejected") ? (
          u.kind === "photo" ? (
            <img
              src={`/api/manage/media/${u.id}`}
              alt={u.description || "Your uploaded photo"}
            />
          ) : (
            <audio
              controls
              preload="metadata"
              src={`/api/manage/media/${u.id}`}
            />
          )
        ) : (
          <Camera size={24} />
        )}
      </div>
      <div>
        <strong>{u.kind === "photo" ? "Photo memory" : "Voice note"}</strong>
        <span>
          {"status" in u && u.status === "rejected"
            ? "Excluded by Cj · remove or replace"
            : u.state === "attached"
              ? "Saved with your letter · private"
              : u.state === "validated"
                ? "Checked and ready · private"
                : "Unfinished — remove and retry"}
        </span>
      </div>
      {renderRemoveAttachment(u)}
    </article>
  );
  if (arriving) return <ContributionArrival />;
  if (snapshot?.submitted && !editing)
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
            Thank you for leaving something lovely for Hanna. Your hello has
            joined her little world.
          </p>
          <p className="quiet-copy">
            You can return through your invitation link to update your words,
            photos, or voice note. Your saved changes appear automatically.
          </p>
          <Button asChild variant="outline">
            <Link href="/contribute/visit">Visit your place</Link>
          </Button>
          {snapshot.letter && (
            <Button variant="outline" onClick={() => openEditor(snapshot)}>
              Edit my letter
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => {
              void api("contributor/logout", "POST")
                .then(() => location.replace("/contribute"))
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
          {editing ? "Add a little more" : "Leave a little"} <em>love.</em>
          <Heart size={25} className="title-heart" />
        </h1>
        <p>
          {editing
            ? "Update your words, photos, or voice note. Your changes appear when you save."
            : "A memory, a thank-you, or just a few words for Hanna."}
        </p>
      </section>
      {!configured && <SetupNotice />}
      <form className="letter-card contribution-form" onSubmit={submit}>
        <section
          className="invitation-note"
          aria-labelledby="invitation-note-heading"
        >
          <h2 id="invitation-note-heading">
            Hello{snapshot?.displayName ? `, ${snapshot.displayName}` : ""}!
          </h2>
          <p>
            You mean more to Hanna than you might realize. The bond you share is
            something she holds close.
          </p>
          <p>
            As she pursues her dream of becoming an attorney and balances so much
            on her own, a few words from you can remind her that she’s never
            alone. She has people who believe in her, cheer her on, and will
            always have her back.
          </p>
          <p>
            Thank you for taking a little time to be part of this surprise for
            her. Together, we can give her something to come back to on the hard
            days: a reminder of how loved she is, and how many of us are rooting
            for her, every step of the way.
          </p>
        </section>
        <div className="form-section-heading">
          <span>01</span>
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
          <span>02</span>
          <div>
            <h2>A little something extra.</h2>
            <p>Entirely optional. Your words are already enough.</p>
          </div>
        </div>
        <div className="attachment-choices">
          <section
            className="attachment-choice memory-choice"
            aria-labelledby="memory-choice-heading"
          >
            <div className="attachment-summary">
              <ImagePlus size={24} />
              <strong id="memory-choice-heading">Add a memory</strong>
              <span>
                Up to 3 photos ·{" "}
                {(snapshot?.limits.photoBytes ?? MAX.photoBytes) / 1048576} MiB
                each
              </span>
              <small>JPG, PNG or WebP</small>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={
                disabled ||
                attachments.filter((u) => u.kind === "photo").length >= 3
              }
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) void upload(file, "photo");
              }}
              aria-label="Upload a photo"
            />
          </section>
          <section
            className="attachment-choice voice-choice"
            aria-labelledby="voice-choice-heading"
          >
            <VoiceRecorderControls
              compact
              savedAttachment={
                savedAudio.length ? (
                  <div className="uploaded-list">
                    {savedAudio.map(renderAttachment)}
                  </div>
                ) : null
              }
              heading={
                <div className="attachment-summary">
                  <Mic size={24} />
                  <strong id="voice-choice-heading">
                    A hello in your voice
                  </strong>
                  <span>
                    One recording · up to{" "}
                    {snapshot?.limits.audioSeconds ?? MAX.audioSeconds} seconds
                  </span>
                  <small>
                    MP3, M4A, OGG or WebM ·{" "}
                    {(snapshot?.limits.audioBytes ?? MAX.audioBytes) / 1048576}{" "}
                    MiB
                  </small>
                </div>
              }
              previewActions={attachments
                .filter((u) => u.id === voice.preview?.uploadId)
                .map((u) => (
                  <div key={u.id}>{renderRemoveAttachment(u)}</div>
                ))}
              uploadControl={
                !voice.preview &&
                !recording &&
                !attachments.some((u) => u.kind === "audio") ? (
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/webm"
                    disabled={
                      disabled || attachments.some((u) => u.kind === "audio")
                    }
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      if (file) void upload(file, "audio");
                    }}
                    aria-label="Upload a voice note"
                  />
                ) : null
              }
              recorder={voice}
              disabled={
                !!busy ||
                !snapshot ||
                attachments.some((u) => u.kind === "audio")
              }
              maxSeconds={snapshot?.limits.audioSeconds ?? MAX.audioSeconds}
              savingMessage={busy}
            />
          </section>
        </div>

        <div className="uploaded-list photo-attachments">
          {attachments.filter((u) => u.kind === "photo").map(renderAttachment)}
        </div>
        <fieldset className="letter-visibility" disabled={disabled}>
          <legend>Who can read your letter?</legend>
          <p>A little choice, entirely yours.</p>
          <label>
            <input
              type="radio"
              name="letterVisibility"
              value="private"
              checked={!shareWithInvitees}
              onChange={() => setShareWithInvitees(false)}
            />
            <span>
              <strong>Just Hanna</strong>
              <small>Keep my words between us.</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="letterVisibility"
              value="invited"
              checked={shareWithInvitees}
              onChange={() => setShareWithInvitees(true)}
            />
            <span>
              <strong>Share with invited friends, too</strong>
              <small>
                Let other contributors read my letter in our little place.
              </small>
            </span>
          </label>
          <p>
            Only your letter text can be shared with invited friends. Photos and
            voice notes aren’t shared with them. Nothing is public on the
            internet. You can change this choice later.
          </p>
        </fieldset>
        <div className="consent-box">
          <Heart size={18} />
          <div>
            <p>Kept with care.</p>
            <span>
              Your photos and voice note aren’t shared with other invited
              friends. Your letter follows the choice above. Please leave out
              addresses, phone numbers, and anything you don’t have permission
              to share.
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
        <ParkPreview />
        <div className="submission-footer">
          <span>
            {editing
              ? "Your saved memories stay unchanged until you save."
              : "Only you can send this little hello."}
          </span>
          {editing && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={async () => {
                setBusy("Closing your changes…");
                try {
                  await Promise.all(
                    (snapshot?.uploads ?? []).map((u) =>
                      api(`uploads/${u.id}`, "DELETE"),
                    ),
                  );
                  await refresh();
                  voice.discard();
                  setEditing(false);
                  setError("");
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not close your changes. Please retry.",
                  );
                } finally {
                  setBusy("");
                }
              }}
            >
              Cancel
            </Button>
          )}
          {editing && error && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={async () => {
                setBusy("Reopening your letter…");
                try {
                  openEditor(await refresh());
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Please reopen your invitation.",
                  );
                } finally {
                  setBusy("");
                }
              }}
            >
              Reopen saved letter
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              disabled ||
              voice.preview?.state === "error" ||
              !!snapshot?.uploads.some((u) => u.state !== "validated")
            }
          >
            {busy
              ? "Please wait…"
              : editing
                ? "Save my changes"
                : "Send my little hello"}
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
