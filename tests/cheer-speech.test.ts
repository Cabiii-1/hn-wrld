import { expect, it } from "vitest";
import {
  CheerSpeech,
  MOTIVATIONAL_CHEERS,
  type CheerSpeechLine,
  atongBearId,
} from "../src/game/cheer-speech";

function next(
  speech: CheerSpeech,
  visible: readonly string[],
): CheerSpeechLine {
  // Expire the last bubble, then allow any configured inter-bubble gap.
  speech.step(4500, visible, false);
  return speech.step(4000, visible, false)!;
}

it("uses the exact requested motivational lines and only the assigned bear's quote once", () => {
  expect(MOTIVATIONAL_CHEERS).toEqual([
    "Kaya mo yan Hanna!!",
    "Goodluck Lagi!!",
    "Andito lang kami lagi sayo!!^^",
  ]);
  const ids = ["one", "two", "three", "four"];
  const speech = new CheerSpeech(ids, () => 0.5, "three");
  expect(speech.specialBearId).toBe("three");
  let line = speech.step(1000, ids, false)!;
  const observed: CheerSpeechLine[] = [line];
  for (let i = 0; i < 31; i++) {
    line = next(speech, ids);
    observed.push(line);
  }
  const special = observed.filter((utterance) => utterance.text === "nigga");
  expect(special).toHaveLength(1);
  expect(new Set(special.map((utterance) => utterance.id))).toEqual(
    new Set(["three"]),
  );
  expect(
    observed
      .filter((utterance) => utterance.id !== "three")
      .every((utterance) =>
        (MOTIVATIONAL_CHEERS as readonly string[]).includes(utterance.text),
      ),
  ).toBe(true);
  expect(speech.specialBearId).toBe("three");
});

it("rotates all visible speakers fairly without consecutive duplicates", () => {
  const ids = ["one", "two", "three", "four"];
  const speech = new CheerSpeech(ids, () => 0);
  const lines = [speech.step(1000, ids, false)!];
  for (let i = 0; i < 15; i++) lines.push(next(speech, ids));
  for (let start = 0; start < lines.length; start += ids.length)
    expect(
      new Set(lines.slice(start, start + ids.length).map((l) => l.id)),
    ).toEqual(new Set(ids));
  expect(lines.slice(1).every((line, i) => line.id !== lines[i].id)).toBe(true);
});

it("covers every regular phrase in each shuffle bag without repeating the last phrase", () => {
  const speech = new CheerSpeech(["special", "regular"], () => 0, "special");
  // The special bearer stays fixed offscreen; it is not reassigned to this bear.
  const visible = ["regular"];
  const lines = [speech.step(1000, visible, false)!];
  for (let i = 0; i < 11; i++) lines.push(next(speech, visible));
  for (let start = 0; start < lines.length; start += 3)
    expect(new Set(lines.slice(start, start + 3).map((l) => l.text))).toEqual(
      new Set(MOTIVATIONAL_CHEERS),
    );
  expect(lines.slice(1).every((line, i) => line.text !== lines[i].text)).toBe(
    true,
  );
});

it("waits initially, shows one bubble for 4.5 seconds, then leaves a gap", () => {
  const speech = new CheerSpeech(["only"], () => 0, "only");
  expect(speech.step(999, ["only"], false)).toBeNull();
  const line = speech.step(1, ["only"], false);
  expect(line).toEqual({ id: "only", text: "nigga" });
  expect(speech.step(4499, ["only"], false)).toBe(line);
  expect(speech.step(1, ["only"], false)).toBeNull();
  expect(speech.step(1999, ["only"], false)).toBeNull();
  const second = speech.step(1, ["only"], false);
  expect(second?.id).toBe("only");
  expect(MOTIVATIONAL_CHEERS).toContain(second?.text);
});

it("uses the special quote only once even when a single bear is the whole cast", () => {
  const speech = new CheerSpeech(["only"], () => 0, "only");
  const lines = [speech.step(1000, ["only"], false)!];
  for (let i = 0; i < 12; i++) lines.push(next(speech, ["only"]));
  expect(lines.filter((line) => line.text === "nigga")).toHaveLength(1);
  expect(new Set(lines.slice(1).map((line) => line.text))).toEqual(
    new Set(MOTIVATIONAL_CHEERS),
  );
  expect(
    lines.slice(2).every((line, index) => line.text !== lines[index + 1].text),
  ).toBe(true);
});

it("hides and freezes speech and idle timers during pause", () => {
  const speech = new CheerSpeech(["one", "two"], () => 0);
  speech.step(500, ["one", "two"], false);
  expect(speech.step(100000, ["one", "two"], true)).toBeNull();
  expect(speech.step(499, ["one", "two"], false)).toBeNull();
  const line = speech.step(1, ["one", "two"], false);
  speech.step(1000, ["one", "two"], false);
  expect(speech.step(100000, ["one", "two"], true)).toBeNull();
  expect(speech.step(3499, ["one", "two"], false)).toBe(line);
  expect(speech.step(1, ["one", "two"], false)).toBeNull();
});

it("cancels an offscreen speaker immediately, including while paused", () => {
  const speech = new CheerSpeech(["one", "two"], () => 0);
  const line = speech.step(1000, ["one", "two"], false)!;
  const remaining = line.id === "one" ? "two" : "one";
  expect(speech.step(0, [remaining], true)).toBeNull();
  expect(speech.step(0, ["one", "two"], false)).toBeNull();
  const replacement = speech.step(2000, [remaining], false);
  expect(replacement?.id).toBe(remaining);
  expect(replacement).not.toBe(line);
});

it("ignores empty and foreign visibility, duplicates and invalid elapsed values safely", () => {
  const empty = new CheerSpeech([], () => 0);
  expect(empty.specialBearId).toBeUndefined();
  expect(empty.step(100000, ["outsider"], false)).toBeNull();
  const speech = new CheerSpeech(["", "one", "one", "two"], () => 0);
  expect(speech.specialBearId).toBeUndefined();
  expect(speech.step(100000, [], false)).toBeNull();
  expect(speech.step(100000, ["outsider"], false)).toBeNull();
  expect(speech.step(Number.NaN, ["two"], false)).toBeNull();
  expect(speech.step(-1000, ["two"], false)).toBeNull();
  const line = speech.step(1000, ["two", "two", "outsider"], false);
  expect(line?.id).toBe("two");
  expect(line?.text).not.toBe("nigga");
  expect(speech.step(0, [], false)).toBeNull();
});

it("matches Atong exactly without falling back to another friend", () => {
  const roster = [
    { id: "b", name: "Atong's friend" },
    { id: "a", name: "  ATONG  " },
  ];
  expect(atongBearId(roster)).toBe("a");
  expect(atongBearId(roster.slice(0, 1))).toBeUndefined();
  const speech = new CheerSpeech(
    ["b"],
    () => 0,
    atongBearId(roster.slice(0, 1)),
  );
  const lines = [speech.step(1000, ["b"], false)!];
  for (let i = 0; i < 8; i++) lines.push(next(speech, ["b"]));
  expect(
    lines.every((line) =>
      (MOTIVATIONAL_CHEERS as readonly string[]).includes(line.text),
    ),
  ).toBe(true);
  expect(
    new CheerSpeech(["b"], () => 0, "absent").specialBearId,
  ).toBeUndefined();
});
