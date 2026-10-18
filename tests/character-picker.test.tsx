// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContributionForm } from "../src/components/contribution-form";
import { MAX, type ContributorSnapshot } from "../src/lib/backend/contracts";
const mock = vi.hoisted(() => ({ api: vi.fn() }));
// jsdom lacks CSS.escape, which user-event needs for this ASCII radio-group name.
beforeEach(() =>
  vi.stubGlobal("CSS", {
    escape: (name: string) => name.replace(/["\\]/g, "\\$&"),
  }),
);
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
const saved: ContributorSnapshot = {
  displayName: "Synthetic friend",
  submitted: true,
  uploads: [],
  limits: MAX,
  letter: {
    message: "A saved hello",
    version: "2026-10-19T00:00:00Z",
    media: [],
    characterKey: null,
    legacyVariant: "npc-rose-bow",
  },
};

it("preserves legacy appearance on unrelated edits and saves an explicit animal choice without dropping a failed draft", async () => {
  mock.api.mockImplementation(async (path: string) => {
    if (path === "contributor") return saved;
    throw new Error("Synthetic offline");
  });
  render(
    <ContributionForm
      configured
      initialResolved
      initialSnapshot={saved}
      directEntry
    />,
  );
  expect(
    (
      screen.getByRole("radio", {
        name: "Bear",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(
    screen
      .getByRole("img", { name: "Your character: Bear" })
      .getAttribute("style"),
  ).toContain("npc-rose-bow");
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(
    screen.getByRole("button", { name: "Save my changes" }),
  );
  await screen.findByText("Synthetic offline");
  const legacyPayload = mock.api.mock.calls.find(
    ([path]) => path === "contributions",
  )?.[2];
  expect(legacyPayload).not.toHaveProperty("characterKey");
  await userEvent.click(screen.getByRole("radio", { name: "Bee" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Save my changes" }),
  );
  expect(mock.api).toHaveBeenLastCalledWith(
    "contributions",
    "PATCH",
    expect.objectContaining({
      characterKey: "bee",
      retainedMedia: [],
      shareWithInvitees: false,
      consent: true,
    }),
  );
  expect(
    (
      screen.getByRole("radio", {
        name: "Bee",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Edit my letter" }),
  );
  expect(
    (
      screen.getByRole("radio", {
        name: "Bear",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  await userEvent.click(screen.getByRole("radio", { name: "Bear" }));
  expect(
    screen
      .getByRole("img", { name: "Your character: Bear" })
      .getAttribute("style"),
  ).toContain("bear-v1");
});

it("loads a saved animal and supports keyboard selection with six named radio options", async () => {
  render(
    <ContributionForm
      configured
      initialResolved
      directEntry
      initialSnapshot={{
        ...saved,
        letter: { ...saved.letter!, characterKey: "capybara" },
      }}
    />,
  );
  expect(
    screen.getAllByRole("radio", {
      name: /^(Bear|Turtle|Capybara|Frog|Cat|Bee)$/,
    }),
  ).toHaveLength(6);
  const capy = screen.getByRole("radio", { name: "Capybara" });
  expect((capy as HTMLInputElement).checked).toBe(true);
  await userEvent.click(capy);
  await userEvent.keyboard("{ArrowRight}");
  await waitFor(() =>
    expect(
      (
        screen.getByRole("radio", {
          name: "Frog",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true),
  );
  expect(
    screen.getByRole("img", { name: "Your character: Frog" }),
  ).toBeTruthy();
});
