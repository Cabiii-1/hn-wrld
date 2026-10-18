// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { GameBridge } from "../src/game/bridge";
const mock = vi.hoisted(() => ({
  api: vi.fn(),
  replace: vi.fn(),
  bridge: null as GameBridge | null,
}));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mock.replace }),
}));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Canvas({ bridge }: { bridge: GameBridge }) {
      mock.bridge = bridge;
      return <div data-testid="visitor-canvas" />;
    },
}));
import { ContributorVisitView } from "../src/components/contributor-visit";
import { ContributionArrival } from "../src/components/contribution-arrival";
import type { ContributorVisit } from "../src/game/connected";
const visit: ContributorVisit = {
  mapKey: "slu_baguio",
  visitor: { name: "Synthetic Friend", variant: "npc-brown-scarf" },
  npcs: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Scoped contributor visits", () => {
  it("shows their assigned world with mobile controls and no dialogue or recipient requests", () => {
    render(<ContributorVisitView initialVisit={visit} />);
    expect(
      screen.getByRole("region", { name: "Explore SLU Baguio" }),
    ).toBeTruthy();
    expect(screen.getByText("YOUR PLACE IN HER WORLD")).toBeTruthy();
    expect(screen.getByText("1 little bear cheering Hanna on")).toBeTruthy();
    act(() => mock.bridge!.onStatus("ready"));
    expect(screen.getByRole("button", { name: "Move up" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Talk to/, hidden: true }),
    ).toBeNull();
    mock.bridge!.requestTalk();
    expect(mock.bridge!.interact).toBe(false);
    act(() => mock.bridge!.onTalk("not-a-message-capability"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mock.api).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("link", { name: "Back to my letter" })
        .getAttribute("href"),
    ).toBe("/contribute");
  });
  it("removes the scene if the contributor session is revoked on a tab-return check", async () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    mock.api.mockRejectedValue(
      new Error("Your invitation session is unavailable."),
    );
    render(<ContributorVisitView initialVisit={visit} />);
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(screen.queryByTestId("visitor-canvas")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
    expect(mock.api).toHaveBeenCalledWith("contributor/visit");
  });
  it("animates into the assigned visit after receipt", () => {
    vi.useFakeTimers();
    render(<ContributionArrival />);
    act(() => vi.advanceTimersByTime(899));
    expect(mock.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(mock.replace).toHaveBeenCalledWith("/contribute/visit");
  });
  it("skips the animation delay for reduced motion and cancels navigation on unmount", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    const view = render(<ContributionArrival />);
    act(() => vi.advanceTimersByTime(0));
    expect(mock.replace).toHaveBeenCalledWith("/contribute/visit");
    view.unmount();
    mock.replace.mockClear();
    const cancelled = render(<ContributionArrival />);
    cancelled.unmount();
    act(() => vi.runAllTimers());
    expect(mock.replace).not.toHaveBeenCalled();
  });
});
