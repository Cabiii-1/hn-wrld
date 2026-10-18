"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/backend/browser-api";
import { Button } from "./ui/button";
type AccessLink = {
  id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};
export function RecipientAccess() {
  const [links, setLinks] = useState<AccessLink[]>([]),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<AccessLink[]>("admin/recipient-links")
      .then(setLinks)
      .catch(() =>
        setError("Access settings couldn’t load. Please sign in again."),
      );
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      values = new FormData(form);
    setBusy(true);
    setError("");
    setUrl("");
    try {
      const expiry = values.get("expires") as string;
      const result = await api<{ url: string }>(
        "admin/recipient-links",
        "POST",
        {
          passcode: values.get("passcode"),
          expiresAt: expiry ? new Date(expiry).toISOString() : null,
        },
      );
      form.reset();
      setUrl(result.url);
      setLinks(await api<AccessLink[]>("admin/recipient-links"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="invitation-layout">
      <form className="letter-card" onSubmit={create}>
        <h2>Hanna’s little key</h2>
        <p>
          Her private link and passcode are both needed to enter. Share them
          separately. A visit lasts up to eight hours.
        </p>
        <label>
          Choose a passcode
          <input
            name="passcode"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={busy}
          />
        </label>
        <p className="quiet-copy">
          Use at least eight characters. Keep a private copy; it won’t be shown
          again.
        </p>
        <label>
          Expires at <span>Optional</span>
          <input name="expires" type="datetime-local" disabled={busy} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Making her key…" : "Create recipient link"}
        </Button>
        {url && (
          <div className="new-invite">
            <strong>Copy her private link now.</strong>
            <input
              aria-label="New recipient link"
              value={url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  setError("Select the link and copy it manually.");
                }
              }}
            >
              Copy private link
            </Button>
            <p>
              The link won’t be shown again. Use it yourself with the passcode
              to preview the connected world.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </form>
      <div className="letter-card invitation-list">
        <h2>Her entry links</h2>
        <p>
          Revoking a link also ends every visit using it. Create a new link if a
          passcode is forgotten.
        </p>
        {!links.length && <p>No recipient link yet.</p>}
        {links.map((l) => (
          <article key={l.id}>
            <div>
              <strong>{new Date(l.created_at).toLocaleString()}</strong>
              <span>
                {l.revoked_at
                  ? "Revoked"
                  : l.expires_at && new Date(l.expires_at) <= new Date()
                    ? "Expired"
                    : "Active"}
              </span>
            </div>
            <Button
              variant="outline"
              disabled={busy || !!l.revoked_at}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api(`admin/recipient-links/${l.id}`, "DELETE");
                  setLinks(await api<AccessLink[]>("admin/recipient-links"));
                  setUrl("");
                } catch {
                  setError("The link couldn’t be revoked. Please retry.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Revoke
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
