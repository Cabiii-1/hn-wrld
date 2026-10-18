import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

// Separate encryption key from the pepper's token-verification purpose.
const key = (pepper: string) =>
  createHmac("sha256", pepper)
    .update("bubu/invitation-link-encryption/v1")
    .digest();

export function sealInvitation(token: string, id: string, pepper: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(pepper), iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

export function openInvitation(value: string, id: string, pepper: string) {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(pepper),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from(id));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
