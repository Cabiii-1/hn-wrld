import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { parseBuffer } from "music-metadata";
import { MAX } from "./contracts";
import { webmOpusDuration } from "./webm-duration";

const photoTypes: Record<string, string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
};
const audioTypes: Record<string, string[]> = {
  mp3: ["audio/mpeg"],
  m4a: ["audio/mp4", "audio/x-m4a"],
  ogg: ["audio/ogg", "application/ogg"],
  webm: ["audio/webm"],
};
export type MediaLimits = {
  photoBytes: number;
  audioBytes: number;
  audioSeconds: number;
};
export function extensionOf(filename: string) {
  return filename.toLowerCase().split(".").pop() ?? "";
}
export function validateDeclaration(
  kind: "photo" | "audio",
  extension: string,
  mime: string,
  bytes: number,
  limits: MediaLimits = MAX,
) {
  const types = kind === "photo" ? photoTypes : audioTypes;
  if (
    !types[extension]?.includes(mime) ||
    bytes <= 0 ||
    bytes > (kind === "photo" ? limits.photoBytes : limits.audioBytes)
  )
    throw new Error("Choose a supported file within the size limit.");
}
export async function validateMedia(
  bytes: Uint8Array,
  declared: {
    kind: "photo" | "audio";
    extension: string;
    mime: string;
    bytes: number;
  },
  limits: MediaLimits = MAX,
) {
  validateDeclaration(
    declared.kind,
    declared.extension,
    declared.mime,
    bytes.byteLength,
    limits,
  );
  if (bytes.byteLength !== declared.bytes)
    throw new Error("The uploaded file size does not match.");
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected) throw new Error("The file could not be identified.");
  if (declared.kind === "photo") {
    const expected = declared.extension === "jpg" ? "jpeg" : declared.extension;
    if (detected.ext !== (expected === "jpeg" ? "jpg" : expected))
      throw new Error("The photo type does not match its extension.");
    const image = sharp(bytes, {
      limitInputPixels: 20_000_000,
      failOn: "warning",
      animated: false,
    });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || (meta.pages ?? 1) > 1)
      throw new Error("Please choose a still photo.");
    const clean = await image
      .rotate()
      .resize({
        width: 2560,
        height: 2560,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    if (clean.byteLength > limits.photoBytes)
      throw new Error("The processed photo is too large.");
    return {
      bytes: clean,
      mime: "image/webp",
      extension: "webp",
      durationMs: null,
    };
  }
  const allowed: Record<string, string[]> = {
    mp3: ["mp3"],
    m4a: ["m4a", "mp4"],
    ogg: ["ogg", "opus", "oga"],
    webm: ["webm"],
  };
  if (!allowed[declared.extension]?.includes(detected.ext))
    throw new Error("The audio type does not match its extension.");
  const { format } = await parseBuffer(
    bytes,
    { mimeType: detected.mime, size: bytes.byteLength },
    { duration: true, skipCovers: true },
  );
  if (
    format.hasVideo ||
    format.trackInfo.some((track) => track.video || track.type === 1)
  )
    throw new Error("Only audio recordings are accepted.");
  if (
    !format.sampleRate ||
    !format.numberOfChannels ||
    !/AAC|MPEG|MP3|VORBIS|OPUS/i.test(format.codec ?? "")
  )
    throw new Error("Unsupported audio codec.");
  let duration = Math.max(
    format.duration ?? 0,
    ...format.trackInfo.map((t) => t.duration ?? 0),
  );
  if (declared.extension === "webm") {
    if (
      format.trackInfo.length !== 1 ||
      !/OPUS/i.test(format.codec ?? "") ||
      !format.trackInfo[0].id
    )
      throw new Error("Choose a single-track Opus WebM recording.");
    duration = Math.max(
      duration,
      webmOpusDuration(bytes, format.trackInfo[0].id),
    );
  }
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > limits.audioSeconds
  )
    throw new Error(`Audio must be ${limits.audioSeconds} seconds or shorter.`);
  const mime = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    webm: "audio/webm",
  }[declared.extension]!;
  return {
    bytes: Buffer.from(bytes),
    mime,
    extension: declared.extension,
    durationMs: Math.ceil(duration * 1000),
  };
}
