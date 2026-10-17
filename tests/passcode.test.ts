import { describe, it, expect } from "vitest";
import { hashPasscode, verifyPasscode } from "../src/lib/backend/passcode";
describe("recipient passcode verification", () => {
  it("salts slow hashes independently and rejects wrong/missing/malformed verifiers", async () => {
    const a = await hashPasscode("synthetic passphrase"),
      b = await hashPasscode("synthetic passphrase");
    expect(a).not.toBe(b);
    expect(a).not.toContain("synthetic passphrase");
    expect(await verifyPasscode("synthetic passphrase", a)).toBe(true);
    expect(await verifyPasscode("wrong passphrase", a)).toBe(false);
    expect(await verifyPasscode("synthetic passphrase", null)).toBe(false);
    expect(await verifyPasscode("synthetic passphrase", "scrypt$bad")).toBe(
      false,
    );
  });
});
