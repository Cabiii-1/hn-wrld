export type LetterPage = { text: string; start: number; end: number };

/** Fit rendered lines, preferring authored breaks, then sentences, then words. */
export function layoutLetterPages(
  message: string,
  fits: (text: string) => boolean,
): LetterPage[] {
  const characters = Array.from(message.replace(/\r\n?/g, "\n").trim());
  const pages: LetterPage[] = [];
  let start = 0;
  while (start < characters.length) {
    const remaining = characters.slice(start);
    let low = 1,
      high = remaining.length,
      count = 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (fits(remaining.slice(0, middle).join(""))) {
        count = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    if (count < remaining.length) {
      const candidate = remaining.slice(0, count).join("");
      const newline =
        remaining[count] === "\n"
          ? candidate.length
          : candidate.lastIndexOf("\n");
      const sentences = [
        ...candidate.matchAll(/[.!?…。！？]["'”’)]*(?=\s|$)/gu),
      ];
      const sentence = sentences.at(-1);
      const words = [...candidate.matchAll(/\s+/gu)];
      const word = words.at(-1);
      const boundary =
        newline > 0
          ? newline
          : sentence
            ? sentence.index! + sentence[0].trimEnd().length
            : word?.index;
      if (boundary !== undefined && boundary > 0)
        count = Array.from(candidate.slice(0, boundary)).length;
    }
    const end = start + count;
    pages.push({
      text: characters.slice(start, end).join("").trim(),
      start,
      end,
    });
    start = end;
    while (start < characters.length && /\s/u.test(characters[start])) start++;
  }
  return pages.length ? pages : [{ text: "", start: 0, end: 0 }];
}
