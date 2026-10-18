// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MAX } from "../src/lib/backend/contracts";
const mock = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn() }));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mock.replace }),
}));
import { ContributionEntry } from "../src/components/contribution-entry";
const fresh = {
  displayName: "Synthetic Friend",
  submitted: false,
  uploads: [],
  limits: MAX,
};
beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState(null, "", "/contribute");
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("opens the form inline, strips secrets and redeems only once in StrictMode", async () => {
  const token = "a".repeat(43);
  history.replaceState(null, "", "/contribute#" + token);
  mock.api.mockImplementation(async (path: string) =>
    path === "contributor" ? fresh : { ok: true },
  );
  render(
    <React.StrictMode>
      <ContributionEntry configured />
    </React.StrictMode>,
  );
  await screen.findByRole("heading", { name: "Hello, Synthetic Friend!" });
  expect(location.hash).toBe("");
  expect(location.pathname).toBe("/contribute");
  expect(
    mock.api.mock.calls.filter(([p]) => p === "invitations/exchange"),
  ).toHaveLength(1);
  expect(mock.api).toHaveBeenCalledWith("invitations/exchange", "POST", {
    token,
  });
  expect(mock.replace).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
it("opens old invitation URLs in the same form without a welcome screen", async () => {
  history.replaceState(null, "", "/invite#" + "b".repeat(43));
  mock.api.mockImplementation(async (p: string) =>
    p === "contributor" ? fresh : { ok: true },
  );
  render(<ContributionEntry configured />);
  await screen.findByRole("heading", { name: "Hello, Synthetic Friend!" });
  expect(location.pathname).toBe("/contribute");
  expect(screen.queryByText("Opening your invitation…")).toBeNull();
  expect(mock.replace).not.toHaveBeenCalled();
});
it("opens a checked saved letter directly in the full editor without another request", async () => {
  render(
    <ContributionEntry
      configured
      initialSnapshot={{
        ...fresh,
        submitted: true,
        letter: {
          message: "Saved synthetic words",
          version: "2026-10-18T00:00:00Z",
          shareWithInvitees: true,
          media: [],
        },
      }}
    />,
  );
  expect(
    (await screen.findByLabelText(
      /Your message for Hanna/,
    )) as HTMLTextAreaElement,
  ).toHaveProperty("value", "Saved synthetic words");
  expect(screen.getByRole("button", { name: "Save my changes" })).toBeTruthy();
  expect(mock.api).not.toHaveBeenCalled();
});
it("honors a fresh fragment instead of showing a different checked invitation", async () => {
  history.replaceState(null, "", "/contribute#" + "c".repeat(43));
  mock.api.mockImplementation(async (p: string) =>
    p === "contributor"
      ? { ...fresh, displayName: "New Friend" }
      : { ok: true },
  );
  render(<ContributionEntry configured initialSnapshot={fresh} />);
  expect(screen.queryByText("Hello, Synthetic Friend!")).toBeNull();
  await screen.findByRole("heading", { name: "Hello, New Friend!" });
});
it("keeps a failed token in memory for an explicit retry", async () => {
  const token = "d".repeat(43);
  history.replaceState(null, "", "/contribute#" + token);
  mock.api
    .mockRejectedValueOnce(Error("Connection lost"))
    .mockImplementation(async (p: string) =>
      p === "contributor" ? fresh : { ok: true },
    );
  render(<ContributionEntry configured />);
  await screen.findByText("Connection lost");
  expect(location.hash).toBe("");
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Hello, Synthetic Friend!" });
  expect(
    mock.api.mock.calls.filter(([p]) => p === "invitations/exchange"),
  ).toHaveLength(2);
});
it("rejects malformed links without exchange and accepts a later valid fragment", async () => {
  history.replaceState(null, "", "/contribute#bad");
  mock.api.mockImplementation(async (p: string) =>
    p === "contributor" ? fresh : { ok: true },
  );
  render(<ContributionEntry configured />);
  await screen.findByText("Open the complete invitation link Cj sent you.");
  expect(mock.api).not.toHaveBeenCalled();
  await act(async () => {
    history.replaceState(null, "", "/contribute#" + "e".repeat(43));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Hello, Synthetic Friend!" }),
    ).toBeTruthy(),
  );
});

it("serializes link changes so an older response cannot restore the wrong form or cookie", async () => {
  let finish!: () => void;
  let current = "Old Friend";
  const first = "f".repeat(43),
    second = "g".repeat(43);
  mock.api.mockImplementation(
    async (path: string, _method: string, body?: { token: string }) => {
      if (path === "invitations/exchange") {
        if (body?.token === first)
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
        current = body?.token === first ? "Old Friend" : "New Friend";
        return { ok: true };
      }
      return { ...fresh, displayName: current };
    },
  );
  history.replaceState(null, "", "/contribute#" + first);
  render(<ContributionEntry configured />);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  await act(async () => {
    history.replaceState(null, "", "/contribute#" + second);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    finish();
  });
  await screen.findByRole("heading", { name: "Hello, New Friend!" });
  expect(
    screen.queryByRole("heading", { name: "Hello, Old Friend!" }),
  ).toBeNull();
  expect(
    mock.api.mock.calls.filter(([p]) => p === "invitations/exchange"),
  ).toHaveLength(2);
});
