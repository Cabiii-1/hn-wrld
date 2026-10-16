// Original synthetic Opus silence in a browser-style WebM container. No recordings.
function numberBytes(value: number) {
  const parts: number[] = [];
  do {
    parts.unshift(value & 255);
    value = Math.floor(value / 256);
  } while (value);
  return Buffer.from(parts);
}
function sizeBytes(length: number) {
  for (let n = 1; n <= 6; n++)
    if (length < 2 ** (7 * n) - 1) {
      const bytes = Buffer.alloc(n);
      let v = length;
      for (let i = n - 1; i >= 0; i--) {
        bytes[i] = v & 255;
        v = Math.floor(v / 256);
      }
      bytes[0] |= 1 << (8 - n);
      return bytes;
    }
  throw new Error("Fixture too large");
}
function tag(id: number, data: Uint8Array) {
  return Buffer.concat([numberBytes(id), sizeBytes(data.length), data]);
}
const uint = (id: number, n: number) => tag(id, numberBytes(n));
const text = (id: number, s: string) => tag(id, Buffer.from(s));
export function webmFixture(
  seconds: number,
  video = false,
  unknownClusters = false,
) {
  const header = tag(
    0x1a45dfa3,
    Buffer.concat([
      uint(0x4286, 1),
      uint(0x42f7, 1),
      uint(0x42f2, 4),
      uint(0x42f3, 8),
      text(0x4282, "webm"),
      uint(0x4287, 4),
      uint(0x4285, 2),
    ]),
  );
  const sampleRate = Buffer.alloc(8);
  sampleRate.writeDoubleBE(48000);
  const opusHead = Buffer.from([
    79, 112, 117, 115, 72, 101, 97, 100, 1, 1, 0, 0, 128, 187, 0, 0, 0, 0, 0,
  ]);
  const track = tag(
    0xae,
    Buffer.concat([
      uint(0xd7, 1),
      uint(0x73c5, 1),
      uint(0x83, 2),
      text(0x86, "A_OPUS"),
      tag(0x63a2, opusHead),
      tag(0xe1, Buffer.concat([tag(0xb5, sampleRate), uint(0x9f, 1)])),
    ]),
  );
  const videoTrack = tag(
    0xae,
    Buffer.concat([
      uint(0xd7, 2),
      uint(0x73c5, 2),
      uint(0x83, 1),
      text(0x86, "V_VP8"),
      tag(0xe0, Buffer.concat([uint(0xb0, 16), uint(0xba, 16)])),
    ]),
  );
  const clusters: Buffer[] = [];
  const packets = Math.ceil(seconds * 50);
  for (let start = 0; start < packets; start += 50) {
    const blocks: Buffer[] = [uint(0xe7, start * 20)];
    for (let p = start; p < Math.min(packets, start + 50); p++) {
      const relative = (p - start) * 20;
      blocks.push(
        tag(
          0xa3,
          Buffer.from([
            0x81,
            relative >> 8,
            relative & 255,
            0x80,
            0xf8,
            0xff,
            0xfe,
          ]),
        ),
      );
    }
    const payload = Buffer.concat(blocks);
    clusters.push(
      unknownClusters
        ? Buffer.concat([
            numberBytes(0x1f43b675),
            Buffer.from([1, 255, 255, 255, 255, 255, 255, 255]),
            payload,
          ])
        : tag(0x1f43b675, payload),
    );
  }
  const segment = tag(
    0x18538067,
    Buffer.concat([
      tag(
        0x1549a966,
        Buffer.concat([
          uint(0x2ad7b1, 1_000_000),
          text(0x4d80, "synthetic-fixture"),
        ]),
      ),
      tag(0x1654ae6b, Buffer.concat(video ? [track, videoTrack] : [track])),
      ...clusters,
    ]),
  );
  return Buffer.concat([header, segment]);
}
