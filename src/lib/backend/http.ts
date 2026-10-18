import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { backendEnv, serviceClient, userClient } from "../supabase/server";
import { hashPasscode, verifyPasscode } from "./passcode";
import { openInvitation, sealInvitation } from "./invitation-links";
import {
  houseSchema,
  messageSchema,
  sceneSchema,
  sceneKeySchema,
  contributorVisitSchema,
} from "../../game/connected";
import { isSceneKey, safePlacement } from "../../game/scenes";
import {
  finaleAdminSchema,
  finaleDraftSchema,
  finaleContentSchema,
  finaleSchema,
  finaleStatusSchema,
} from "../../game/finale";
import {
  contributionSchema,
  idSchema,
  invitationSchema,
  mediaReviewSchema,
  placementSchema,
  reviewSchema,
  tokenSchema,
  uploadSchema,
} from "./contracts";
import {
  assertSameOrigin,
  byteRange,
  constantTimeMatch,
  digest,
  HttpError,
  mediaAccessAllowed,
  newSecret,
  readJson,
} from "./security";
import {
  extensionOf,
  validateDeclaration,
  validateMedia,
} from "./media-validation";

const BUCKET = "bubu-contributions";
const CONTRIBUTOR_COOKIE = "bubu-contributor";
const ADMIN_COOKIE = "bubu-admin";
const RECIPIENT_COOKIE = "bubu-recipient";
type CookieJar = Awaited<ReturnType<typeof cookies>>;
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  priority: "high" as const,
});
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers });
}
function ok() {
  return json({ ok: true });
}
function check(
  error: { message: string } | null,
  message = "This request could not be completed.",
) {
  if (error) throw new HttpError(409, message);
}
function sessionHash(jar: CookieJar) {
  const token = jar.get(CONTRIBUTOR_COOKIE)?.value;
  if (!token || !tokenSchema.safeParse(token).success)
    throw new HttpError(401, "Please reopen your invitation.");
  return digest(token, backendEnv().INVITE_TOKEN_PEPPER);
}
async function contributor(jar: CookieJar) {
  const hash = sessionHash(jar),
    db = serviceClient();
  const { data, error } = await db.rpc("active_contributor", {
    p_session_hash: hash,
  });
  if (error || typeof data !== "string")
    throw new HttpError(401, "Your invitation session is unavailable.");
  return { hash, invitationId: data, db };
}
async function admin(jar: CookieJar) {
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) throw new HttpError(401, "Please sign in as an administrator.");
  const db = userClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Please sign in again.");
  const membership = await db
    .from("admin_members")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (membership.error || !membership.data)
    throw new HttpError(403, "Administrator access is required.");
  return db;
}
async function limit(
  request: Request,
  category: string,
  count: number,
  subject = "",
) {
  const env = backendEnv();
  // Never trust arbitrary X-Forwarded-For outside the managed Vercel edge.
  const address =
    process.env.VERCEL === "1"
      ? (request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown")
      : "local";
  const key = digest(
    `${category}:${address}:${subject}`,
    env.INVITE_TOKEN_PEPPER,
  );
  const { data, error } = await serviceClient().rpc("consume_rate_limit", {
    p_key: key,
    p_limit: count,
    p_seconds: 600,
  });
  if (error) throw new HttpError(503, "Please try again shortly.");
  if (data !== true)
    throw new HttpError(429, "Too many attempts. Please wait ten minutes.");
}
function limits() {
  const env = backendEnv();
  return {
    photoBytes: env.UPLOAD_PHOTO_MAX_BYTES,
    audioBytes: env.UPLOAD_AUDIO_MAX_BYTES,
    audioSeconds: env.UPLOAD_AUDIO_MAX_SECONDS,
  };
}

async function cleanup(db: SupabaseClient) {
  const queued = await db.rpc("queue_expired_uploads");
  check(queued.error);
  const jobs = await db.rpc("cleanup_candidates");
  check(jobs.error);
  let removed = 0;
  for (const job of jobs.data ?? []) {
    const result = await db.storage.from(BUCKET).remove([job.storage_path]);
    if (!result.error) {
      const result = await db
        .from("storage_cleanup")
        .delete()
        .eq("storage_path", job.storage_path);
      if (!result.error) removed++;
    }
  }
  return { removed };
}

async function media(request: Request, id: string, jar: CookieJar) {
  let adminDb: SupabaseClient | null = null;
  if (jar.get(ADMIN_COOKIE)?.value) {
    try {
      adminDb = await admin(jar);
    } catch {
      /* Contributor session may still be valid. */
    }
  }
  const owner = adminDb ? null : await contributor(jar);
  const db = serviceClient();
  const submitted = await db
    .from("contribution_media")
    .select("storage_path,media_type,status,contribution_id")
    .eq("id", id)
    .maybeSingle();
  check(submitted.error);
  let path: string, mime: string;
  if (submitted.data) {
    const parent = await db
      .from("contributions")
      .select("invitation_id")
      .eq("id", submitted.data.contribution_id)
      .single();
    if (
      !parent.data ||
      !mediaAccessAllowed({
        admin: !!adminDb,
        activeInvitation: owner?.invitationId ?? null,
        ownerInvitation: parent.data.invitation_id,
        mediaStatus: submitted.data.status,
        submitted: true,
      })
    )
      throw new HttpError(404, "Media unavailable.");
    path = submitted.data.storage_path;
    mime = submitted.data.media_type;
  } else {
    const intent = await db
      .from("upload_intents")
      .select("invitation_id,state,expires_at,final_path,final_mime")
      .eq("id", id)
      .maybeSingle();
    check(intent.error);
    if (
      !intent.data ||
      intent.data.state !== "validated" ||
      new Date(intent.data.expires_at).getTime() <= Date.now() ||
      (!adminDb && owner?.invitationId !== intent.data.invitation_id)
    )
      throw new HttpError(404, "Media unavailable.");
    path = intent.data.final_path;
    mime = intent.data.final_mime;
  }
  return privateFile(request, path, mime);
}
async function privateFile(request: Request, path: string, mime: string) {
  const file = await serviceClient().storage.from(BUCKET).download(path);
  if (file.error || !file.data) throw new HttpError(404, "Media unavailable.");
  const bytes = Buffer.from(await file.data.arrayBuffer());
  const range = byteRange(request.headers.get("range"), bytes.byteLength);
  const body = range ? bytes.subarray(range.start, range.end + 1) : bytes;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      "Content-Type": mime,
      "Content-Length": String(body.byteLength),
      "Accept-Ranges": "bytes",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(range
        ? {
            "Content-Range": `bytes ${range.start}-${range.end}/${bytes.byteLength}`,
          }
        : {}),
    },
  });
}

export async function handleBackend(request: Request, path: string[]) {
  try {
    const route = path.join("/"),
      method = request.method;
    const jar = await cookies();
    // Missing cookies fail before config/network lookup. No public data listing.
    if (
      route.startsWith("admin/") &&
      route !== "admin/login" &&
      !jar.get(ADMIN_COOKIE)?.value
    )
      throw new HttpError(401, "Please sign in as an administrator.");
    if (method !== "GET" && route !== "internal/cleanup")
      assertSameOrigin(request, backendEnv().APP_ORIGIN);

    if (route === "admin/recipient-links" && method === "GET") {
      const db = await admin(jar);
      const result = await db
        .from("recipient_access_links")
        .select("id,created_at,expires_at,revoked_at")
        .order("created_at", { ascending: false })
        .limit(100);
      check(result.error);
      return json(result.data);
    }
    if (route === "admin/recipient-links" && method === "POST") {
      const db = await admin(jar);
      await limit(request, "recipient-link-create", 10);
      const body = z
        .object({
          passcode: z.string().min(8).max(128),
          expiresAt: z.iso.datetime({ offset: true }).nullable(),
        })
        .strict()
        .parse(await readJson(request));
      const token = newSecret();
      const result = await db.rpc("admin_create_recipient_link", {
        p_hash: digest(token, backendEnv().INVITE_TOKEN_PEPPER),
        p_passcode_hash: await hashPasscode(body.passcode),
        p_expires: body.expiresAt,
      });
      check(result.error);
      return json(
        { id: result.data, url: `${backendEnv().APP_ORIGIN}/#${token}` },
        201,
      );
    }
    if (
      path[0] === "admin" &&
      path[1] === "recipient-links" &&
      path.length === 3 &&
      method === "DELETE"
    ) {
      const db = await admin(jar);
      const result = await db.rpc("admin_revoke_recipient_link", {
        p_id: idSchema.parse(path[2]),
      });
      check(result.error);
      return ok();
    }
    if (route === "recipient/unlock" && method === "POST") {
      await limit(request, "recipient-unlock", 20);
      const body = z
        .object({ token: tokenSchema, passcode: z.string().min(1).max(128) })
        .strict()
        .parse(await readJson(request));
      const hash = digest(body.token, backendEnv().INVITE_TOKEN_PEPPER);
      await limit(request, "recipient-unlock-link", 8, hash);
      const db = serviceClient();
      const verifier = await db.rpc("recipient_verifier", { p_hash: hash });
      const matches = await verifyPasscode(
        body.passcode,
        typeof verifier.data === "string" ? verifier.data : null,
      );
      if (verifier.error || !matches)
        throw new HttpError(
          401,
          "The link or passcode is unavailable. Please check both with Cj.",
        );
      const secret = newSecret();
      const result = await db.rpc("open_recipient_session", {
        p_hash: hash,
        p_verifier: verifier.data,
        p_session_hash: digest(secret, backendEnv().INVITE_TOKEN_PEPPER),
      });
      if (result.error)
        throw new HttpError(
          401,
          "The link or passcode is unavailable. Please check both with Cj.",
        );
      jar.set(RECIPIENT_COOKIE, secret, { ...cookieOptions(), maxAge: 28800 });
      return ok();
    }
    if (path[0] === "recipient") {
      const token = jar.get(RECIPIENT_COOKIE)?.value;
      if (!token || !tokenSchema.safeParse(token).success)
        throw new HttpError(
          401,
          "Please open your private link and unlock your world.",
        );
      const db = serviceClient(),
        hash = digest(token, backendEnv().INVITE_TOKEN_PEPPER);
      const session = await db.rpc("active_recipient", {
        p_session_hash: hash,
      });
      if (session.error || !session.data)
        throw new HttpError(
          401,
          "Your visit has ended. Please open your private link again.",
        );
      if (route === "recipient/session" && method === "GET") return ok();
      if (route === "recipient/ending/status" && method === "GET") {
        const result = await db.rpc("recipient_finale_status", {
          p_session_hash: hash,
        });
        check(result.error);
        return json(finaleStatusSchema.parse(result.data));
      }
      if (route === "recipient/ending" && method === "GET") {
        const result = await db.rpc("recipient_ending", {
          p_session_hash: hash,
        });
        if (result.error)
          throw new HttpError(403, "Cj’s letter isn’t ready to open yet.");
        return json(finaleSchema.parse(result.data));
      }
      if (route === "recipient/ending/complete" && method === "POST") {
        const body = z
          .object({ revision: z.number().int().min(1) })
          .strict()
          .parse(await readJson(request));
        check(
          (
            await db.rpc("recipient_complete_finale", {
              p_session_hash: hash,
              p_revision: body.revision,
            })
          ).error,
          "The ending changed or your visit ended. Reopen the letter to try again.",
        );
        return ok();
      }
      if (route === "recipient/logout" && method === "POST") {
        check(
          (
            await db
              .from("recipient_sessions")
              .update({ revoked_at: new Date().toISOString() })
              .eq("session_hash", hash)
          ).error,
        );
        jar.set(RECIPIENT_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
        return ok();
      }
      if (route === "recipient/house" && method === "GET") {
        const result = await db.rpc("recipient_house", {
          p_session_hash: hash,
        });
        check(result.error);
        return json(houseSchema.parse(result.data));
      }
      if (path[1] === "scenes" && path.length === 3 && method === "GET") {
        const map = sceneKeySchema.parse(path[2]);
        const result = await db.rpc("recipient_scene", {
          p_session_hash: hash,
          p_map: map,
        });
        check(result.error);
        return json(sceneSchema.parse(result.data));
      }
      if (path.length === 3) {
        const id = idSchema.parse(path[2]);
        const params = { p_session_hash: hash, p_id: id };
        if (path[1] === "messages" && method === "GET") {
          const result = await db.rpc("recipient_message", params);
          if (result.error || !result.data)
            throw new HttpError(404, "This hello is no longer available.");
          return json(messageSchema.parse(result.data));
        }
        if (path[1] === "seen" && method === "POST") {
          const result = await db.rpc("recipient_mark_seen", params);
          check(result.error);
          return ok();
        }
        if (path[1] === "media" && method === "GET") {
          const result = await db.rpc("recipient_media", params);
          if (result.error || !result.data)
            throw new HttpError(404, "Media unavailable.");
          return await privateFile(request, result.data.path, result.data.mime);
        }
      }
      throw new HttpError(404, "Not found.");
    }

    if (route === "admin/login" && method === "POST") {
      await limit(request, "admin-login", 10);
      const body = z
        .object({
          email: z.email().max(254),
          password: z.string().min(1).max(256),
        })
        .strict()
        .parse(await readJson(request));
      const db = userClient();
      const result = await db.auth.signInWithPassword(body);
      if (result.error || !result.data.session)
        throw new HttpError(
          401,
          "Sign-in failed. Check your administrator credentials.",
        );
      const membership = await userClient(result.data.session.access_token)
        .from("admin_members")
        .select("user_id")
        .eq("user_id", result.data.user.id)
        .maybeSingle();
      if (membership.error || !membership.data) {
        await db.auth.signOut();
        throw new HttpError(403, "Administrator access is required.");
      }
      // No JWT or refresh token is returned to browser JS/localStorage.
      jar.set(ADMIN_COOKIE, result.data.session.access_token, {
        ...cookieOptions(),
        maxAge: Math.min(result.data.session.expires_in, 3600),
      });
      return ok();
    }
    if (route === "admin/logout" && method === "POST") {
      jar.set(ADMIN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
      return ok();
    }
    if (route === "invitations/exchange" && method === "POST") {
      await limit(request, "invite-exchange", 20);
      const { token } = z
        .object({ token: tokenSchema })
        .strict()
        .parse(await readJson(request));
      const secret = newSecret();
      const result = await serviceClient().rpc("exchange_invitation", {
        p_token_hash: digest(token, backendEnv().INVITE_TOKEN_PEPPER),
        p_session_hash: digest(secret, backendEnv().INVITE_TOKEN_PEPPER),
      });
      check(
        result.error,
        "This invitation is unavailable, expired, or already used.",
      );
      jar.set(CONTRIBUTOR_COOKIE, secret, { ...cookieOptions(), maxAge: 7200 });
      return ok();
    }
    if (route === "contributor" && method === "GET") {
      const { db, hash } = await contributor(jar);
      const result = await db.rpc("contributor_snapshot", {
        p_session_hash: hash,
      });
      check(result.error);
      return json({ ...result.data, limits: limits() });
    }
    if (route === "contributor/visit" && method === "GET") {
      const { db, hash } = await contributor(jar);
      const result = await db.rpc("contributor_visit", {
        p_session_hash: hash,
      });
      check(
        result.error,
        "Your place isn’t available yet. Submit your letter or reopen your invitation.",
      );
      return json(contributorVisitSchema.parse(result.data));
    }
    if (route === "contributor/logout" && method === "POST") {
      const { db, hash } = await contributor(jar);
      const result = await db
        .from("contributor_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("session_hash", hash);
      check(result.error);
      jar.set(CONTRIBUTOR_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
      return ok();
    }
    if (route === "contributions" && method === "POST") {
      const { db, hash, invitationId } = await contributor(jar);
      await limit(request, "submit", 20, invitationId);
      const body = contributionSchema.parse(await readJson(request));
      const result = await db.rpc("submit_contribution", {
        p_session_hash: hash,
        p_name: "",
        p_relationship: "",
        p_message: body.message,
        p_upload_ids: body.uploadIds,
      });
      check(
        result.error,
        "Your message was not saved. Check the attachments or reopen your invitation.",
      );
      return json({ received: true }, 201);
    }
    if (route === "contributions" && method === "PATCH") {
      const { db, hash, invitationId } = await contributor(jar);
      await limit(request, "edit-letter", 20, invitationId);
      const body = z
        .object({
          message: z.string().trim().min(1).max(2000),
          version: z.string().datetime({ offset: true }),
          consent: z.literal(true),
        })
        .strict()
        .parse(await readJson(request));
      check(
        (
          await db.rpc("edit_contribution", {
            p_session_hash: hash,
            p_message: body.message,
            p_version: body.version,
          })
        ).error,
        "Your letter changed or could not be saved. Reopen it before trying again.",
      );
      return ok();
    }
    if (route === "uploads" && method === "POST") {
      const { db, hash, invitationId } = await contributor(jar);
      await limit(request, "upload", 24, invitationId);
      const body = uploadSchema.parse(await readJson(request));
      const extension = extensionOf(body.filename);
      try {
        validateDeclaration(
          body.kind,
          extension,
          body.mime,
          body.bytes,
          limits(),
        );
      } catch {
        throw new HttpError(
          422,
          "Choose a supported file within the size limit.",
        );
      }
      const id = randomUUID();
      const reserved = await db.rpc("reserve_upload", {
        p_session_hash: hash,
        p_id: id,
        p_kind: body.kind,
        p_bytes: body.bytes,
        p_extension: extension,
        p_mime: body.mime,
        p_description: body.description,
      });
      check(
        reserved.error,
        "This attachment could not be reserved. Check the file limits or remove an unfinished upload.",
      );
      const signed = await db.storage
        .from(BUCKET)
        .createSignedUploadUrl(reserved.data, { upsert: false });
      if (signed.error || !signed.data)
        throw new HttpError(
          503,
          "Upload unavailable. Remove the unfinished upload and try again.",
        );
      return json({ id, uploadUrl: signed.data.signedUrl }, 201);
    }
    if (path[0] === "uploads" && path.length === 2 && method === "DELETE") {
      const { db, hash } = await contributor(jar);
      const id = idSchema.parse(path[1]);
      const result = await db.rpc("discard_upload", {
        p_session_hash: hash,
        p_id: id,
      });
      check(result.error);
      return ok();
    }
    if (
      path[0] === "uploads" &&
      path[2] === "complete" &&
      path.length === 3 &&
      method === "POST"
    ) {
      const { db, hash, invitationId } = await contributor(jar);
      await limit(request, "upload-validation", 24, invitationId);
      const id = idSchema.parse(path[1]);
      const result = await db
        .from("upload_intents")
        .select("*")
        .eq("id", id)
        .eq("invitation_id", invitationId)
        .maybeSingle();
      check(result.error);
      const intent = result.data;
      if (!intent || new Date(intent.expires_at).getTime() <= Date.now())
        throw new HttpError(404, "Upload unavailable.");
      if (intent.state === "validated") return ok(); // Idempotent after a lost response.
      if (intent.state !== "allocated")
        throw new HttpError(409, "Remove this attachment and try again.");
      const file = await db.storage.from(BUCKET).download(intent.staging_path);
      if (file.error || !file.data)
        throw new HttpError(409, "The upload is not finished. Please retry.");
      let clean: Awaited<ReturnType<typeof validateMedia>>;
      try {
        clean = await validateMedia(
          new Uint8Array(await file.data.arrayBuffer()),
          {
            kind: intent.kind,
            extension: intent.original_extension,
            mime: intent.declared_mime,
            bytes: intent.declared_bytes,
          },
          limits(),
        );
      } catch {
        throw new HttpError(
          422,
          "The file failed validation. Check its type, size and recording length, then remove it and retry.",
        );
      }
      const finalPath = `validated/${invitationId}/${id}/${randomUUID()}.${clean.extension}`;
      // Register first so any crash/failed DB commit has a recoverable cleanup job.
      const job = await db.from("storage_cleanup").insert({
        storage_path: finalPath,
        not_before: new Date(Date.now() + 4 * 3600_000).toISOString(),
      });
      check(job.error);
      const uploaded = await db.storage
        .from(BUCKET)
        .upload(finalPath, clean.bytes, {
          contentType: clean.mime,
          upsert: false,
          cacheControl: "0",
        });
      check(uploaded.error);
      const validated = await db.rpc("validate_upload", {
        p_session_hash: hash,
        p_id: id,
        p_path: finalPath,
        p_mime: clean.mime,
        p_bytes: clean.bytes.byteLength,
        p_duration: clean.durationMs,
      });
      if (validated.error) {
        await db.storage.from(BUCKET).remove([finalPath]);
        throw new HttpError(
          409,
          "The invitation or upload is no longer available.",
        );
      }
      // Cleanup ignores jobs for live validated/attached objects (see migration).
      return ok();
    }
    if (path[0] === "media" && path.length === 2 && method === "GET")
      return await media(request, idSchema.parse(path[1]), jar);
    if (route === "admin/finale") {
      const db = await admin(jar);
      if (method === "GET") {
        const result = await db.rpc("admin_finale");
        check(result.error);
        return json(finaleAdminSchema.parse(result.data));
      }
      if (method === "POST") {
        await limit(request, "finale-edit", 60);
        const body = z
          .object({
            revision: z.number().int().min(0),
            action: z.enum(["save", "publish", "unpublish"]),
            content: finaleDraftSchema.optional(),
          })
          .strict()
          .parse(await readJson(request, 320000));
        const content =
          body.action === "unpublish"
            ? null
            : (body.action === "publish"
                ? finaleContentSchema
                : finaleDraftSchema
              ).parse(body.content);
        check(
          (
            await db.rpc("admin_save_finale", {
              p_content: content,
              p_revision: body.revision,
              p_action: body.action,
            })
          ).error,
          "The finale changed or could not save. Reload the saved draft before trying again.",
        );
        return ok();
      }
    }
    if (route === "admin/dashboard" && method === "GET") {
      const db = await admin(jar);
      const results = await Promise.all([
        db
          .from("invitations")
          .select("id,label,expires_at,revoked_at,created_at,assigned_map")
          .order("created_at", { ascending: false })
          .limit(200),
        db
          .from("contributions")
          .select(
            "id,invitation_id,display_name,relationship_label,message_text,status,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(200),
        db
          .from("contribution_media")
          .select(
            "id,contribution_id,kind,status,media_type,file_size_bytes,duration_ms,description",
          )
          .limit(800),
        db.from("areas").select("id,name,map_key,published"),
        db
          .from("npc_placements")
          .select(
            "id,contribution_id,area_id,sprite_variant,spawn_x,spawn_y,wander_radius,published",
          )
          .limit(200),
      ]);
      for (const result of results) check(result.error);
      return json(
        Object.fromEntries(
          ["invitations", "contributions", "media", "areas", "placements"].map(
            (key, i) => [key, results[i].data],
          ),
        ),
      );
    }
    if (route === "admin/invitations" && method === "POST") {
      const db = await admin(jar);
      await limit(request, "create-invite", 50);
      const body = invitationSchema.parse(await readJson(request));
      const token = newSecret(),
        id = randomUUID();
      const result = await db.rpc("admin_issue_designated_invite", {
        p_id: id,
        p_hash: digest(token, backendEnv().INVITE_TOKEN_PEPPER),
        p_cipher: sealInvitation(token, id, backendEnv().INVITE_TOKEN_PEPPER),
        p_label: body.label,
        p_expires: body.expiresAt,
        p_map: body.mapKey,
      });
      check(result.error);
      // The fragment is recovered only through authenticated admin access.
      return json(
        { id: result.data, url: `${backendEnv().APP_ORIGIN}/invite#${token}` },
        201,
      );
    }
    if (
      path[0] === "admin" &&
      path[1] === "invitations" &&
      path.length === 4 &&
      path[3] === "link" &&
      (method === "GET" || method === "POST")
    ) {
      const db = await admin(jar),
        id = idSchema.parse(path[2]);
      if (method === "GET") {
        const result = await db
          .from("invitations")
          .select("id,token_hash,link_ciphertext,revoked_at,expires_at")
          .eq("id", id)
          .maybeSingle();
        check(result.error);
        if (
          !result.data ||
          result.data.revoked_at ||
          (result.data.expires_at &&
            new Date(result.data.expires_at) <= new Date())
        )
          throw new HttpError(404, "Invitation unavailable.");
        if (!result.data.link_ciphertext) return json({ url: null });
        const token = openInvitation(
          result.data.link_ciphertext,
          id,
          backendEnv().INVITE_TOKEN_PEPPER,
        );
        if (
          digest(token, backendEnv().INVITE_TOKEN_PEPPER) !==
          result.data.token_hash
        )
          throw new HttpError(409, "Please replace this invitation link.");
        return json({ url: `${backendEnv().APP_ORIGIN}/invite#${token}` });
      }
      await limit(request, "replace-invite", 20, id);
      const token = newSecret();
      check(
        (
          await db.rpc("admin_issue_invite", {
            p_id: id,
            p_hash: digest(token, backendEnv().INVITE_TOKEN_PEPPER),
            p_cipher: sealInvitation(
              token,
              id,
              backendEnv().INVITE_TOKEN_PEPPER,
            ),
            p_label: null,
            p_expires: null,
            p_replace: true,
          })
        ).error,
      );
      return json({ url: `${backendEnv().APP_ORIGIN}/invite#${token}` });
    }
    if (
      path[0] === "admin" &&
      path[1] === "invitations" &&
      path.length === 3 &&
      method === "PATCH"
    ) {
      const db = await admin(jar);
      const body = z
        .object({ mapKey: sceneKeySchema })
        .strict()
        .parse(await readJson(request));
      check(
        (
          await db.rpc("admin_set_invite_place", {
            p_id: idSchema.parse(path[2]),
            p_map: body.mapKey,
          })
        ).error,
      );
      return ok();
    }
    if (
      path[0] === "admin" &&
      path[1] === "invitations" &&
      path.length === 3 &&
      method === "DELETE"
    ) {
      const db = await admin(jar);
      const result = await db.rpc("admin_revoke_invite", {
        p_id: idSchema.parse(path[2]),
      });
      check(result.error);
      return ok();
    }
    if (
      path[0] === "admin" &&
      path[1] === "contributions" &&
      path.length === 3
    ) {
      const db = await admin(jar);
      const id = idSchema.parse(path[2]);
      if (method === "DELETE") {
        const result = await db.rpc("admin_delete_contribution", { p_id: id });
        check(result.error);
        return ok();
      }
      if (method === "PATCH") {
        const body = reviewSchema.parse(await readJson(request));
        const result = await db.rpc("admin_review", {
          p_id: id,
          p_status: body.status,
          p_message: body.message ?? null,
        });
        check(
          result.error,
          "Review every attachment before approving this message.",
        );
        return ok();
      }
    }
    if (
      path[0] === "admin" &&
      path[1] === "media" &&
      path.length === 3 &&
      method === "PATCH"
    ) {
      const db = await admin(jar);
      const body = mediaReviewSchema.parse(await readJson(request));
      const result = await db.rpc("admin_review_media", {
        p_id: idSchema.parse(path[2]),
        p_status: body.status,
      });
      check(result.error);
      return ok();
    }
    if (
      path[0] === "admin" &&
      path[1] === "media" &&
      path.length === 3 &&
      method === "DELETE"
    ) {
      const db = await admin(jar);
      const result = await db.rpc("admin_delete_media", {
        p_id: idSchema.parse(path[2]),
      });
      check(result.error);
      return ok();
    }
    if (route === "admin/placements" && method === "POST") {
      const db = await admin(jar);
      const body = placementSchema.parse(await readJson(request));
      const area = await db
        .from("areas")
        .select("map_key")
        .eq("id", body.areaId)
        .single();
      check(area.error);
      if (
        !isSceneKey(area.data?.map_key ?? "") ||
        !safePlacement(area.data!.map_key, body.x, body.y, body.radius)
      )
        throw new HttpError(
          422,
          "The spawn and entire wander area must stay on this scene’s safe paths, clear of scenery and road.",
        );
      const result = await db.rpc("admin_place_npc", {
        p_contribution: body.contributionId,
        p_area: body.areaId,
        p_variant: body.variant,
        p_x: body.x,
        p_y: body.y,
        p_radius: body.radius,
        p_published: body.published,
      });
      check(
        result.error,
        "Review the message and every attachment before publishing, and choose a safe placement for this scene.",
      );
      return ok();
    }
    if (route === "admin/cleanup" && method === "POST") {
      await admin(jar);
      return json(await cleanup(serviceClient()));
    }
    if (
      route === "internal/cleanup" &&
      (method === "POST" || method === "GET")
    ) {
      const expected = process.env.CRON_SECRET;
      if (
        !expected ||
        !constantTimeMatch(
          request.headers.get("authorization") ?? "",
          `Bearer ${expected}`,
        )
      )
        throw new HttpError(401, "Unauthorized.");
      return json(await cleanup(serviceClient()));
    }
    throw new HttpError(404, "Not found.");
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: "Please check the submitted fields." }, 400);
    // Never log raw Supabase errors, SQL parameters, tokens, messages or media URLs.
    return json(
      { error: "The service is unavailable. Please try again." },
      503,
    );
  }
}
