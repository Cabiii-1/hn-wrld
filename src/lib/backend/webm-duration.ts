// MediaRecorder WebM often omits Segment Duration. Measure audio packet clocks
// instead of trusting a client-supplied duration or a possibly forged header.
// Supports the single-track, unlaced Opus layout emitted by browser recorders.
export function webmOpusDuration(bytes: Uint8Array, audioTrack: number) {
  let timeScale = 1_000_000,
    packetMilliseconds = 0,
    latestEnd = 0,
    blocks = 0;
  function vint(offset: number, id = false) {
    if (offset >= bytes.length || bytes[offset] === 0)
      throw new Error("Invalid WebM element.");
    const first = bytes[offset];
    let mask = 0x80,
      size = 1;
    while (!(first & mask)) {
      mask >>= 1;
      size++;
    }
    if (size > (id ? 4 : 8) || offset + size > bytes.length)
      throw new Error("Truncated WebM element.");
    let value = id ? first : first & (mask - 1),
      unknown = !id && (first & (mask - 1)) === mask - 1;
    for (let i = 1; i < size; i++) {
      value = value * 256 + bytes[offset + i];
      unknown = unknown && bytes[offset + i] === 255;
    }
    if (!unknown && !Number.isSafeInteger(value))
      throw new Error("Invalid WebM length.");
    return { size, value, unknown };
  }
  function uint(start: number, end: number) {
    let result = 0;
    if (end - start > 6 || end <= start) throw new Error("Invalid timestamp.");
    for (let i = start; i < end; i++) result = result * 256 + bytes[i];
    return result;
  }
  function opusPacket(start: number, end: number) {
    if (start >= end) throw new Error("Empty Opus packet.");
    const config = bytes[start] >> 3,
      code = bytes[start] & 3;
    const frameMs =
      config >= 16
        ? 2.5 * 2 ** (config & 3)
        : config >= 12
          ? 10 * 2 ** (config & 1)
          : (config & 3) === 3
            ? 60
            : 10 * 2 ** (config & 3);
    if (code === 3 && start + 1 >= end)
      throw new Error("Truncated Opus packet.");
    const frames = code === 0 ? 1 : code === 3 ? bytes[start + 1] & 63 : 2;
    const duration = frames * frameMs;
    if (frames < 1 || duration > 120)
      throw new Error("Invalid Opus frame count.");
    return duration;
  }
  const containers = new Set([
    0x1a45dfa3, 0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0xe1, 0x1f43b675,
    0xa0,
  ]);
  function walk(
    start: number,
    end: number,
    depth: number,
    clusterTime = 0,
    unknownCluster = false,
  ): number {
    if (depth > 12) throw new Error("WebM nesting limit exceeded.");
    let localTime = clusterTime;
    for (let offset = start; offset < end;) {
      const tag = vint(offset, true),
        length = vint(offset + tag.size);
      if (unknownCluster && tag.value === 0x1f43b675) return offset;
      if (
        length.unknown &&
        tag.value !== 0x18538067 &&
        tag.value !== 0x1f43b675
      )
        throw new Error("Invalid unknown-size WebM element.");
      const payload = offset + tag.size + length.size;
      let next = length.unknown ? end : payload + length.value;
      if (next > end || next < payload)
        throw new Error("Truncated WebM payload.");
      if (tag.value === 0x2ad7b1) timeScale = uint(payload, next);
      else if (tag.value === 0xe7) localTime = uint(payload, next);
      else if (tag.value === 0xa3 || tag.value === 0xa1) {
        const track = vint(payload),
          position = payload + track.size;
        if (
          track.value !== audioTrack ||
          position + 3 >= next ||
          bytes[position + 2] & 6
        )
          throw new Error("Unsupported WebM audio block.");
        let relative = bytes[position] * 256 + bytes[position + 1];
        if (relative & 0x8000) relative -= 0x10000;
        const duration = opusPacket(position + 3, next);
        packetMilliseconds += duration;
        latestEnd = Math.max(
          latestEnd,
          ((localTime + relative) * timeScale) / 1_000_000 + duration,
        );
        blocks++;
      } else if (containers.has(tag.value)) {
        const consumed = walk(
          payload,
          next,
          depth + 1,
          tag.value === 0x1f43b675 ? 0 : localTime,
          length.unknown && tag.value === 0x1f43b675,
        );
        if (length.unknown) next = consumed;
      }
      offset = next;
    }
    return end;
  }
  walk(0, bytes.length, 0);
  if (!blocks || timeScale <= 0) throw new Error("No timed audio blocks.");
  return Math.max(packetMilliseconds, latestEnd) / 1000;
}
