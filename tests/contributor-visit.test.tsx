// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
        .getByRole("link", { name: "Edit your message" })
        .getAttribute("href"),
    ).toBe("/contribute?edit=1");
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

it("opens only opted-in letters, pauses the world, never requests recipient media, and clears withdrawn text", async () => {
  const id = "11111111-1111-4111-8111-111111111111",
    privateId = "22222222-2222-4222-8222-222222222222";
  const data = {
    ...visit,
    npcs: [
      {
        id,
        name: "Sharing Friend",
        variant: "npc-cream-1" as const,
        x: 430,
        y: 360,
        radius: 12,
        seen: false,
        readable: true,
      },
      {
        id: privateId,
        name: "Private Friend",
        variant: "npc-cream-1" as const,
        x: 410,
        y: 360,
        radius: 12,
        seen: false,
        readable: false,
      },
    ],
  };
  mock.api.mockResolvedValue({
    id,
    name: "Sharing Friend",
    message: "Synthetic shared words",
  });
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  render(<ContributorVisitView initialVisit={data} />);
  expect(
    screen.queryByRole("button", {
      name: "Read Private Friend’s shared letter",
    }),
  ).toBeNull();
  act(() => mock.bridge!.onTalk(id));
  await screen.findByText("Synthetic shared words");
  expect(mock.bridge!.paused).toBe(true);
  expect(mock.api).toHaveBeenCalledWith("contributor/letters/" + id);
  expect(
    mock.api.mock.calls.every(([path]) => !path.startsWith("recipient/")),
  ).toBe(true);
  mock.api.mockImplementation(async (path: string) => {
    if (path === "contributor/visit") return data;
    throw Error("No longer shared");
  });
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  await waitFor(() =>
    expect(screen.queryByText("Synthetic shared words")).toBeNull(),
  );
  expect(screen.getByRole("alert").textContent).toContain("no longer shared");
  fireEvent.click(screen.getByRole("button", { name: "Close dialogue" }));
  expect(mock.bridge!.paused).toBe(false);
});

it("uses the same nearby Talk interaction for invited players while blocking private and forged bear IDs", async () => {
  const id = "11111111-1111-4111-8111-111111111111",
    privateId = "22222222-2222-4222-8222-222222222222";
  const data = {
    ...visit,
    npcs: [
      {
        id,
        name: "Sharing Friend",
        variant: "npc-cream-1" as const,
        x: 430,
        y: 360,
        radius: 12,
        seen: false,
        readable: true,
      },
      {
        id: privateId,
        name: "Private Friend",
        variant: "npc-cream-1" as const,
        x: 410,
        y: 360,
        radius: 12,
        seen: false,
        readable: false,
      },
    ],
  };
  mock.api.mockResolvedValue({
    id,
    name: "Sharing Friend",
    message: "Synthetic in-world letter",
  });
  render(<ContributorVisitView initialVisit={data} />);
  act(() => mock.bridge!.onStatus("ready"));
  act(() => {
    mock.bridge!.setNear(true, privateId);
    mock.bridge!.requestTalk();
    mock.bridge!.onTalk(privateId);
  });
  expect(mock.bridge!.near).toBe(false);
  expect(mock.bridge!.interact).toBe(false);
  expect(mock.api).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => mock.bridge!.setNear(true, id));
  fireEvent.click(
    screen.getByRole("button", { name: "Talk to Sharing Friend" }),
  );
  expect(mock.bridge!.interact).toBe(true);
  act(() => mock.bridge!.onTalk(id));
  await screen.findByText("Synthetic in-world letter");
  expect(mock.bridge!.paused).toBe(true);
  expect(mock.api).toHaveBeenCalledWith("contributor/letters/" + id);
  expect(
    mock.api.mock.calls.every(([path]) => !path.startsWith("recipient/")),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close dialogue" }));
  expect(mock.bridge!.paused).toBe(false);
});
