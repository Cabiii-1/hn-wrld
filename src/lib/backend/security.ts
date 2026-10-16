import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const newSecret = () => randomBytes(32).toString("base64url");
export function digest(secret: string, pepper: string) {
  return createHmac("sha256", pepper).update(secret).digest("hex");
}
export function constantTimeMatch(actual: string, expected: string) {
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function assertSameOrigin(request: Request, appOrigin: string) {
  if (
    request.headers.get("origin") !== appOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "Please submit from this website.");
}
export async function readJson(
  request: Request,
  maxBytes = 16_384,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Expected JSON.");
  return JSON.parse(
    new TextDecoder().decode(await readLimited(request.body, maxBytes)),
  );
}
export async function readLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
) {
  if (!body) throw new HttpError(400, "Empty request.");
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "File or request too large.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts);
}
export function mediaAccessAllowed(input: {
  admin: boolean;
  activeInvitation: string | null;
  ownerInvitation: string;
  mediaStatus: string;
  submitted: boolean;
}) {
  return (
    input.mediaStatus !== "deleted" &&
    (input.admin ||
      (input.activeInvitation === input.ownerInvitation &&
        (!input.submitted || input.mediaStatus !== "rejected")))
  );
}
export function byteRange(
  header: string | null,
  length: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]))
    throw new HttpError(416, "Invalid range.");
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, length - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= length ||
    start < 0
  )
    throw new HttpError(416, "Invalid range.");
  return { start, end };
}
