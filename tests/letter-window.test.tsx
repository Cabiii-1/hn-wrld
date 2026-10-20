// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
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
  letterPages,
} from "../src/components/letter-window";
import { RecipientDialogue } from "../src/components/recipient-dialogue";
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
it("preserves long Unicode letters and paragraph breaks across bounded pages", () => {
  const source = "Hello 🌼\n\n" + "🧸".repeat(600) + "\n\nThe final thought.";
  const pages = letterPages(source);
  expect(pages.every((p) => Array.from(p).length <= 280)).toBe(true);
  expect(pages.join("").replace(/\s/gu, "")).toBe(source.replace(/\s/gu, ""));
  expect(pages[0]).toContain("Hello 🌼\n\n");
  expect(pages.at(-1)).toContain("The final thought.");
});
it("reserves the window height when a closed scene is opened and restores it on close", async () => {
  const { container } = render(<Example initialOpen={false} />);
  const stage = container.querySelector<HTMLElement>(".game-stage")!;
  expect(stage.style.getPropertyValue("--letter-window-height")).toBe("");
  await userEvent.click(screen.getByRole("button", { name: "Talk" }));
  await screen.findByRole("dialog");
  expect(stage.style.getPropertyValue("--letter-window-height")).not.toBe("");
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
    letterPages(longLetter)[1],
  );
  fireEvent.keyDown(dialog, { key: "ArrowLeft" });
  expect(screen.getByLabelText("Letter text").textContent).toBe(
    letterPages(longLetter)[0],
  );
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("supports touch buttons through the final page and closes without losing the ending", async () => {
  render(<Example />);
  for (let i = 1; i < letterPages(longLetter).length; i++)
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Letter text").textContent).toContain(
    "A final little thought. 🌼",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Return to the Park" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
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
