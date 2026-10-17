import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const derive = (passcode: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      passcode,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
// Node's scrypt is available on the server without a native addon. 32 MiB per
// derivation, salted per link; request throttling runs before this expensive work.
export async function hashPasscode(passcode: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(passcode, salt);
  return `scrypt$${salt}$${key.toString("hex")}`;
}
export async function verifyPasscode(
  passcode: string,
  verifier: string | null,
) {
  const valid = /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(verifier ?? "");
  const [, salt, expected] = valid
    ? verifier!.split("$")
    : ["scrypt", "0".repeat(32), "0".repeat(128)];
  const actual = await derive(passcode, salt);
  return timingSafeEqual(actual, Buffer.from(expected, "hex")) && valid;
}
