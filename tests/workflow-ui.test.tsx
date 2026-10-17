// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mock = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn() }));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));
vi.mock("next/navigation", () => ({
  useRouter: (() => {
    const router = { replace: mock.replace };
    return () => router;
  })(),
}));
import { ContributionForm } from "../src/components/contribution-form";
import { AdminDesk } from "../src/components/admin-desk";
import { InviteWelcome } from "../src/components/invite-welcome";
import { RecipientEntry } from "../src/components/recipient-entry";
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
  it("accepts a recipient fragment added to an already open entry page", async () => {
    mock.api.mockRejectedValue(new Error("No session"));
    render(<RecipientEntry />);
    await waitFor(() =>
      expect(mock.api).toHaveBeenCalledWith("recipient/session"),
    );
    history.replaceState(null, "", `/#${"c".repeat(43)}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await screen.findByLabelText("Passcode");
    expect(location.hash).toBe("");
  });
  it("keeps the recipient fragment out of history and survives React StrictMode", async () => {
    const token = "b".repeat(43);
    window.history.replaceState(null, "", `/#${token}`);
    mock.api.mockResolvedValue({ ok: true });
    render(
      <React.StrictMode>
        <RecipientEntry />
      </React.StrictMode>,
    );
    const input = await screen.findByLabelText("Passcode");
    expect(location.hash).toBe("");
    expect(mock.api).not.toHaveBeenCalledWith("recipient/session");
    await userEvent.type(input, "synthetic-passcode");
    await userEvent.click(screen.getByRole("button", { name: "Come on in" }));
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith("/play"));
    expect(mock.api).toHaveBeenCalledWith("recipient/unlock", "POST", {
      token,
      passcode: "synthetic-passcode",
    });
    expect(localStorage.length).toBe(0);
  });
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
  it("automatically exchanges an invitation once in StrictMode and removes its fragment", async () => {
    const token = "a".repeat(43);
    window.history.replaceState(null, "", `/invite#${token}`);
    mock.api.mockResolvedValue({ ok: true });
    render(
      <React.StrictMode>
        <InviteWelcome configured />
      </React.StrictMode>,
    );
    await waitFor(() =>
      expect(mock.replace).toHaveBeenCalledWith("/contribute"),
    );
    expect(mock.api).toHaveBeenCalledTimes(1);
    expect(mock.replace).toHaveBeenCalledTimes(1);
    expect(mock.api).toHaveBeenCalledWith("invitations/exchange", "POST", {
      token,
    });
    expect(location.hash).toBe("");
    expect(mock.replace).toHaveBeenCalledWith("/contribute");
    expect(
      screen.queryByRole("button", { name: "Open my invitation" }),
    ).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it("keeps a failed invitation out of the URL and retries only on request", async () => {
    const token = "d".repeat(43);
    history.replaceState(null, "", `/invite#${token}`);
    mock.api
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce({ ok: true });
    render(<InviteWelcome configured />);
    await screen.findByText("Connection lost");
    expect(location.hash).toBe("");
    expect(mock.replace).not.toHaveBeenCalled();
    expect(mock.api).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(mock.replace).toHaveBeenCalledWith("/contribute"),
    );
    expect(mock.api).toHaveBeenLastCalledWith("invitations/exchange", "POST", {
      token,
    });
    expect(mock.api).toHaveBeenCalledTimes(2);
  });
  it.each(["", "#invalid"])(
    "rejects missing/malformed links (%s) without an exchange and accepts a new fragment",
    async (hash) => {
      history.replaceState(null, "", `/invite${hash}`);
      mock.api.mockResolvedValue({ ok: true });
      render(<InviteWelcome configured />);
      await screen.findByText(
        "Open the complete invitation link Dudu sent you.",
      );
      expect(location.hash).toBe("");
      expect(mock.api).not.toHaveBeenCalled();
      const token = "e".repeat(43);
      history.replaceState(null, "", `/invite#${token}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      await waitFor(() =>
        expect(mock.replace).toHaveBeenCalledWith("/contribute"),
      );
      expect(mock.api).toHaveBeenCalledWith("invitations/exchange", "POST", {
        token,
      });
    },
  );
  it("serializes a second invitation while an earlier exchange is pending", async () => {
    let finishFirst!: (value: unknown) => void;
    const first = "f".repeat(43),
      second = "g".repeat(43);
    mock.api
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: true });
    history.replaceState(null, "", `/invite#${first}`);
    render(<InviteWelcome configured />);
    history.replaceState(null, "", `/invite#${second}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(mock.api).toHaveBeenCalledTimes(1);
    expect(mock.replace).not.toHaveBeenCalled();
    finishFirst({ ok: true });
    await waitFor(() => expect(mock.replace).toHaveBeenCalledTimes(1));
    expect(mock.api).toHaveBeenLastCalledWith("invitations/exchange", "POST", {
      token: second,
    });
    expect(mock.replace).toHaveBeenCalledWith("/contribute");
  });
  it("requires consent, submits once, and shows receipt without publication claims", async () => {
    let submitted = false;
    mock.api.mockImplementation(async (path: string) => {
      if (path === "contributions") {
        submitted = true;
        return { received: true };
      }
      return {
        displayName: "Synthetic Friend",
        submitted,
        uploads: [],
        limits: MAX,
      };
    });
    render(<ContributionForm configured />);
    await screen.findByRole("heading", { name: "Hello, Synthetic Friend!" });
    expect(screen.queryByLabelText(/Your name/)).toBeNull();
    expect(screen.queryByLabelText(/Your connection/)).toBeNull();
    expect(screen.getByPlaceholderText("Dear Hanna…")).toBeTruthy();
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
      return {
        displayName: "Sample Friend",
        submitted,
        uploads: [],
        limits: MAX,
      };
    });
    render(<ContributionForm configured />);
    await screen.findByRole("heading", { name: "Hello, Sample Friend!" });
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
      return {
        displayName: "Synthetic Friend",
        submitted: false,
        uploads,
        limits: MAX,
      };
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
