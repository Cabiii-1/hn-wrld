// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ParkAudio } from "../src/components/park-audio";

let playing = false;
beforeEach(() => {
  playing = false;
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(
    () => !playing,
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
    async function (this: HTMLMediaElement) {
      playing = true;
      this.dispatchEvent(new Event("playing"));
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    playing = false;
    this.dispatchEvent(new Event("pause"));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("starts the supplied looping track quietly with a compact player", () => {
  const { container } = render(<ParkAudio paused={false} />);
  const audio = container.querySelector("audio")!;
  expect(audio.getAttribute("src")).toBe("/game/audio/park-adults-v1.mp3");
  expect(audio.loop).toBe(true);
  expect(audio.controls).toBe(false);
  expect(audio.hidden).toBe(true);
  expect(audio.volume).toBe(0.22);
  expect(audio.play).toHaveBeenCalledOnce();
  expect(screen.getByText("Haikyuu!! OST - Adults")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pause Park music" })).toBeTruthy();
  expect(
    container.querySelector(".park-music-player")?.getAttribute("data-playing"),
  ).toBe("true");
});

it("keeps an explicit pause through game input, tab return and external pauses", () => {
  const { container, rerender } = render(<ParkAudio paused={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Pause Park music" }));
  expect(playing).toBe(false);
  expect(
    container.querySelector(".park-music-player")?.getAttribute("data-playing"),
  ).toBe("false");
  act(() => {
    window.dispatchEvent(new Event("pointerup"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  rerender(<ParkAudio paused />);
  rerender(<ParkAudio paused={false} />);
  expect(playing).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Play Park music" }));
  expect(playing).toBe(true);
});

it("stops the vinyl while buffering and resumes it on actual playback", () => {
  const { container } = render(<ParkAudio paused={false} />);
  const audio = container.querySelector("audio")!;
  fireEvent.waiting(audio);
  expect(
    container.querySelector(".park-music-player")?.getAttribute("data-playing"),
  ).toBe("false");
  fireEvent.playing(audio);
  expect(
    container.querySelector(".park-music-player")?.getAttribute("data-playing"),
  ).toBe("true");
});

it("allows the first explicit play click after autoplay denial", async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
    new DOMException("Gesture required", "NotAllowedError"),
  );
  render(<ParkAudio paused={false} />);
  await act(async () => {});
  const button = screen.getByRole("button", { name: "Play Park music" });
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(playing).toBe(true);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
});

it("recovers from autoplay rejection on either touch or keyboard input", async () => {
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
    new DOMException("Gesture required", "NotAllowedError"),
  );
  const { unmount } = render(<ParkAudio paused={false} />);
  await act(async () => {});
  expect(playing).toBe(false);
  await act(async () => {
    window.dispatchEvent(new Event("touchend"));
  });
  expect(playing).toBe(true);
  unmount();
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
    new DOMException("Gesture required", "NotAllowedError"),
  );
  render(<ParkAudio paused={false} />);
  await act(async () => {});
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  });
  expect(playing).toBe(true);
});

it("preserves the position through dialogue pauses and tab switches", async () => {
  const { container, rerender } = render(<ParkAudio paused={false} />);
  const audio = container.querySelector("audio")!;
  audio.currentTime = 12;
  rerender(<ParkAudio paused />);
  expect(playing).toBe(false);
  await act(async () => {
    window.dispatchEvent(new Event("pointerup"));
  });
  expect(playing).toBe(false);
  rerender(<ParkAudio paused={false} />);
  expect(playing).toBe(true);
  expect(audio.currentTime).toBe(12);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(playing).toBe(false);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(playing).toBe(true);
});

it("stops and removes gesture retries when leaving Park", async () => {
  const { unmount } = render(<ParkAudio paused={false} />);
  unmount();
  expect(playing).toBe(false);
  vi.mocked(HTMLMediaElement.prototype.play).mockClear();
  await act(async () => {
    window.dispatchEvent(new Event("pointerup"));
  });
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});
