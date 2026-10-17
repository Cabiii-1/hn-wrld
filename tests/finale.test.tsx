// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
vi.mock("next/dynamic", () => ({
  default: () =>
    function ReunionStub({ still }: { still: boolean }) {
      return (
        <div data-testid="reunion">
          {still ? "Still reunion" : "Animated reunion"}
        </div>
      );
    },
}));
import { FinaleExperience } from "../src/components/finale-experience";
import { FinaleGateway } from "../src/components/finale-gateway";
import { FinaleEditor } from "../src/components/finale-editor";
import {
  SAMPLE_FINALE,
  finaleContentSchema,
  finaleDraftSchema,
} from "../src/game/finale";
beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(cleanup);
describe("M5 finale sequence and privacy", () => {
  it("supports letter, skipped reunion, conversation, save retry and replay without timers", async () => {
    const complete = vi
        .fn()
        .mockRejectedValueOnce(new Error("Visit ended"))
        .mockResolvedValueOnce(undefined),
      exit = vi.fn();
    render(
      <FinaleExperience
        ending={SAMPLE_FINALE}
        onExit={exit}
        onComplete={complete}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Skip letter" }));
    expect(screen.getByTestId("reunion").textContent).toContain("Animated");
    await userEvent.click(
      screen.getByRole("button", { name: "Skip animation" }),
    );
    for (let i = 1; i < SAMPLE_FINALE.content.conversation.length; i++)
      await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Keep this little moment" }),
    );
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Visit ended",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Keep this little moment" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Read it again" }),
    );
    expect(
      screen.getByRole("heading", { name: SAMPLE_FINALE.content.title }),
    ).toBeTruthy();
    expect(complete).toHaveBeenCalledTimes(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Back to the world" }),
    );
    expect(exit).toHaveBeenCalledOnce();
  });
  it("uses still storytelling for device reduced motion", async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<FinaleExperience ending={SAMPLE_FINALE} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Meet Dudu" }));
    expect(screen.getByTestId("reunion").textContent).toContain("Still");
    expect(screen.getByRole("checkbox").hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText(/side by side beneath a little heart/),
    ).toBeTruthy();
  });
  it("does not fetch private content for a locked ending", async () => {
    mock.api.mockResolvedValue({
      available: true,
      unlocked: false,
      seen: 0,
      required: 2,
      completed: false,
    });
    render(
      <FinaleGateway>
        <p>World</p>
      </FinaleGateway>,
    );
    await screen.findByText(/0 \/ 2/);
    expect(
      screen
        .getByRole("button", { name: "Open Dudu’s letter" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(mock.api.mock.calls.map((c) => c[0])).toEqual([
      "recipient/ending/status",
    ]);
    expect(screen.queryByText(SAMPLE_FINALE.content.letter)).toBeNull();
  });
  it("unmounts the world while the ending is open and authorizes completion", async () => {
    mock.api.mockImplementation(async (path: string) =>
      path.endsWith("status")
        ? {
            available: true,
            unlocked: true,
            seen: 1,
            required: 1,
            completed: false,
          }
        : SAMPLE_FINALE,
    );
    render(
      <FinaleGateway>
        <p>World canvas</p>
      </FinaleGateway>,
    );
    await screen.findByText("A little letter from Dudu is waiting.");
    await userEvent.click(
      screen.getByRole("button", { name: "Open Dudu’s letter" }),
    );
    await screen.findByRole("heading", { name: SAMPLE_FINALE.content.title });
    expect(screen.queryByText("World canvas")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Back to the world" }),
    );
    expect(screen.getByText("World canvas")).toBeTruthy();
  });
  it("keeps the synthetic demo independent of private APIs", async () => {
    render(
      <FinaleGateway sample>
        <p>Sample world</p>
      </FinaleGateway>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Try sample ending" }),
    );
    expect(
      screen.getByRole("heading", { name: SAMPLE_FINALE.content.title }),
    ).toBeTruthy();
    expect(mock.api).not.toHaveBeenCalled();
  });
  it("saves a private draft separately from publication", async () => {
    mock.api.mockResolvedValue({
      revision: 2,
      draft: { ...SAMPLE_FINALE.content, letter: "" },
      published: true,
    });
    render(<FinaleEditor />);
    const letter = await screen.findByLabelText("Your letter");
    await userEvent.type(letter, "Synthetic private letter");
    await userEvent.click(
      screen.getByRole("button", { name: "Save private draft" }),
    );
    await screen.findByText(
      "Draft saved. The published version was kept as it was.",
    );
    expect(mock.api).toHaveBeenCalledWith(
      "admin/finale",
      "POST",
      expect.objectContaining({
        action: "save",
        revision: 2,
        content: expect.objectContaining({
          letter: "Synthetic private letter",
        }),
      }),
    );
  });
  it("requires complete authored content for publication", () => {
    const blank = {
      title: "Draft",
      letter: "",
      threshold: 3,
      conversation: [],
    };
    expect(finaleDraftSchema.safeParse(blank).success).toBe(true);
    expect(finaleContentSchema.safeParse(blank).success).toBe(false);
    expect(
      finaleContentSchema.safeParse({ ...SAMPLE_FINALE.content, threshold: 51 })
        .success,
    ).toBe(false);
    expect(
      finaleContentSchema.safeParse({
        ...SAMPLE_FINALE.content,
        conversation: [{ speaker: "Unknown", text: "x" }],
      }).success,
    ).toBe(false);
  });
});
