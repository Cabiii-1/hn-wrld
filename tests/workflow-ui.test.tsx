// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mock = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn() }));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mock.replace }),
}));
import { ContributionForm } from "../src/components/contribution-form";
import { AdminDesk } from "../src/components/admin-desk";
import { InviteWelcome } from "../src/components/invite-welcome";
import { MAX, type AdminData } from "../src/lib/backend/contracts";

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("contributor and admin UI workflows", () => {
  it("disables submission when the backend has not been configured", () => {
    render(<ContributionForm configured={false} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Send my little hello",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mock.api).not.toHaveBeenCalled();
  });
  it("exchanges a fragment token and removes it from the URL", async () => {
    const token = "a".repeat(43);
    window.history.replaceState(null, "", `/invite#${token}`);
    mock.api.mockResolvedValue({ ok: true });
    render(<InviteWelcome configured />);
    await userEvent.click(
      screen.getByRole("button", { name: "Open my invitation" }),
    );
    expect(mock.api).toHaveBeenCalledWith("invitations/exchange", "POST", {
      token,
    });
    expect(location.hash).toBe("");
    expect(mock.replace).toHaveBeenCalledWith("/contribute");
  });
  it("requires consent, submits once, and shows receipt without publication claims", async () => {
    let submitted = false;
    mock.api.mockImplementation(async (path: string) => {
      if (path === "contributions") {
        submitted = true;
        return { received: true };
      }
      return { submitted, uploads: [], limits: MAX };
    });
    render(<ContributionForm configured />);
    const name = await screen.findByLabelText(/Your name/);
    await waitFor(() =>
      expect((name as HTMLInputElement).disabled).toBe(false),
    );
    await userEvent.type(name, "Synthetic Friend");
    await userEvent.type(
      screen.getByLabelText(/Your message/),
      "A synthetic little hello.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Send my little hello" }),
    );
    expect(mock.api.mock.calls.some(([p]) => p === "contributions")).toBe(
      false,
    );
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(
      screen.getByRole("button", { name: "Send my little hello" }),
    );
    await screen.findByText("SAFELY RECEIVED");
    expect(mock.api).toHaveBeenCalledWith("contributions", "POST", {
      displayName: "Synthetic Friend",
      relationship: "",
      message: "A synthetic little hello.",
      consent: true,
      uploadIds: [],
    });
    expect(screen.getByText(/Received does not mean published/)).toBeTruthy();
  });
  it("recovers a receipt after a lost submission response without duplicating", async () => {
    let submitted = false;
    mock.api.mockImplementation(async (path: string) => {
      if (path === "contributions") {
        submitted = true;
        throw new Error("Connection lost");
      }
      return { submitted, uploads: [], limits: MAX };
    });
    render(<ContributionForm configured />);
    const name = await screen.findByLabelText(/Your name/);
    await waitFor(() =>
      expect((name as HTMLInputElement).disabled).toBe(false),
    );
    await userEvent.type(name, "Sample Friend");
    await userEvent.type(
      screen.getByLabelText(/Your message/),
      "Synthetic retry test",
    );
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(
      screen.getByRole("button", { name: "Send my little hello" }),
    );
    await screen.findByText("SAFELY RECEIVED");
    expect(
      mock.api.mock.calls.filter(([p]) => p === "contributions"),
    ).toHaveLength(1);
  });
  it("keeps unfinished uploads visible and blocks final submission until removed", async () => {
    let uploads = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "photo",
        state: "allocated",
        description: "",
      },
    ];
    mock.api.mockImplementation(async (path: string, method: string) => {
      if (method === "DELETE") {
        uploads = [];
        return { ok: true };
      }
      return { submitted: false, uploads, limits: MAX };
    });
    render(<ContributionForm configured />);
    await screen.findByText("Unfinished — remove and retry");
    expect(
      (
        screen.getByRole("button", {
          name: "Send my little hello",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    await waitFor(() =>
      expect(screen.queryByText("Unfinished — remove and retry")).toBeNull(),
    );
    expect(mock.api).toHaveBeenCalledWith(
      "uploads/11111111-1111-4111-8111-111111111111",
      "DELETE",
    );
  });
  it("keeps parent approval disabled until each attachment is explicitly reviewed", async () => {
    const data: AdminData = {
      invitations: [],
      areas: [],
      placements: [],
      contributions: [
        {
          id: "c",
          invitation_id: "i",
          display_name: "Synthetic Friend",
          relationship_label: "Test fixture",
          message_text: "Synthetic pending message",
          status: "pending",
          created_at: "2026-10-17T00:00:00Z",
        },
      ],
      media: [
        {
          id: "m",
          contribution_id: "c",
          kind: "audio",
          status: "pending",
          media_type: "audio/mpeg",
          file_size_bytes: 123,
          duration_ms: 1000,
          description: "Synthetic recording",
        },
      ],
    };
    mock.api.mockImplementation(
      async (path: string, method: string, body: { status: string }) => {
        if (path === "admin/media/m" && method === "PATCH")
          data.media[0].status = body.status;
        if (path === "admin/contributions/c" && method === "PATCH")
          data.contributions[0].status = body.status;
        return structuredClone(data);
      },
    );
    render(<AdminDesk configured />);
    const approve = await screen.findByRole("button", {
      name: "Approve message",
    });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Keep attachment" }),
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Approve message",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve message" }),
    );
    await waitFor(() =>
      expect(mock.api).toHaveBeenCalledWith("admin/contributions/c", "PATCH", {
        status: "approved",
        message: "Synthetic pending message",
      }),
    );
  });
});
