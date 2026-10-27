// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LetterPhoto, LetterVoice } from "../src/components/letter-media";
import { LetterWindow } from "../src/components/letter-window";
import { GameDialogueContent } from "../src/components/letter-window";
import { Dialog } from "../src/components/ui/dialog";
afterEach(cleanup);
it("shows an envelope instead of empty text and does not advance during letter loading", () => {
  const close = vi.fn();
  const { container } = render(
    <Dialog open>
      <GameDialogueContent>
        <LetterWindow
          name="Sample friend"
          subtitle="Synthetic hello"
          message=""
          loading
          onClose={close}
          returnLabel="Return to Park"
        />
      </GameDialogueContent>
    </Dialog>,
  );
  expect(screen.getByRole("status").textContent).toBe("Opening their letter…");
  expect(container.querySelector(".loader-envelope-paper")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Return to Park" })).toBeNull();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
  fireEvent.click(screen.getByLabelText("Letter text"));
  expect(close).not.toHaveBeenCalled();
});
it("replaces the photo placeholder on load and stops it on failure", () => {
  const { container, rerender } = render(
    <LetterPhoto id="photo" description="Synthetic photo" />,
  );
  expect(screen.getByRole("status").textContent).toBe("Loading photo…");
  const image = screen.getByAltText("Synthetic photo");
  fireEvent.load(image);
  expect(screen.queryByRole("status")).toBeNull();
  expect(image.className).toBe("");
  expect(screen.getByRole("link").getAttribute("aria-busy")).toBe("false");
  rerender(<LetterPhoto key="new" id="failed" description="Synthetic photo" />);
  fireEvent.error(screen.getByAltText("Synthetic photo"));
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("couldn’t load");
  expect(container.querySelector("img")).toBeNull();
});
it("shows voice loading on metadata fetch, buffering and seeking without autoplay", () => {
  render(<LetterVoice id="voice" description="Synthetic voice" />);
  const audio = screen.getByLabelText("Synthetic voice") as HTMLAudioElement;
  expect(audio.autoplay).toBe(false);
  expect(audio.preload).toBe("metadata");
  expect(screen.getByRole("status").textContent).toBe("Loading voice note…");
  fireEvent.loadedMetadata(audio);
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.waiting(audio);
  expect(screen.getByRole("status")).toBeTruthy();
  fireEvent.playing(audio);
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.seeking(audio);
  expect(screen.getByRole("status")).toBeTruthy();
  fireEvent.seeked(audio);
  expect(screen.queryByRole("status")).toBeNull();
});
it("replaces a failed voice loader with an error and allows an explicit retry", () => {
  render(<LetterVoice id="voice" description="Synthetic voice" />);
  const audio = screen.getByLabelText("Synthetic voice");
  fireEvent.error(audio);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("couldn’t load");
  fireEvent.click(screen.getByRole("button", { name: "Try voice note again" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.getByLabelText("Synthetic voice")).not.toBe(audio);
});
