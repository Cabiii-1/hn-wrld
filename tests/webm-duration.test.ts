import { describe, it, expect } from "vitest";
import { validateMedia } from "../src/lib/backend/media-validation";
import { webmOpusDuration } from "../src/lib/backend/webm-duration";
import { webmFixture } from "./webm-fixture";
describe("browser voice recordings", () => {
  it("handles consecutive unknown-size clusters without artificial nesting", async () => {
    const bytes = webmFixture(20, false, true);
    expect(webmOpusDuration(bytes, 1)).toBe(20);
    expect(
      (
        await validateMedia(bytes, {
          kind: "audio",
          extension: "webm",
          mime: "audio/webm",
          bytes: bytes.length,
        })
      ).durationMs,
    ).toBe(20000);
  });
  it("measures WebM without Duration metadata from real Opus packet clocks", async () => {
    const bytes = webmFixture(2);
    expect(webmOpusDuration(bytes, 1)).toBeCloseTo(2);
    const valid = await validateMedia(bytes, {
      kind: "audio",
      extension: "webm",
      mime: "audio/webm",
      bytes: bytes.length,
    });
    expect(valid.durationMs).toBe(2000);
    expect(valid.mime).toBe("audio/webm");
  });
  it("rejects overlong packet clocks and any video tracks", async () => {
    const long = webmFixture(91);
    await expect(
      validateMedia(long, {
        kind: "audio",
        extension: "webm",
        mime: "audio/webm",
        bytes: long.length,
      }),
    ).rejects.toThrow("seconds");
    const video = webmFixture(1, true);
    await expect(
      validateMedia(video, {
        kind: "audio",
        extension: "webm",
        mime: "audio/webm",
        bytes: video.length,
      }),
    ).rejects.toThrow("Only audio");
  });
  it("fails closed on malformed EBML, truncated blocks and unknown tracks", () => {
    expect(() => webmOpusDuration(Buffer.from([0]), 1)).toThrow();
    const b = webmFixture(1);
    expect(() => webmOpusDuration(b.subarray(0, b.length - 1), 1)).toThrow();
    expect(() => webmOpusDuration(b, 2)).toThrow();
  });
});
