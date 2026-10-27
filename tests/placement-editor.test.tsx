// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlacementEditor } from "../src/components/placement-editor";
import { PlacementForm } from "../src/components/admin-desk";
import type { AdminData } from "../src/lib/backend/contracts";
import { SCENE_KEYS, SCENES } from "../src/game/scenes";

beforeEach(() => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(
      type: string,
      init: MouseEventInit & { pointerId?: number } = {},
    ) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  SVGElement.prototype.setPointerCapture = vi.fn();
  SVGElement.prototype.hasPointerCapture = vi.fn(() => true);
  SVGElement.prototype.releasePointerCapture = vi.fn();
  vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 10,
    top: 20,
    width: 418,
    height: 235,
  } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function Editor({ disabled = false }: { disabled?: boolean }) {
  const [point, setPoint] = useState({ x: 470, y: 290, radius: 20 });
  return (
    <PlacementEditor
      map="tuguegarao_park"
      point={point}
      onChange={setPoint}
      variant="npc-brown-scarf"
      name="Sample friend"
      disabled={disabled}
    />
  );
}
const pointer = (x: number, y: number) => ({
  clientX: 10 + x / 2,
  clientY: 20 + y / 2,
  button: 0,
});
it("maps scaled pointer drags into world coordinates and keeps the grab offset", () => {
  render(<Editor />);
  const map = screen.getByLabelText("Place Sample friend in Park");
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Move Sample friend" }),
    pointer(470, 280),
  );
  fireEvent.pointerMove(map, pointer(500, 300));
  fireEvent.pointerUp(map, pointer(500, 300));
  expect(screen.getByText(/Foot position:/).textContent).toContain("500, 310");
});
it("resizes without jumping on grab, including a zero-radius bear", () => {
  render(<Editor />);
  const handle = screen.getByRole("slider", { name: "Resize wander area" });
  const map = screen.getByLabelText("Place Sample friend in Park");
  fireEvent.change(screen.getByLabelText(/Wander distance/), {
    target: { value: "0" },
  });
  fireEvent.pointerDown(handle, pointer(522, 290));
  expect(handle.getAttribute("aria-valuenow")).toBe("0");
  fireEvent.pointerMove(map, pointer(532, 290));
  fireEvent.pointerUp(map, pointer(532, 290));
  expect(handle.getAttribute("aria-valuenow")).toBe("10");
});
it("reverts a canceled touch drag and ignores a second pointer", () => {
  render(<Editor />);
  const map = screen.getByLabelText("Place Sample friend in Park");
  fireEvent.pointerDown(map, pointer(520, 300));
  fireEvent.pointerUp(map, { ...pointer(600, 300), pointerId: 2 });
  fireEvent.pointerMove(map, pointer(550, 300));
  fireEvent.pointerCancel(map);
  expect(screen.getByText(/Foot position:/).textContent).toContain("470, 290");
});
it("supports keyboard and phone nudge controls while respecting disabled state", () => {
  const { rerender } = render(<Editor />);
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Move Sample friend" }),
    { key: "ArrowRight", shiftKey: true },
  );
  fireEvent.click(screen.getByRole("button", { name: "Move bear down" }));
  expect(screen.getByText(/Foot position:/).textContent).toContain("480, 291");
  rerender(<Editor disabled />);
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Move Sample friend" }),
    { key: "ArrowRight" },
  );
  fireEvent.pointerDown(
    screen.getByLabelText("Place Sample friend in Park"),
    pointer(600, 300),
  );
  expect(screen.getByText(/Foot position:/).textContent).toContain("480, 291");
});
it("lets zoomed scenery pan without moving the bear and still allows dragging the bear", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Zoom map" }));
  const map = screen.getByLabelText("Place Sample friend in Park");
  fireEvent.pointerDown(map, pointer(600, 300));
  fireEvent.pointerUp(map, pointer(600, 300));
  expect(screen.getByText(/Foot position:/).textContent).toContain("470, 290");
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Move Sample friend" }),
    pointer(470, 290),
  );
  fireEvent.pointerMove(map, pointer(500, 300));
  fireEvent.pointerUp(map, pointer(500, 300));
  expect(screen.getByText(/Foot position:/).textContent).toContain("500, 300");
});
const contribution = {
  id: "sample",
  invitation_id: "invite",
  display_name: "Sample friend",
  relationship_label: null,
  message_text: "Synthetic hello",
  status: "approved",
  created_at: "2026-10-27",
};
const data: AdminData = {
  contributions: [contribution],
  invitations: [
    {
      id: "invite",
      label: "Sample friend",
      assigned_map: "tuguegarao_park",
      expires_at: null,
      revoked_at: null,
      created_at: "2026-10-27",
    },
  ],
  media: [],
  placements: [],
  areas: SCENE_KEYS.map((map) => ({
    id: map,
    map_key: map,
    name: SCENES[map].name,
    published: true,
  })),
};
it("blocks unsafe saves and sends exactly the visual draft when explicitly saved", () => {
  const action = vi.fn();
  render(
    <PlacementForm
      contribution={contribution}
      data={data}
      action={action}
      busy={false}
    />,
  );
  const map = screen.getByLabelText("Place Sample friend in Park");
  fireEvent.pointerDown(map, pointer(410, 210));
  fireEvent.pointerUp(map, pointer(410, 210));
  const save = screen.getByRole("button", { name: "Save their place" });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(save.closest("form")!);
  expect(action).not.toHaveBeenCalled();
  fireEvent.pointerDown(map, pointer(520, 300));
  fireEvent.pointerUp(map, pointer(520, 300));
  expect((save as HTMLButtonElement).disabled).toBe(false);
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(save);
  expect(action).toHaveBeenCalledWith("admin/placements", "POST", {
    contributionId: "sample",
    areaId: "tuguegarao_park",
    variant: "npc-brown-scarf",
    x: 520,
    y: 300,
    radius: 20,
    published: false,
  });
});
it("switches backgrounds, neighbors and validation to the newly selected scene", () => {
  render(
    <PlacementForm
      contribution={contribution}
      data={data}
      action={vi.fn()}
      busy={false}
    />,
  );
  fireEvent.change(screen.getByLabelText("Scene"), {
    target: { value: "slu_baguio" },
  });
  expect(
    screen.getByLabelText("Place Sample friend in SLU Baguio"),
  ).toBeTruthy();
  expect(screen.getByText(/Foot position:/).textContent).toContain("430, 360");
  expect(
    (
      screen.getByRole("button", {
        name: "Save their place",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
