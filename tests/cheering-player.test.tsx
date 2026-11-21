// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { GameBridge } from "../src/game/bridge";
import type { Cheerer, WorldNpc } from "../src/game/connected";

const mock = vi.hoisted(() => ({
  api: vi.fn(),
  bridge: null as GameBridge | null,
  removed: [] as GameBridge[],
}));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Canvas({ bridge }: { bridge: GameBridge }) {
      React.useEffect(() => {
        mock.bridge = bridge;
        return () => {
          mock.removed.push(bridge);
          if (mock.bridge === bridge) mock.bridge = null;
        };
      }, [bridge]);
      return <div data-testid="cheering-canvas" />;
    },
}));
import { RecipientPlayer } from "../src/components/recipient-player";

const native: WorldNpc = {
  id: "33333333-1111-4111-8111-111111111111",
  name: "SLU friend",
  variant: "npc-cream-1",
  x: 430,
  y: 360,
  radius: 12,
  seen: false,
};
const cheerers: Cheerer[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "House friend",
    variant: "npc-cream-1",
  },
  { id: native.id, name: native.name, variant: native.variant },
];
const initialScene = {
  mapKey: "slu_baguio" as const,
  npcs: [native],
  cheerers,
};
const refresh = () =>
  act(() => document.dispatchEvent(new Event("visibilitychange")));

beforeEach(() => {
  vi.clearAllMocks();
  mock.bridge = null;
  mock.removed = [];
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("passes the initial protected roster to Phaser separately from native dialogue NPCs", () => {
  render(<RecipientPlayer initialScene={initialScene} initialResolved />);
  expect(mock.bridge?.mapKey).toBe("slu_baguio");
  expect(mock.bridge?.cheerers).toEqual(cheerers);
  expect(mock.bridge?.npcs).toEqual([native]);
  expect(mock.api).not.toHaveBeenCalled();
});

it("replaces the bridge when cheering metadata changes or the roster disappears", async () => {
  render(<RecipientPlayer initialScene={initialScene} initialResolved />);
  const first = mock.bridge;
  const firstCanvas = screen.getByTestId("cheering-canvas");
  const updated = [
    { ...cheerers[0], name: "Updated friend", variant: "npc-rose-bow" },
    cheerers[1],
  ];
  mock.api.mockResolvedValue({ ...initialScene, cheerers: updated });
  refresh();
  await waitFor(() => expect(mock.bridge).not.toBe(first));
  const second = mock.bridge;
  expect(second?.cheerers).toEqual(updated);
  expect(screen.getByTestId("cheering-canvas")).not.toBe(firstCanvas);
  expect(mock.removed).toContain(first);

  // An older projection or a completely removed roster must clear the old crowd.
  mock.api.mockResolvedValue({ mapKey: "slu_baguio", npcs: [native] });
  refresh();
  await waitFor(() => expect(mock.bridge).not.toBe(second));
  expect(mock.bridge?.cheerers).toEqual([]);
  expect(mock.bridge?.npcs).toEqual([native]);
  expect(mock.removed).toContain(second);
});

it("destroys the crowd bridge when a recipient authorization refresh fails", async () => {
  render(<RecipientPlayer initialScene={initialScene} initialResolved />);
  const first = mock.bridge;
  expect(first?.cheerers).toHaveLength(2);
  mock.api.mockRejectedValue(new Error("Your visit has ended."));
  refresh();
  await screen.findByText("Your visit has ended.");
  expect(screen.queryByTestId("cheering-canvas")).toBeNull();
  expect(mock.bridge).toBeNull();
  expect(mock.removed).toContain(first);
});
