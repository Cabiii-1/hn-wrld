import { describe, expect, it } from "vitest";
import {
  contributionSchema,
  isSafeHousePlacement,
  tokenSchema,
  uploadSchema,
} from "../src/lib/backend/contracts";
import {
  assertSameOrigin,
  byteRange,
  constantTimeMatch,
  digest,
  mediaAccessAllowed,
  newSecret,
  readJson,
} from "../src/lib/backend/security";

describe("M2 request and authorization boundaries", () => {
  it("generates unguessable secrets and deterministic peppered digests", () => {
    const a = newSecret(),
      b = newSecret();
    expect(tokenSchema.parse(a)).toBe(a);
    expect(a).not.toBe(b);
    expect(digest(a, "pepper-one")).not.toBe(digest(a, "pepper-two"));
    expect(digest(a, "pepper-one")).toHaveLength(64);
    expect(constantTimeMatch(a, a)).toBe(true);
    expect(constantTimeMatch(a, b)).toBe(false);
    expect(constantTimeMatch(a, "x")).toBe(false);
  });
  it("rejects forged moderation fields and missing consent", () => {
    const valid = {
      displayName: "Sample Friend",
      relationship: "",
      message: "A synthetic hello 🌼",
      consent: true,
      uploadIds: [],
    };
    expect(contributionSchema.safeParse(valid).success).toBe(true);
    expect(
      contributionSchema.safeParse({
        message: valid.message,
        consent: true,
        uploadIds: [],
      }).success,
    ).toBe(true);
    for (const forged of [
      { ...valid, status: "approved" },
      { ...valid, consent: false },
      { ...valid, invitationId: newSecret() },
      { ...valid, message: " ".repeat(3) },
      { ...valid, message: "x".repeat(2001) },
    ])
      expect(contributionSchema.safeParse(forged).success).toBe(false);
  });
  it("rejects oversized metadata and malformed IDs", () => {
    expect(
      uploadSchema.safeParse({
        kind: "photo",
        filename: "x.png",
        bytes: 2,
        mime: "image/png",
        description: "x".repeat(301),
      }).success,
    ).toBe(false);
    expect(tokenSchema.safeParse("guess").success).toBe(false);
  });
  it("blocks cross-site, missing-origin and incorrect-origin mutations", () => {
    const req = (origin?: string, site?: string) =>
      new Request("https://world.test/api", {
        headers: {
          ...(origin ? { Origin: origin } : {}),
          ...(site ? { "Sec-Fetch-Site": site } : {}),
        },
      });
    expect(() =>
      assertSameOrigin(req("https://world.test"), "https://world.test"),
    ).not.toThrow();
    for (const r of [
      req(),
      req("https://attacker.test"),
      req("https://world.test", "cross-site"),
    ])
      expect(() => assertSameOrigin(r, "https://world.test")).toThrow();
  });
  it("enforces body byte limits even without Content-Length", async () => {
    const req = new Request("https://world.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "x".repeat(100) }),
    });
    await expect(readJson(req, 30)).rejects.toThrow("too large");
  });
  it("denies guest, wrong contributor, revoked-session and rejected-media reads", () => {
    const base = {
      admin: false,
      activeInvitation: null,
      ownerInvitation: "owner",
      mediaStatus: "pending",
      submitted: true,
    };
    expect(mediaAccessAllowed(base)).toBe(false);
    expect(
      mediaAccessAllowed({ ...base, activeInvitation: "someone-else" }),
    ).toBe(false);
    expect(mediaAccessAllowed({ ...base, activeInvitation: "owner" })).toBe(
      true,
    );
    expect(
      mediaAccessAllowed({
        ...base,
        activeInvitation: "owner",
        mediaStatus: "rejected",
      }),
    ).toBe(false);
    expect(
      mediaAccessAllowed({ ...base, admin: true, mediaStatus: "rejected" }),
    ).toBe(true);
    expect(
      mediaAccessAllowed({ ...base, admin: true, mediaStatus: "deleted" }),
    ).toBe(false);
  });
  it("requires the entire wander square to be safe", () => {
    expect(isSafeHousePlacement(425, 352, 20)).toBe(true);
    expect(isSafeHousePlacement(450, 300, 20)).toBe(false);
    expect(isSafeHousePlacement(650, 350, 50)).toBe(false);
    expect(isSafeHousePlacement(100, 400, 40)).toBe(false);
  });
  it("supports bounded audio byte ranges and rejects malformed/multiple ranges", () => {
    expect(byteRange(null, 100)).toBeNull();
    expect(byteRange("bytes=5-12", 100)).toEqual({ start: 5, end: 12 });
    expect(byteRange("bytes=-20", 100)).toEqual({ start: 80, end: 99 });
    expect(byteRange("bytes=95-", 100)).toEqual({ start: 95, end: 99 });
    for (const h of [
      "bytes=200-300",
      "bytes=20-10",
      "bytes=0-2,4-5",
      "bytes=-0",
      "bytes=-",
    ])
      expect(() => byteRange(h, 100)).toThrow();
  });
});
