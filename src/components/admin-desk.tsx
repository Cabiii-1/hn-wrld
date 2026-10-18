"use client";
/* eslint-disable @next/next/no-img-element -- Private cookie-bound media must bypass the public image optimizer. */
import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Clipboard,
  Heart,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { ContributionShell, SetupNotice } from "./contribution-shell";
import { RecipientAccess } from "./recipient-access";
import { FinaleEditor } from "./finale-editor";
import { SCENES, isSceneKey } from "@/game/scenes";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { api } from "@/lib/backend/browser-api";
import type { AdminData, Contribution, Media } from "@/lib/backend/contracts";

type Action = (path: string, method: string, body?: unknown) => Promise<void>;
export function AdminDesk({ configured }: { configured: boolean }) {
  const [data, setData] = useState<AdminData | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [tab, setTab] = useState("review"),
    [selected, setSelected] = useState("");
  const [inviteUrl, setInviteUrl] = useState(""),
    [copied, setCopied] = useState(false),
    [notice, setNotice] = useState("");
  const [savedLinks, setSavedLinks] = useState<Record<string, string | null>>(
    {},
  );
  async function revealLink(id: string, replace = false) {
    if (
      replace &&
      !window.confirm(
        "Replace this invitation link? The old link and open sessions will stop working. Their existing letter will be kept. Share the replacement privately with this person.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string | null }>(
        `admin/invitations/${id}/link`,
        replace ? "POST" : "GET",
      );
      setSavedLinks((links) => ({ ...links, [id]: result.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this link.");
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const value = await api<AdminData>("admin/dashboard");
    setData(value);
  }
  useEffect(() => {
    if (configured)
      void api<AdminData>("admin/dashboard")
        .then(setData)
        .catch(() => {});
  }, [configured]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api("admin/login", "POST", {
        email: form.get("email"),
        password: form.get("password"),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  const action: Action = async (path, method, body) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, method, body);
      await refresh();
      setNotice("Saved safely.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  async function createInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInviteUrl("");
    setCopied(false);
    const form = new FormData(e.currentTarget),
      expiry = form.get("expires") as string;
    try {
      const value = await api<{ url: string }>("admin/invitations", "POST", {
        label: form.get("label"),
        expiresAt: expiry ? new Date(expiry).toISOString() : null,
      });
      setInviteUrl(value.url);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create an invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  const current =
    data?.contributions.find((c) => c.id === selected) ??
    data?.contributions[0];
  if (!data)
    return (
      <ContributionShell admin>
        <section className="letter-intro">
          <span className="eyebrow">BEHIND EVERY LITTLE HELLO</span>
          <h1>
            A little desk, <em>for Dudu.</em>
          </h1>
          <p>
            A quiet place to gather the people and words that make her world.
          </p>
        </section>
        {!configured && <SetupNotice />}
        <form onSubmit={login} className="letter-card admin-login">
          <span className="postmark">
            <ShieldCheck size={29} />
          </span>
          <h2>Welcome back.</h2>
          <p>Sign in to invite her people and care for their messages.</p>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={!configured || busy}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              disabled={!configured || busy}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={!configured || busy}>
            {busy ? "Opening your desk…" : "Open my desk"}
            <Heart size={15} />
          </Button>
          <small>Administrator access only · no public sign-up</small>
        </form>
      </ContributionShell>
    );
  return (
    <ContributionShell admin>
      <section className="desk-intro">
        <div>
          <span className="eyebrow">A WORLD MADE OF HER PEOPLE</span>
          <h1>
            Little hellos, <em>gathered here.</em>
          </h1>
          <p>Review with care. Let every message find its place.</p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("admin/logout", "POST");
              setData(null);
              setInviteUrl("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Sign-out failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={15} />
          Sign out
        </Button>
      </section>
      <div className="desk-stats">
        <article>
          <Mail size={20} />
          <span>
            {data.invitations.filter((i) => !i.revoked_at).length}
            <small>INVITATIONS</small>
          </span>
        </article>
        <article>
          <MessageCircle size={20} />
          <span>
            {data.contributions.filter((c) => c.status === "pending").length}
            <small>WAITING FOR A LITTLE CARE</small>
          </span>
        </article>
        <article>
          <MapPin size={20} />
          <span>
            {data.placements.filter((p) => p.published).length}
            <small>READY IN THE WORLD</small>
          </span>
        </article>
      </div>
      <nav className="desk-tabs" aria-label="Administrator sections">
        {[
          ["review", "Review messages"],
          ["invitations", "Invitations"],
          ["placements", "Their little places"],
          ["recipient", "Bubu’s little key"],
          ["finale", "Dudu’s little ending"],
        ].map(([id, name]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => {
              setTab(id);
              setError("");
              setNotice("");
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="form-error desk-notification">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="form-progress">
          {notice}
        </p>
      )}
      {tab === "recipient" && <RecipientAccess />}
      {tab === "finale" && <FinaleEditor />}
      {tab === "invitations" && (
        <section className="invitation-layout">
          <form className="letter-card" onSubmit={createInvite}>
            <div className="card-heading">
              <Mail size={21} />
              <h2>Make room for someone.</h2>
            </div>
            <p className="quiet-copy">
              One private link for one contributor. Share it with them directly.
            </p>
            <label>
              Contributor’s name
              <input
                name="label"
                required
                maxLength={80}
                placeholder="The name Hanna knows them by"
                disabled={busy}
              />
            </label>
            <label>
              Expires at <span>Optional</span>
              <input name="expires" type="datetime-local" disabled={busy} />
            </label>
            <Button type="submit" disabled={busy}>
              <Plus size={16} />
              Create invitation
            </Button>
            {inviteUrl && (
              <div className="new-invite" role="status">
                <strong>Here’s their little invitation.</strong>
                <p>Copy this link now. It won’t be shown again.</p>
                <input
                  aria-label="New invitation link"
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteUrl);
                      setCopied(true);
                    } catch {
                      setError("Select the link above and copy it manually.");
                    }
                  }}
                >
                  <Clipboard size={15} />
                  {copied ? "Copied" : "Copy private link"}
                </Button>
              </div>
            )}
          </form>
          <div className="letter-card invitation-list">
            <h2>Invited with love</h2>
            {!data.invitations.length && (
              <p className="empty-copy">
                Your first invitation is the beginning of a little hello.
              </p>
            )}
            {data.invitations.map((i) => (
              <article key={i.id}>
                <span className="invite-avatar">
                  <Mail size={17} />
                </span>
                <div>
                  <strong>{i.label}</strong>
                  <span>
                    {i.revoked_at
                      ? "Revoked"
                      : i.expires_at && new Date(i.expires_at) < new Date()
                        ? "Expired"
                        : data.contributions.some(
                              (c) => c.invitation_id === i.id,
                            )
                          ? "Message received"
                          : "Waiting for a hello"}
                  </span>
                  {!i.revoked_at &&
                    (!i.expires_at || new Date(i.expires_at) > new Date()) && (
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void revealLink(i.id)}
                        >
                          View invitation link
                        </Button>
                        {savedLinks[i.id] && (
                          <>
                            <input
                              readOnly
                              aria-label={`Invitation link for ${i.label}`}
                              value={savedLinks[i.id] ?? ""}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    savedLinks[i.id]!,
                                  );
                                  setNotice(`Link copied for ${i.label}.`);
                                } catch {
                                  setError(
                                    "Please select and copy the link manually.",
                                  );
                                }
                              }}
                            >
                              Copy link
                            </Button>
                          </>
                        )}
                        {savedLinks[i.id] === null && (
                          <>
                            <p>
                              This older link can’t be recovered. Create a
                              replacement to share again; their letter will be
                              kept.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void revealLink(i.id, true)}
                            >
                              Replace link
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                </div>
                <Button
                  variant="ghost"
                  disabled={busy || !!i.revoked_at}
                  onClick={() =>
                    void action(`admin/invitations/${i.id}`, "DELETE")
                  }
                >
                  Revoke
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === "review" && (
        <section className="review-layout">
          <aside className="letter-card inbox-list">
            <h2>Her people’s words</h2>
            {!data.contributions.length && (
              <p className="empty-copy">
                No messages yet. A little love is worth waiting for.
              </p>
            )}
            {data.contributions.map((c) => (
              <button
                key={c.id}
                className={current?.id === c.id ? "selected" : ""}
                onClick={() => setSelected(c.id)}
              >
                <span className="sender-initial">
                  {c.display_name.slice(0, 1)}
                </span>
                <span>
                  <strong>{c.display_name}</strong>
                  <small>{c.relationship_label || "A familiar face"}</small>
                </span>
                <span className={`status-badge status-${c.status}`}>
                  {c.status}
                </span>
              </button>
            ))}
          </aside>
          {current ? (
            <ReviewCard
              key={current.id}
              contribution={current}
              media={data.media.filter((m) => m.contribution_id === current.id)}
              action={action}
              busy={busy}
            />
          ) : (
            <section className="letter-card empty-review">
              <Heart size={35} />
              <h2>Every hello starts somewhere.</h2>
              <p>Create an invitation to gather your first message.</p>
              <Button variant="outline" onClick={() => setTab("invitations")}>
                Create an invitation
              </Button>
            </section>
          )}
        </section>
      )}
      {tab === "placements" && (
        <section className="letter-card">
          <div className="card-heading">
            <MapPin size={22} />
            <h2>A little place for each person.</h2>
          </div>
          <p className="quiet-copy">
            All places use the 836 × 470 game world. Changing a scene suggests a
            safe starting spot. Keep the whole wander area clear of scenery; use
            separate spots for different bears. At SLU, only the lower
            central/left stairs and sidewalk are walkable; the road is blocked.
          </p>
          {!data.contributions.length && (
            <p className="empty-copy">
              Their places will be ready when the first messages arrive.
            </p>
          )}
          {data.contributions.map((c) => (
            <PlacementForm
              key={`${c.id}-${JSON.stringify(data.placements.find((p) => p.contribution_id === c.id))}`}
              contribution={c}
              data={data}
              action={action}
              busy={busy}
            />
          ))}
        </section>
      )}
      <div className="desk-maintenance">
        <span>
          <ShieldCheck size={14} /> Every message and attachment is kept
          private.
        </span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void action("admin/cleanup", "POST")}
        >
          Clean up abandoned uploads
        </Button>
      </div>
    </ContributionShell>
  );
}

function MediaPreview({ media }: { media: Media }) {
  const [failed, setFailed] = useState(false);
  if (media.status === "deleted")
    return <p className="quiet-copy">This attachment has been removed.</p>;
  if (failed)
    return (
      <p className="form-error" role="status">
        This attachment couldn’t load. Reload the desk to retry before approving
        it.
      </p>
    );
  return media.kind === "photo" ? (
    <img
      className="review-photo"
      src={`/api/manage/media/${media.id}`}
      alt={media.description || "Contributor’s photo for review"}
      onError={() => setFailed(true)}
    />
  ) : (
    <div>
      <audio
        controls
        preload="none"
        src={`/api/manage/media/${media.id}`}
        onError={() => setFailed(true)}
      />
      {media.description && <p className="quiet-copy">{media.description}</p>}
    </div>
  );
}
function ReviewCard({
  contribution: c,
  media,
  action,
  busy,
}: {
  contribution: Contribution;
  media: Media[];
  action: Action;
  busy: boolean;
}) {
  const [message, setMessage] = useState(c.message_text),
    [deleting, setDeleting] = useState(false),
    [deletingMedia, setDeletingMedia] = useState("");
  return (
    <article className="letter-card review-card">
      <div className="review-sender">
        <span className="sender-initial">{c.display_name.slice(0, 1)}</span>
        <div>
          <h2>{c.display_name}</h2>
          <p>{c.relationship_label || "A familiar face"}</p>
        </div>
        <span className={`status-badge status-${c.status}`}>{c.status}</span>
      </div>
      <label>
        Their message
        <textarea
          rows={7}
          value={message}
          maxLength={2000}
          disabled={busy}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <p className="quiet-copy">
        You can tidy the message before approval. Any review or media change
        unpublishes its NPC until you explicitly publish again.
      </p>
      {media.map((m) => (
        <section key={m.id} className="media-review">
          <div className="card-heading">
            <h3>{m.kind === "photo" ? "A photo memory" : "A voice note"}</h3>
            <span className={`status-badge status-${m.status}`}>
              {m.status}
            </span>
          </div>
          <MediaPreview media={m} />
          <div className="review-actions">
            <Button
              variant="outline"
              disabled={busy || m.status === "deleted"}
              onClick={() =>
                void action(`admin/media/${m.id}`, "PATCH", {
                  status: "approved",
                })
              }
            >
              <Check size={15} />
              Keep attachment
            </Button>
            <Button
              variant="ghost"
              disabled={busy || m.status === "deleted"}
              onClick={() =>
                void action(`admin/media/${m.id}`, "PATCH", {
                  status: "rejected",
                })
              }
            >
              <X size={15} />
              Exclude attachment
            </Button>
            <Button
              variant="ghost"
              disabled={busy || m.status === "deleted"}
              aria-label="Delete attachment"
              onClick={() => setDeletingMedia(m.id)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </section>
      ))}
      <div className="review-actions">
        <Button
          disabled={
            busy || !message.trim() || media.some((m) => m.status === "pending")
          }
          onClick={() =>
            void action(`admin/contributions/${c.id}`, "PATCH", {
              status: "approved",
              message,
            })
          }
        >
          <Check size={16} />
          Approve message
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void action(`admin/contributions/${c.id}`, "PATCH", {
              status: "rejected",
            })
          }
        >
          Reject
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void action(`admin/contributions/${c.id}`, "PATCH", {
              status: "hidden",
            })
          }
        >
          Hide
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          aria-label="Delete contribution"
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      {media.some((m) => m.status === "pending") && (
        <p className="quiet-copy">
          Choose Keep or Exclude for every attachment before approving the
          message.
        </p>
      )}
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogTitle>Remove this little hello?</DialogTitle>
          <DialogDescription>
            This deletes the message and NPC, revokes the invitation, and queues
            its private files for deletion. It cannot be undone.
          </DialogDescription>
          <div className="review-actions">
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Keep message
            </Button>
            <Button
              onClick={() => {
                setDeleting(false);
                void action(`admin/contributions/${c.id}`, "DELETE");
              }}
            >
              Delete message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deletingMedia}
        onOpenChange={(open) => {
          if (!open) setDeletingMedia("");
        }}
      >
        <DialogContent>
          <DialogTitle>Remove this attachment?</DialogTitle>
          <DialogDescription>
            The message stays. The private file will be queued for deletion and
            cannot be restored.
          </DialogDescription>
          <div className="review-actions">
            <Button variant="outline" onClick={() => setDeletingMedia("")}>
              Keep attachment
            </Button>
            <Button
              onClick={() => {
                void action(`admin/media/${deletingMedia}`, "DELETE");
                setDeletingMedia("");
              }}
            >
              Delete attachment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
function PlacementForm({
  contribution: c,
  data,
  action,
  busy,
}: {
  contribution: Contribution;
  data: AdminData;
  action: Action;
  busy: boolean;
}) {
  const placement = data.placements.find((p) => p.contribution_id === c.id);
  const [areaId, setAreaId] = useState(
    placement?.area_id ??
      data.areas.find((a) => a.map_key === "sta_ana_house")?.id ??
      "",
  );
  const [point, setPoint] = useState({
    x: placement?.spawn_x ?? 425,
    y: placement?.spawn_y ?? 352,
    radius: placement?.wander_radius ?? 20,
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void action("admin/placements", "POST", {
      contributionId: c.id,
      areaId: f.get("areaId"),
      variant: f.get("variant"),
      x: Number(f.get("x")),
      y: Number(f.get("y")),
      radius: Number(f.get("radius")),
      published: f.get("published") === "on",
    });
  }
  return (
    <form className="placement-row" onSubmit={submit}>
      <div className="card-heading">
        <strong>{c.display_name}</strong>
        <span className={`status-badge status-${c.status}`}>{c.status}</span>
      </div>
      <div className="placement-fields">
        <label>
          Scene
          <select
            name="areaId"
            value={areaId}
            onChange={(e) => {
              setAreaId(e.target.value);
              const map = data.areas.find(
                (a) => a.id === e.target.value,
              )?.map_key;
              if (map && isSceneKey(map)) setPoint({ ...SCENES[map].npc });
            }}
            disabled={busy}
          >
            {data.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bear style
          <select
            name="variant"
            defaultValue={placement?.sprite_variant ?? "npc-brown-scarf"}
            disabled={busy}
          >
            <option value="npc-cream-1">Cream bear</option>
            <option value="npc-brown-scarf">Brown bear · scarf</option>
            <option value="npc-rose-bow">Cream bear · rose bow</option>
          </select>
        </label>
        <label>
          Foot X
          <input
            type="number"
            name="x"
            min={0}
            max={2000}
            value={point.x}
            onChange={(e) =>
              setPoint((p) => ({ ...p, x: Number(e.target.value) }))
            }
            required
            disabled={busy}
          />
        </label>
        <label>
          Foot Y
          <input
            type="number"
            name="y"
            min={0}
            max={2000}
            value={point.y}
            onChange={(e) =>
              setPoint((p) => ({ ...p, y: Number(e.target.value) }))
            }
            required
            disabled={busy}
          />
        </label>
        <label>
          Wander radius
          <input
            type="number"
            name="radius"
            min={0}
            max={80}
            value={point.radius}
            onChange={(e) =>
              setPoint((p) => ({ ...p, radius: Number(e.target.value) }))
            }
            required
            disabled={busy}
          />
        </label>
      </div>
      <div className="placement-footer">
        <label>
          <input
            type="checkbox"
            name="published"
            defaultChecked={placement?.published ?? false}
            disabled={busy || c.status !== "approved"}
          />
          Publish this NPC when saved
        </label>
        <Button variant="outline" type="submit" disabled={busy}>
          Save their place
        </Button>
      </div>
    </form>
  );
}
