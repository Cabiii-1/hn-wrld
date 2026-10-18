// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function CanvasStub() {
      return <div data-testid="game" />;
    },
}));
import { DemoWorld } from "../src/components/demo-world";
import { RecipientPlayer } from "../src/components/recipient-player";
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("M4 navigation and protected scene loading", () => {
  it("keeps the prepared world mounted during a tab-return check, then removes it if access is denied", async () => {
    let reject!: (error: Error) => void;
    mock.api.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    render(
      <RecipientPlayer
        initialScene={{ mapKey: "sta_ana_house", npcs: [] }}
        initialResolved
      />,
    );
    const canvas = screen.getByTestId("game");
    expect(mock.api).not.toHaveBeenCalled();
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(mock.api).toHaveBeenCalledWith("recipient/scenes/sta_ana_house");
    expect(screen.getByTestId("game")).toBe(canvas);
    await act(async () => reject(new Error("Your visit has ended.")));
    await screen.findByText("Your visit has ended.");
    expect(screen.queryByTestId("game")).toBeNull();
  });
  it("visits all sample maps with 50 bears without fetching private data", async () => {
    render(<DemoWorld />);
    await userEvent.selectOptions(
      screen.getByLabelText("Sample bear count"),
      "50",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Visit Tuguegarao Plaza" }),
    );
    expect(
      screen.getByRole("region", { name: "Explore Tuguegarao Plaza" }),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Visit SLU Baguio" }),
    );
    expect(
      screen.getByRole("region", { name: "Explore SLU Baguio" }),
    ).toBeTruthy();
    expect(screen.getAllByTestId("game")).toHaveLength(1);
    expect(mock.api).not.toHaveBeenCalled();
  });
  it("loads only the selected protected scene and persists the session through navigation", async () => {
    mock.api.mockImplementation(async (path: string) => ({
      mapKey: path.split("/").at(-1),
      npcs: [],
    }));
    render(<RecipientPlayer />);
    await screen.findByRole("region", { name: "Explore Sta. Ana House" });
    await userEvent.click(
      screen.getByRole("button", { name: "Visit Tuguegarao Plaza" }),
    );
    await screen.findByRole("region", { name: "Explore Tuguegarao Plaza" });
    await userEvent.click(
      screen.getByRole("button", { name: "Visit SLU Baguio" }),
    );
    await screen.findByRole("region", { name: "Explore SLU Baguio" });
    expect(mock.api.mock.calls.map((c) => c[0])).toEqual([
      "recipient/scenes/sta_ana_house",
      "recipient/scenes/tuguegarao_park",
      "recipient/scenes/slu_baguio",
    ]);
    expect(screen.getAllByTestId("game")).toHaveLength(1);
  });
  it("clears the scene on denied access and provides a retry without exposing actors", async () => {
    mock.api.mockRejectedValue(new Error("Your visit has ended."));
    render(<RecipientPlayer />);
    await screen.findByText("Your visit has ended.");
    expect(screen.queryByTestId("game")).toBeNull();
    mock.api.mockResolvedValue({ mapKey: "sta_ana_house", npcs: [] });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getAllByTestId("game")).toHaveLength(1));
  });
});
