// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ParkAudio } from "../src/components/park-audio";

let playing = false;
beforeEach(() => {
  playing = false;
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(
    () => !playing,
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {
    playing = true;
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {
    playing = false;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("starts the supplied looping track quietly without visible controls", () => {
  const { container } = render(<ParkAudio paused={false} />);
  const audio = container.querySelector("audio")!;
  expect(audio.getAttribute("src")).toBe("/game/audio/park-adults-v1.mp3");
  expect(audio.loop).toBe(true);
  expect(audio.controls).toBe(false);
  expect(audio.hidden).toBe(true);
  expect(audio.volume).toBe(0.22);
  expect(audio.play).toHaveBeenCalledOnce();
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
