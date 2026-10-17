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
      state.rpc.mock.calls.some(([fn]) => fn === "submit_contribution"),
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
