import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  validateDeclaration,
  validateMedia,
} from "../src/lib/backend/media-validation";

function silentMp3(seconds: number) {
  // Original synthetic MPEG-1 Layer III silent frames, no personal recording.
  const frames = Math.ceil((seconds * 44100) / 1152);
  const bytes = Buffer.alloc(frames * 417);
  for (let i = 0; i < frames; i++) bytes.set([0xff, 0xfb, 0x90, 0x00], i * 417);
  return bytes;
}
describe("uploaded media validation", () => {
  it("decodes photos, strips metadata and serves a normalized WebP", async () => {
    const bytes = await sharp({
      create: { width: 12, height: 12, channels: 3, background: "#e5d7a8" },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: "SYNTHETIC_METADATA_TO_STRIP" } })
      .toBuffer();
    const clean = await validateMedia(bytes, {
      kind: "photo",
      extension: "jpg",
      mime: "image/jpeg",
      bytes: bytes.length,
    });
    const meta = await sharp(clean.bytes).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBe(12);
    expect(clean.durationMs).toBeNull();
  });
  it("rejects SVG/HTML, byte spoofing and extension/MIME mismatch", async () => {
    expect(() =>
      validateDeclaration("photo", "svg", "image/svg+xml", 100),
    ).toThrow();
    const bytes = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await expect(
      validateMedia(bytes, {
        kind: "photo",
        extension: "png",
        mime: "image/png",
        bytes: bytes.length,
      }),
    ).rejects.toThrow();
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(
      validateMedia(png, {
        kind: "photo",
        extension: "jpg",
        mime: "image/jpeg",
        bytes: png.length,
      }),
    ).rejects.toThrow("extension");
    await expect(
      validateMedia(png, {
        kind: "photo",
        extension: "png",
        mime: "image/png",
        bytes: png.length + 1,
      }),
    ).rejects.toThrow("size");
  });
  it("rejects oversized media before decoding", () => {
    expect(() =>
      validateDeclaration("photo", "png", "image/png", 5242881),
    ).toThrow();
    expect(() =>
      validateDeclaration("audio", "mp3", "audio/mpeg", 15728641),
    ).toThrow();
  });
  it("detects valid synthetic MP3 frames and enforces server-derived duration", async () => {
    const bytes = silentMp3(2);
    const clean = await validateMedia(bytes, {
      kind: "audio",
      extension: "mp3",
      mime: "audio/mpeg",
      bytes: bytes.length,
    });
    expect(clean.mime).toBe("audio/mpeg");
    expect(clean.durationMs).toBeGreaterThan(1900);
    expect(clean.durationMs).toBeLessThan(2200);
    const long = silentMp3(91);
    await expect(
      validateMedia(long, {
        kind: "audio",
        extension: "mp3",
        mime: "audio/mpeg",
        bytes: long.length,
      }),
    ).rejects.toThrow("seconds");
  });
  it("rejects truncated and fake audio", async () => {
    const bytes = Buffer.from("this is not a recording");
    await expect(
      validateMedia(bytes, {
        kind: "audio",
        extension: "mp3",
        mime: "audio/mpeg",
        bytes: bytes.length,
      }),
    ).rejects.toThrow();
  });
});
