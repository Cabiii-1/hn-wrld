export const MOTIVATIONAL_CHEERS = [
  "Kaya mo yan Hanna!!",
  "Goodluck Lagi!!",
  "Andito lang kami lagi sayo!!^^",
] as const;

export type CheerSpeechLine = { id: string; text: string };

/** One transient bubble; no requests, persistence, or frame-driven UI state. */
export class CheerSpeech {
  readonly specialBearId: string | undefined;
  private readonly ids: Set<string>;
  private speakerBag: string[] = [];
  private phraseBag: string[] = [];
  private lastSpeaker: string | undefined;
  private lastPhrase: string | undefined;
  private specialSpoken = false;
  private active: CheerSpeechLine | null = null;
  private activeMs = 0;
  private waitMs = 1000;

  constructor(
    ids: readonly string[],
    private readonly random: () => number = Math.random,
  ) {
    this.ids = new Set(ids.filter((id) => id.length > 0));
    const unique = [...this.ids];
    this.specialBearId = unique.length
      ? unique[Math.floor(this.unit() * unique.length)]
      : undefined;
  }

  /** Returns the active line, or null while idle, paused or outside the camera. */
  step(
    deltaMs: number,
    visibleIds: readonly string[],
    paused: boolean,
  ): CheerSpeechLine | null {
    const visible = [...new Set(visibleIds)].filter((id) => this.ids.has(id));
    if (this.active && !visible.includes(this.active.id)) {
      this.active = null;
      this.activeMs = 0;
      this.waitMs = this.gap();
    }
    if (paused || !visible.length) return null;

    let elapsed = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    if (this.active) {
      if (elapsed < this.activeMs) {
        this.activeMs -= elapsed;
        return this.active;
      }
      elapsed -= this.activeMs;
      this.active = null;
      this.activeMs = 0;
      this.waitMs = this.gap();
    }
    if (elapsed < this.waitMs) {
      this.waitMs -= elapsed;
      return null;
    }

    const id = this.speaker(visible);
    const special = id === this.specialBearId && !this.specialSpoken;
    const text = special ? "nigga" : this.phrase();
    if (special) this.specialSpoken = true;
    this.active = { id, text };
    this.lastSpeaker = id;
    this.activeMs = 4500;
    // A long frame starts at most one new visible bubble, never a catch-up burst.
    this.waitMs = 0;
    return this.active;
  }

  private speaker(visible: string[]) {
    this.speakerBag = this.speakerBag.filter((id) => visible.includes(id));
    if (
      !this.speakerBag.length ||
      (visible.length > 1 &&
        this.speakerBag.every((id) => id === this.lastSpeaker))
    )
      this.speakerBag = this.shuffle(visible);
    this.avoidFirst(this.speakerBag, this.lastSpeaker);
    return this.speakerBag.shift()!;
  }

  private phrase() {
    if (!this.phraseBag.length)
      this.phraseBag = this.shuffle([...MOTIVATIONAL_CHEERS]);
    this.avoidFirst(this.phraseBag, this.lastPhrase);
    const phrase = this.phraseBag.shift()!;
    this.lastPhrase = phrase;
    return phrase;
  }

  private avoidFirst(bag: string[], previous: string | undefined) {
    if (bag[0] !== previous) return;
    const alternative = bag.findIndex((value) => value !== previous);
    if (alternative > 0)
      [bag[0], bag[alternative]] = [bag[alternative], bag[0]];
  }

  private shuffle(values: string[]) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(this.unit() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  private gap() {
    return 2000 + this.unit() * 2000;
  }

  private unit() {
    const value = this.random();
    return Number.isFinite(value)
      ? Math.max(0, Math.min(1 - Number.EPSILON, value))
      : 0;
  }
}
