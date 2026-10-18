"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/backend/browser-api";
import {
  finaleAdminSchema,
  finaleDraftSchema,
  finaleContentSchema,
  type FinaleContent,
} from "@/game/finale";
import { FinaleExperience } from "./finale-experience";
import { Button } from "./ui/button";

export function FinaleEditor() {
  const [draft, setDraft] = useState<FinaleContent | null>(null),
    [revision, setRevision] = useState(0),
    [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false);
  function load() {
    return api("admin/finale")
      .then((value) => {
        const result = finaleAdminSchema.parse(value);
        setDraft(result.draft);
        setRevision(result.revision);
        setPublished(result.published);
        setError("");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "The draft couldn’t load.");
      });
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(action: "save" | "publish" | "unpublish") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const content =
        action === "unpublish"
          ? undefined
          : (action === "publish"
              ? finaleContentSchema
              : finaleDraftSchema
            ).parse(draft);
      await api("admin/finale", "POST", { revision, action, content });
      await load();
      setNotice(
        action === "publish"
          ? "Published privately for Hanna. She can open it when the hello threshold is met."
          : action === "unpublish"
            ? "The finale is hidden. Your draft is still here."
            : "Draft saved. The published version was kept as it was.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "The finale couldn’t save.");
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void save("save");
  }
  if (!draft)
    return (
      <section className="letter-card">
        <h2>Cj’s little ending</h2>
        {error ? (
          <>
            <p role="alert" className="form-error">
              {error}
            </p>
            <Button onClick={() => void load()}>Retry loading draft</Button>
          </>
        ) : (
          <p role="status">Opening the private draft…</p>
        )}
      </section>
    );
  if (preview && finaleContentSchema.safeParse(draft).success)
    return (
      <FinaleExperience
        ending={{ revision: Math.max(1, revision), content: draft }}
        preview
        onExit={() => setPreview(false)}
      />
    );
  return (
    <section className="letter-card finale-editor">
      <h2>Cj’s little ending</h2>
      <p>
        Write a letter, then a little conversation. Only you can see drafts.
        Publication is a separate step.
      </p>
      <p className="quiet-copy">
        {published
          ? "A published version is available to Hanna. Saving a draft won’t change it."
          : "The ending is currently hidden from Hanna."}
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Letter title
            <input
              required
              maxLength={120}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            Your letter
            <textarea
              rows={12}
              maxLength={12000}
              value={draft.letter}
              onChange={(e) => setDraft({ ...draft, letter: e.target.value })}
              placeholder="Dear Hanna,…"
            />
          </label>
          <label>
            Hellos before the ending
            <input
              type="number"
              min={0}
              max={50}
              required
              value={draft.threshold}
              onChange={(e) =>
                setDraft({ ...draft, threshold: Number(e.target.value) })
              }
            />
          </label>
          <p className="quiet-copy">
            Use 0 to make it available immediately. The requirement is capped at
            the number of approved, published bears, so missing submissions
            never hold up the ending.
          </p>
          <h3>The final conversation</h3>
          {draft.conversation.map((turn, i) => (
            <div className="finale-turn" key={i}>
              <label>
                Speaker for line {i + 1}
                <select
                  value={turn.speaker}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      conversation: draft.conversation.map((t, j) =>
                        j === i
                          ? { ...t, speaker: e.target.value as "Cj" | "Hanna" }
                          : t,
                      ),
                    })
                  }
                >
                  <option>Cj</option>
                  <option>Hanna</option>
                </select>
              </label>
              <label>
                Conversation line {i + 1}
                <textarea
                  rows={3}
                  required
                  maxLength={2000}
                  value={turn.text}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      conversation: draft.conversation.map((t, j) =>
                        j === i ? { ...t, text: e.target.value } : t,
                      ),
                    })
                  }
                />
              </label>
              <div className="finale-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      conversation: draft.conversation.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                >
                  Remove line {i + 1}
                </Button>
                {i > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const turns = [...draft.conversation];
                      [turns[i - 1], turns[i]] = [turns[i], turns[i - 1]];
                      setDraft({ ...draft, conversation: turns });
                    }}
                  >
                    Move line {i + 1} up
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={draft.conversation.length >= 30}
            onClick={() =>
              setDraft({
                ...draft,
                conversation: [
                  ...draft.conversation,
                  { speaker: "Cj", text: "" },
                ],
              })
            }
          >
            Add conversation line
          </Button>
          <div className="finale-actions">
            <Button type="submit">Save private draft</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const result = finaleContentSchema.safeParse(draft);
                if (result.success) {
                  setPreview(true);
                  setError("");
                } else
                  setError(
                    "Add your letter and complete every conversation line to preview.",
                  );
              }}
            >
              Preview draft
            </Button>
            <Button type="button" onClick={() => void save("publish")}>
              Publish ending
            </Button>
            {published && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void save("unpublish")}
              >
                Unpublish ending
              </Button>
            )}
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="form-progress">
          {notice}
        </p>
      )}
      <Button variant="ghost" disabled={busy} onClick={() => void load()}>
        Reload saved draft
      </Button>
    </section>
  );
}
