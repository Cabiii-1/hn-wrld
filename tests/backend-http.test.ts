import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { newSecret } from "../src/lib/backend/security";
import { hashPasscode } from "../src/lib/backend/passcode";
const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  setters: vi.fn(),
  member: false,
  validUser: false,
  rpc: vi.fn(),
  from: vi.fn(),
  download: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  rows: {} as Record<string, unknown>,
  userCalls: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.jar.has(name) ? { value: state.jar.get(name) } : undefined,
    set: (name: string, value: string, options: unknown) => {
      state.setters(name, value, options);
      state.jar.set(name, value);
    },
  }),
}));
vi.mock("../src/lib/supabase/server", () => ({
  backendEnv: () => ({
    APP_ORIGIN: "https://world.test",
    INVITE_TOKEN_PEPPER: "synthetic-test-pepper-that-is-long-enough",
    UPLOAD_PHOTO_MAX_BYTES: 5242880,
    UPLOAD_AUDIO_MAX_BYTES: 15728640,
    UPLOAD_AUDIO_MAX_SECONDS: 90,
  }),
  serviceClient: () => ({
    rpc: state.rpc,
    from: state.from,
    storage: { from: () => ({ download: state.download }) },
  }),
  userClient: () => ({
    rpc: state.rpc,
    auth: {
      getUser: async () => {
        state.userCalls();
        return state.validUser
          ? { data: { user: { id: "admin-id" } }, error: null }
          : { data: { user: null }, error: { message: "Invalid JWT" } };
      },
      signInWithPassword: state.signIn,
      signOut: state.signOut,
    },
    from: (table: string) => {
      if (table === "admin_members") {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({
            data: state.member ? { user_id: "admin-id" } : null,
            error: null,
          }),
        };
        return q;
      }
      return state.from(table);
    },
  }),
}));
import { handleBackend } from "../src/lib/backend/http";
function request(
  path: string,
  method = "GET",
  body?: unknown,
  origin = "https://world.test",
) {
  return handleBackend(
    new Request(`https://world.test/api/manage/${path}`, {
      method,
      headers: {
        Origin: origin,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    path.split("/"),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.jar.clear();
  state.member = false;
  state.validUser = false;
  state.rows = {};
  state.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "consume_rate_limit"
        ? true
        : name === "active_contributor"
          ? "owner-invite"
          : null,
    error: null,
  }));
  state.from.mockImplementation((table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      single: async () => ({ data: state.rows[table] ?? null, error: null }),
      maybeSingle: async () => ({
        data: state.rows[table] ?? null,
        error: null,
      }),
    };
    return q;
  });
  state.signIn.mockResolvedValue({
    data: { session: null, user: null },
    error: { message: "Invalid login" },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("M5 finale HTTP boundaries", () => {
  it("protects both scheduler methods with the cleanup bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "synthetic-cleanup-secret");
    for (const method of ["GET", "POST"]) {
      expect((await request("internal/cleanup", method)).status).toBe(401);
      const response = await handleBackend(
        new Request("https://world.test/api/manage/internal/cleanup", {
          method,
          headers: { Authorization: "Bearer synthetic-cleanup-secret" },
        }),
        ["internal", "cleanup"],
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ removed: 0 });
    }
  });
  it("denies every finale route without the proper role cookie", async () => {
    for (const path of [
      "recipient/ending/status",
      "recipient/ending",
      "admin/finale",
    ])
      expect((await request(path)).status).toBe(401);
    expect(
      (await request("recipient/ending/complete", "POST", { revision: 1 }))
        .status,
    ).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("checks fresh recipient authorization and returns no letter when locked", async () => {
    state.jar.set("bubu-recipient", newSecret());
    state.rpc.mockImplementation(async (name: string) =>
      name === "active_recipient"
        ? { data: "link", error: null }
        : name === "recipient_finale_status"
          ? {
              data: {
                available: true,
                unlocked: false,
                seen: 0,
                required: 2,
                completed: false,
              },
              error: null,
            }
          : { data: null, error: { message: "Finale unavailable" } },
    );
    const status = await request("recipient/ending/status");
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({
      available: true,
      unlocked: false,
      seen: 0,
      required: 2,
      completed: false,
    });
    const ending = await request("recipient/ending");
    expect(ending.status).toBe(403);
    expect(ending.headers.get("cache-control")).toContain("private, no-store");
    expect(
      (await request("recipient/ending/complete", "POST", { revision: 1 }))
        .status,
    ).toBe(409);
    state.rpc.mockResolvedValue({ data: null, error: { message: "Revoked" } });
    expect((await request("recipient/ending")).status).toBe(401);
  });
  it("requires allowlisted admin and validates authored publication before its RPC", async () => {
    state.jar.set("bubu-admin", "jwt");
    state.validUser = true;
    expect((await request("admin/finale")).status).toBe(403);
    state.member = true;
    const draft = {
      title: "Draft",
      letter: "",
      threshold: 3,
      conversation: [],
    };
    expect(
      (
        await request("admin/finale", "POST", {
          revision: 0,
          action: "publish",
          content: draft,
        })
      ).status,
    ).toBe(400);
    expect(state.rpc.mock.calls.some((c) => c[0] === "admin_save_finale")).toBe(
      false,
    );
    expect(
      (
        await request("admin/finale", "POST", {
          revision: 0,
          action: "save",
          content: draft,
        })
      ).status,
    ).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("admin_save_finale", {
      p_content: draft,
      p_revision: 0,
      p_action: "save",
    });
  });
  it("rejects a foreign Origin before ending completion", async () => {
    state.jar.set("bubu-recipient", newSecret());
    expect(
      (
        await request(
          "recipient/ending/complete",
          "POST",
          { revision: 1 },
          "https://foreign.test",
        )
      ).status,
    ).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
describe("M2 HTTP authorization and privacy", () => {
  it("denies anonymous admin, contributor and private-media reads", async () => {
    for (const path of [
      "admin/dashboard",
      "contributor",
      "media/11111111-1111-4111-8111-111111111111",
    ])
      expect((await request(path)).status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.download).not.toHaveBeenCalled();
  });
  it("verifies JWT identity and allowlist membership on every admin request", async () => {
    state.jar.set("bubu-admin", "forged-jwt");
    expect((await request("admin/dashboard")).status).toBe(401);
    state.validUser = true;
    expect((await request("admin/dashboard")).status).toBe(403);
    expect(state.userCalls).toHaveBeenCalledTimes(2);
    expect(state.from).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests even with cookies", async () => {
    state.jar.set("bubu-contributor", newSecret());
    expect(
      (await request("contributions", "POST", {}, "https://attacker.test"))
        .status,
    ).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("rejects forged approved status before the write RPC", async () => {
    state.jar.set("bubu-contributor", newSecret());
    const result = await request("contributions", "POST", {
      displayName: "Fixture",
      message: "Synthetic hello",
      consent: true,
      uploadIds: [],
      status: "approved",
    });
    expect(result.status).toBe(400);
    expect(
      state.rpc.mock.calls.some(([fn]) => fn === "submit_instant_contribution"),
    ).toBe(false);
  });
  it("never downloads another contributor’s or rejected media", async () => {
    state.jar.set("bubu-contributor", newSecret());
    state.rows.contribution_media = {
      storage_path: "private/path",
      media_type: "image/webp",
      status: "pending",
      contribution_id: "parent",
    };
    state.rows.contributions = { invitation_id: "different-invite" };
    expect(
      (await request("media/11111111-1111-4111-8111-111111111111")).status,
    ).toBe(404);
    state.rows.contributions = { invitation_id: "owner-invite" };
    state.rows.contribution_media = {
      storage_path: "private/path",
      media_type: "image/webp",
      status: "rejected",
      contribution_id: "parent",
    };
    expect(
      (await request("media/11111111-1111-4111-8111-111111111111")).status,
    ).toBe(404);
    expect(state.download).not.toHaveBeenCalled();
  });
  it("checks live invitation revocation before serving any private data", async () => {
    state.jar.set("bubu-contributor", newSecret());
    state.rpc.mockResolvedValue({ data: null, error: null });
    expect((await request("contributor")).status).toBe(401);
    expect(state.from).not.toHaveBeenCalled();
  });
  it("sets secure HttpOnly cookies without returning JWTs or tokens in JSON", async () => {
    vi.stubEnv("NODE_ENV", "production");
    state.member = true;
    state.signIn.mockResolvedValue({
      data: {
        user: { id: "admin-id" },
        session: { access_token: "synthetic-jwt", expires_in: 3600 },
      },
      error: null,
    });
    const result = await request("admin/login", "POST", {
      email: "fixture@example.invalid",
      password: "synthetic-test-only",
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    expect(state.setters).toHaveBeenCalledWith(
      "bubu-admin",
      "synthetic-jwt",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 3600,
      }),
    );
  });
  it("does not issue an admin cookie to a signed-in non-admin", async () => {
    state.signIn.mockResolvedValue({
      data: {
        user: { id: "non-admin" },
        session: { access_token: "synthetic-jwt", expires_in: 3600 },
      },
      error: null,
    });
    expect(
      (
        await request("admin/login", "POST", {
          email: "fixture@example.invalid",
          password: "synthetic-test-only",
        })
      ).status,
    ).toBe(403);
    expect(state.setters).not.toHaveBeenCalled();
    expect(state.signOut).toHaveBeenCalled();
  });
  it("returns only a receipt and never echoes message text", async () => {
    state.jar.set("bubu-contributor", newSecret());
    const result = await request("contributions", "POST", {
      displayName: "Fixture",
      relationship: "",
      message: "Synthetic private fixture",
      consent: true,
      uploadIds: [],
    });
    expect(result.status).toBe(201);
    expect(await result.json()).toEqual({ received: true });
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(result.headers.get("vary")).toBe("Cookie");
    expect(state.rpc).toHaveBeenCalledWith(
      "submit_instant_contribution",
      expect.objectContaining({ p_share: false }),
    );
  });
  it("accepts message-only identity-free submissions", async () => {
    state.jar.set("bubu-contributor", newSecret());
    const result = await request("contributions", "POST", {
      message: "A synthetic hello for Hanna",
      consent: true,
      uploadIds: [],
    });
    expect(result.status).toBe(201);
    expect(state.rpc).toHaveBeenCalledWith(
      "submit_instant_contribution",
      expect.objectContaining({
        p_share: false,
        p_message: "A synthetic hello for Hanna",
      }),
    );
  });
  it("sanitizes backend failure messages and fails closed when rate storage fails", async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: { message: "INTERNAL SECRET SQL PARAMETER" },
    });
    const result = await request("invitations/exchange", "POST", {
      token: newSecret(),
    });
    expect(result.status).toBe(503);
    expect(JSON.stringify(await result.json())).not.toContain("SECRET");
    expect((await request("internal/cleanup", "POST")).status).toBe(401);
  });
  it("requires recipient cookies on every private read", async () => {
    for (const path of [
      "recipient/house",
      "recipient/messages/11111111-1111-4111-8111-111111111111",
      "recipient/media/11111111-1111-4111-8111-111111111111",
    ]) {
      expect((await request(path)).status).toBe(401);
    }
    state.jar.set("bubu-recipient", newSecret());
    expect((await request("recipient/house")).status).toBe(401);
  });
  it("validates both factors and issues an opaque HttpOnly recipient cookie only on success", async () => {
    const verifier = await hashPasscode("synthetic-passcode");
    state.rpc.mockImplementation(async (name: string) => ({
      data:
        name === "consume_rate_limit"
          ? true
          : name === "recipient_verifier"
            ? verifier
            : null,
      error: null,
    }));
    const token = newSecret();
    expect(
      (await request("recipient/unlock", "POST", { token, passcode: "wrong" }))
        .status,
    ).toBe(401);
    expect(state.setters).not.toHaveBeenCalled();
    const response = await request("recipient/unlock", "POST", {
      token,
      passcode: "synthetic-passcode",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.setters).toHaveBeenCalledWith(
      "bubu-recipient",
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        maxAge: 28800,
      }),
    );
    expect(state.jar.get("bubu-recipient")).not.toBe(token);
  });
  it("rate limits unlock before passcode verification and denies a foreign Origin", async () => {
    state.rpc.mockResolvedValue({ data: false, error: null });
    const body = { token: newSecret(), passcode: "synthetic-passcode" };
    expect((await request("recipient/unlock", "POST", body)).status).toBe(429);
    expect(
      (await request("recipient/unlock", "POST", body, "https://foreign.test"))
        .status,
    ).toBe(403);
    expect(state.setters).not.toHaveBeenCalled();
  });
});

describe("Recoverable contributor links and editing", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("requires admin authorization to reveal or replace links", async () => {
    for (const method of ["GET", "POST"]) {
      expect(
        (await request("admin/invitations/" + id + "/link", method)).status,
      ).toBe(401);
      state.jar.set("bubu-admin", "synthetic-jwt");
      state.validUser = true;
      state.member = false;
      expect(
        (await request("admin/invitations/" + id + "/link", method)).status,
      ).toBe(403);
      state.jar.clear();
    }
  });
  it("recovers the exact newly issued link and returns null for legacy links", async () => {
    state.jar.set("bubu-admin", "synthetic-jwt");
    state.validUser = true;
    state.member = true;
    const created = await request("admin/invitations", "POST", {
      label: "Synthetic Friend",
      expiresAt: null,
    });
    expect(created.status).toBe(201);
    const issued = state.rpc.mock.calls.find(
      ([name]) => name === "admin_issue_designated_invite",
    )![1];
    const body = await created.json();
    state.rows.invitations = {
      id: issued.p_id,
      token_hash: issued.p_hash,
      link_ciphertext: issued.p_cipher,
      revoked_at: null,
      expires_at: null,
    };
    const revealed = await request(
      "admin/invitations/" + issued.p_id + "/link",
    );
    expect((await revealed.json()).url).toBe(body.url);
    expect(body.url).not.toContain(issued.p_cipher);
    state.rows.invitations = {
      id,
      link_ciphertext: null,
      revoked_at: null,
      expires_at: null,
    };
    expect(
      await (await request("admin/invitations/" + id + "/link")).json(),
    ).toEqual({ url: null });
    state.rows.invitations = { id, revoked_at: "2026-10-17T00:00:00Z" };
    expect((await request("admin/invitations/" + id + "/link")).status).toBe(
      404,
    );
  });
  it("validates edit consent and forwards only the scoped session, message, and version", async () => {
    const payload = {
      message: "Updated synthetic letter",
      version: "2026-10-18T00:00:00.123456+00:00",
      consent: true,
    };
    expect((await request("contributions", "PATCH", payload)).status).toBe(401);
    state.jar.set("bubu-contributor", newSecret());
    expect(
      (await request("contributions", "PATCH", { ...payload, consent: false }))
        .status,
    ).toBe(400);
    expect(
      (
        await request("contributions", "PATCH", {
          ...payload,
          invitationId: id,
        })
      ).status,
    ).toBe(400);
    expect((await request("contributions", "PATCH", payload)).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("edit_instant_contribution", {
      p_session_hash: expect.any(String),
      p_message: payload.message,
      p_version: payload.version,
      p_share: null,
      p_retained: null,
      p_upload_ids: null,
    });
    expect(
      (await request("contributions", "PATCH", payload, "https://evil.test"))
        .status,
    ).toBe(403);
  });
});

describe("Contributor visit HTTP boundary", () => {
  it("requires a contributor session and returns the visual-only projection", async () => {
    expect((await request("contributor/visit")).status).toBe(401);
    state.jar.set("bubu-contributor", newSecret());
    const visual = {
      mapKey: "slu_baguio",
      visitor: { name: "Synthetic Friend", variant: "npc-cream-1" },
      npcs: [],
    };
    state.rpc.mockImplementation(async (name: string) => ({
      data:
        name === "active_contributor"
          ? "owner"
          : name === "contributor_visit"
            ? visual
            : true,
      error: null,
    }));
    expect(await (await request("contributor/visit")).json()).toEqual(visual);
    expect((await request("recipient/session")).status).toBe(401);
    expect((await request("recipient/ending")).status).toBe(401);
    expect(
      (await request("recipient/messages/11111111-1111-4111-8111-111111111111"))
        .status,
    ).toBe(401);
  });
  it("allows only admins to change a valid invitation designation", async () => {
    const path = "admin/invitations/11111111-1111-4111-8111-111111111111";
    expect(
      (await request(path, "PATCH", { mapKey: "slu_baguio" })).status,
    ).toBe(401);
    state.jar.set("bubu-admin", "synthetic-jwt");
    state.validUser = true;
    state.member = true;
    expect((await request(path, "PATCH", { mapKey: "unknown" })).status).toBe(
      400,
    );
    expect(
      (await request(path, "PATCH", { mapKey: "slu_baguio" })).status,
    ).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("admin_set_invite_place", {
      p_id: "11111111-1111-4111-8111-111111111111",
      p_map: "slu_baguio",
    });
  });
});

it("requires paired attachment lists on media edits and keeps the session scope server supplied", async () => {
  state.jar.set("bubu-contributor", newSecret());
  const payload = {
    message: "Updated memories",
    version: "2026-10-18T00:00:00Z",
    consent: true,
    retainedMedia: [
      { id: "11111111-1111-4111-8111-111111111111", description: "Caption" },
    ],
    uploadIds: [],
  };
  expect(
    (
      await request("contributions", "PATCH", {
        ...payload,
        uploadIds: undefined,
      })
    ).status,
  ).toBe(400);
  expect((await request("contributions", "PATCH", payload)).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith("edit_instant_contribution", {
    p_session_hash: expect.any(String),
    p_message: payload.message,
    p_version: payload.version,
    p_retained: payload.retainedMedia,
    p_upload_ids: [],
    p_share: null,
  });
});

it("scopes shared letters to a submitted contributor RPC and denies private or unavailable results", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  expect((await request("contributor/letters/" + id)).status).toBe(401);
  state.jar.set("bubu-contributor", newSecret());
  state.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "consume_rate_limit"
        ? true
        : name === "active_contributor"
          ? "owner"
          : name === "contributor_shared_message"
            ? {
                id,
                name: "Synthetic Friend",
                message: "Shared synthetic words",
              }
            : null,
    error: null,
  }));
  const response = await request("contributor/letters/" + id);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({
    id,
    name: "Synthetic Friend",
    message: "Shared synthetic words",
  });
  expect(state.rpc).toHaveBeenCalledWith("contributor_shared_message", {
    p_session_hash: expect.any(String),
    p_placement: id,
  });
  state.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "consume_rate_limit"
        ? true
        : name === "active_contributor"
          ? "owner"
          : null,
    error:
      name === "contributor_shared_message" ? { message: "Unavailable" } : null,
  }));
  expect((await request("contributor/letters/" + id)).status).toBe(404);
});
it("saves an explicit sharing choice atomically with fresh consent and the letter revision", async () => {
  state.jar.set("bubu-contributor", newSecret());
  const payload = {
    message: "Sharing synthetic words",
    consent: true,
    shareWithInvitees: true,
    uploadIds: [],
  };
  expect((await request("contributions", "POST", payload)).status).toBe(201);
  expect(state.rpc).toHaveBeenCalledWith("submit_instant_contribution", {
    p_session_hash: expect.any(String),
    p_message: payload.message,
    p_upload_ids: [],
    p_share: true,
  });
  const version = "2026-10-18T00:00:00Z";
  expect(
    (
      await request("contributions", "PATCH", {
        ...payload,
        shareWithInvitees: false,
        version,
        retainedMedia: [],
      })
    ).status,
  ).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith("edit_instant_contribution", {
    p_session_hash: expect.any(String),
    p_message: payload.message,
    p_version: version,
    p_retained: [],
    p_upload_ids: [],
    p_share: false,
  });
  expect(
    (
      await request("contributions", "PATCH", {
        ...payload,
        version,
        consent: false,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("contributions", "POST", {
        ...payload,
        shareWithInvitees: "yes",
      })
    ).status,
  ).toBe(400);
});
it("routes explicit character saves through the atomic character RPC and rejects arbitrary keys", async () => {
  state.jar.set("bubu-contributor", newSecret());
  const payload = {
    message: "Synthetic animal hello",
    consent: true,
    uploadIds: [],
    characterKey: "frog",
  };
  expect((await request("contributions", "POST", payload)).status).toBe(201);
  expect(state.rpc).toHaveBeenCalledWith(
    "submit_character_contribution",
    expect.objectContaining({
      p_character: "frog",
      p_share: false,
      p_message: payload.message,
    }),
  );
  expect(
    (
      await request("contributions", "PATCH", {
        ...payload,
        version: "2026-10-19T00:00:00Z",
        retainedMedia: [],
      })
    ).status,
  ).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "edit_character_contribution",
    expect.objectContaining({
      p_character: "frog",
      p_retained: [],
      p_upload_ids: [],
    }),
  );
  expect(
    (
      await request("contributions", "POST", {
        ...payload,
        characterKey: "../../private",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("contributions", "PATCH", {
        ...payload,
        characterKey: "dragon",
        version: "2026-10-19T00:00:00Z",
      })
    ).status,
  ).toBe(400);
});
