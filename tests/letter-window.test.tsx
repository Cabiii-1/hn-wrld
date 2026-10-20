// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "../src/components/ui/dialog";
import {
  GameDialogueContent,
  LetterWindow,
} from "../src/components/letter-window";
import { layoutLetterPages } from "../src/lib/letter-pages";
import {
  TypewriterText,
  type TypewriterHandle,
} from "../src/components/typewriter-text";
import { RecipientDialogue } from "../src/components/recipient-dialogue";
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const height = (value: string) =>
  value
    .split("\n")
    .reduce(
      (lines, line) =>
        lines + Math.max(1, Math.ceil(Array.from(line).length / 36)),
      0,
    ) * 20;
const pagesFor = (value: string) =>
  layoutLetterPages(value, (text) => height(text) <= 100);
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("windowskin-reading") ? 360 : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("windowskin-reading") ? 100 : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("windowskin-measure")
        ? height(this.textContent ?? "")
        : 0;
    },
  );
});
const longLetter =
  "A synthetic hello with room to breathe. ".repeat(35) +
  "A final little thought. 🌼";
function Example({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className="game-stage">
      {!open && <button onClick={() => setOpen(true)}>Talk</button>}
      <canvas tabIndex={0} />
      <Dialog open={open} onOpenChange={setOpen}>
        <GameDialogueContent>
          <LetterWindow
            name="Sample friend"
            subtitle="A hello for Hanna"
            message={longLetter}
            onClose={() => setOpen(false)}
            returnLabel="Return to the Park"
          />
        </GameDialogueContent>
      </Dialog>
    </div>
  );
}
it("fits rendered lines and preserves Unicode and authored line breaks", () => {
  const source = "Hello 🌼\n\n" + "🧸".repeat(600) + "\n\nThe final thought.";
  const pages = pagesFor(source);
  expect(pages.every((p) => height(p.text) <= 100)).toBe(true);
  expect(
    pages
      .map((p) => p.text)
      .join("")
      .replace(/\s/gu, ""),
  ).toBe(source.replace(/\s/gu, ""));
  expect(pages[0].text).toBe("Hello 🌼");
  expect(pages.at(-1)?.text).toContain("The final thought.");
});
it("does not impose character limits and prefers complete lines or sentences", () => {
  const paragraph = "A whole sentence that fits. ".repeat(20);
  expect(layoutLetterPages(paragraph, () => true)).toHaveLength(1);
  expect(
    layoutLetterPages(
      "first\nsecond\nthird",
      (text) => text.split("\n").length <= 2,
    )[0].text,
  ).toBe("first\nsecond");
  const source =
    "This sentence belongs together. This next sentence is much too long to fit in the available lines.";
  expect(layoutLetterPages(source, (text) => text.length <= 55)[0].text).toBe(
    "This sentence belongs together.",
  );
});
it("reveals complete graphemes over time and allows an immediate finish", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.useFakeTimers();
  const ref = React.createRef<TypewriterHandle>();
  const { container } = render(
    <TypewriterText
      ref={ref}
      text="👩‍⚖️ Hello Hanna"
      onTypingChange={() => {}}
    />,
  );
  expect(
    container.querySelector("[data-typewriter-revealed]")?.textContent,
  ).toBe("");
  act(() => vi.advanceTimersByTime(25));
  expect(
    container.querySelector("[data-typewriter-revealed]")?.textContent,
  ).toBe("👩‍⚖️");
  act(() => {
    expect(ref.current!.finish()).toBe(true);
  });
  expect(container.querySelector(".windowskin-text")?.textContent).toBe(
    "👩‍⚖️ Hello Hanna",
  );
  expect(ref.current!.finish()).toBe(false);
});
it("shows text immediately for reduced motion", () => {
  const { container } = render(
    <TypewriterText text="A calm hello." onTypingChange={() => {}} />,
  );
  expect(container.querySelector(".windowskin-text")?.textContent).toBe(
    "A calm hello.",
  );
  expect(container.querySelector("[data-typewriter-revealed]")).toBeNull();
});
it("uses the first Continue action to reveal, then advances on the next action", async () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  render(<Example />);
  const first = screen
    .getByLabelText("Letter text")
    .querySelector(".windowskin-accessible-text")!.textContent;
  await userEvent.click(screen.getByRole("button", { name: "Show all" }));
  expect(screen.getByLabelText("Letter text").textContent).toBe(first);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Letter text").textContent).not.toBe(first);
  expect(screen.getByRole("button", { name: "Show all" })).toBeTruthy();
});
it("overlays a closed scene without reserving space or changing its canvas", async () => {
  const { container } = render(<Example initialOpen={false} />);
  const stage = container.querySelector<HTMLElement>(".game-stage")!;
  expect(stage.style.getPropertyValue("--letter-window-height")).toBe("");
  await userEvent.click(screen.getByRole("button", { name: "Talk" }));
  await screen.findByRole("dialog");
  expect(stage.style.getPropertyValue("--letter-window-height")).toBe("");
  await userEvent.click(screen.getByRole("button", { name: "Close dialogue" }));
  await waitFor(() =>
    expect(stage.style.getPropertyValue("--letter-window-height")).toBe(""),
  );
});
it("anchors the accessible window inside the scene without a viewport backdrop", async () => {
  render(<Example />);
  const dialog = screen.getByRole("dialog");
  expect(dialog.closest(".game-stage")).not.toBeNull();
  expect(document.querySelector(".dialog-overlay")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(dialog));
  fireEvent.keyDown(dialog, { key: "Enter" });
  expect(screen.getByLabelText("Letter text").textContent).toBe(
    pagesFor(longLetter)[1].text,
  );
  fireEvent.keyDown(dialog, { key: "ArrowLeft" });
  expect(screen.getByLabelText("Letter text").textContent).toBe(
    pagesFor(longLetter)[1].text,
  );
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("supports touch buttons through the final page and closes without losing the ending", async () => {
  render(<Example />);
  for (let i = 1; i < pagesFor(longLetter).length; i++)
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Letter text").textContent).toContain(
    "A final little thought. 🌼",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Return to the Park" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("advances when tapping the letter and has no back button or page counter", async () => {
  render(<Example />);
  expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
  expect(document.querySelector(".windowskin-pagination")).toBeNull();
  await userEvent.click(screen.getByLabelText("Letter text"));
  expect(screen.getByLabelText("Letter text").textContent).toBe(
    pagesFor(longLetter)[1].text,
  );
});

it("presents each attachment separately and leaves media controls independent of advancing", async () => {
  const close = vi.fn();
  render(
    <Dialog open>
      <GameDialogueContent>
        <LetterWindow
          name="Sample friend"
          subtitle="Synthetic memories"
          message="Hello Hanna."
          onClose={close}
          returnLabel="Return to the Park"
          attachments={[
            <figure key="photo">
              <a href="/sample-photo">Open sample photo</a>
            </figure>,
            <figure key="audio">
              <audio aria-label="Sample voice" controls preload="none" />
            </figure>,
          ]}
        />
      </GameDialogueContent>
    </Dialog>,
  );
  expect(screen.queryByText("Open sample photo")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "View memories" }));
  expect(screen.getByText("Open sample photo")).toBeTruthy();
  expect(screen.queryByLabelText("Sample voice")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.queryByText("Open sample photo")).toBeNull();
  const voice = screen.getByLabelText("Sample voice");
  fireEvent.click(voice);
  fireEvent.keyDown(voice, { key: " " });
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
  expect(close).toHaveBeenCalledOnce();
});
it("loads recipient media only on the memories page, keeping voice playback user initiated", async () => {
  const id = "11111111-1111-4111-8111-111111111111",
    mediaId = "22222222-2222-4222-8222-222222222222";
  mock.api.mockImplementation(async (path: string) =>
    path.startsWith("recipient/messages/")
      ? {
          id,
          name: "Synthetic friend",
          relationship: "",
          message: "A short private hello.",
          media: [
            {
              id: mediaId,
              kind: "audio",
              description: "A synthetic voice note",
            },
          ],
        }
      : { ok: true },
  );
  const onSeen = vi.fn();
  render(
    <Dialog open>
      <GameDialogueContent>
        <RecipientDialogue
          id={id}
          name="Synthetic friend"
          variant="npc-cream-1"
          onClose={() => {}}
          onSeen={onSeen}
        />
      </GameDialogueContent>
    </Dialog>,
  );
  await screen.findByText("A short private hello.");
  expect(document.querySelector("audio")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "View memories" }));
  const audio = screen.getByLabelText(
    "A synthetic voice note",
  ) as HTMLAudioElement;
  expect(audio.getAttribute("src")).toBe(
    `/api/manage/recipient/media/${mediaId}`,
  );
  expect(audio.preload).toBe("none");
  expect(audio.autoplay).toBe(false);
  await waitFor(() => expect(onSeen).toHaveBeenCalledWith(id));
});
