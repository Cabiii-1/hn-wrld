// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceRecorder } from "../src/components/use-voice-recorder";
import { VoiceRecorderControls } from "../src/components/voice-recorder-controls";
import { ContributionForm } from "../src/components/contribution-form";
import { MAX } from "../src/lib/backend/contracts";

const mock = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/lib/backend/browser-api", () => ({ api: mock.api }));

class SyntheticRecorder {
  static instances: SyntheticRecorder[] = [];
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/webm";
  onstart: (() => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  stopCalls = 0;
  constructor() {
    SyntheticRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
    this.onstart?.();
  }
  stop() {
    this.stopCalls++;
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["synthetic audio"], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}
let getMicrophone: ReturnType<typeof vi.fn>;
let releaseTrack: ReturnType<typeof vi.fn>;
let save: ReturnType<typeof vi.fn<(file: File) => Promise<string | null>>>;
function Harness() {
  const recorder = useVoiceRecorder({ maxSeconds: 90, onRecorded: save });
  return (
    <>
      <VoiceRecorderControls
        recorder={recorder}
        disabled={false}
        maxSeconds={90}
        savingMessage="Uploading your voice note…"
      />
      <button disabled={recorder.active}>Send letter</button>
      {recorder.preview?.uploadId && (
        <audio aria-label="Saved preview" src={recorder.preview.url} />
      )}
    </>
  );
}
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}
async function start() {
  fireEvent.click(screen.getByRole("button", { name: "Record a voice note" }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  SyntheticRecorder.instances = [];
  releaseTrack = vi.fn();
  getMicrophone = vi
    .fn()
    .mockResolvedValue({ getTracks: () => [{ stop: releaseTrack }] });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getMicrophone },
  });
  vi.stubGlobal("MediaRecorder", SyntheticRecorder);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:synthetic-recording");
      static revokeObjectURL = vi.fn();
    },
  );
  save = vi
    .fn<(file: File) => Promise<string | null>>()
    .mockResolvedValue("synthetic-upload");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Voice recording feedback and lifecycle", () => {
  it("shows microphone opening, prevents duplicate starts, and releases a cancelled late permission result", async () => {
    let permit!: (value: unknown) => void;
    getMicrophone.mockImplementation(
      () =>
        new Promise((resolve) => {
          permit = resolve;
        }),
    );
    render(<Harness />);
    await flush();
    fireEvent.click(
      screen.getByRole("button", { name: "Record a voice note" }),
    );
    expect(screen.getByText("Opening your microphone…")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Send letter" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole("timer")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel microphone request" }),
    );
    await act(async () =>
      permit({ getTracks: () => [{ stop: releaseTrack }] }),
    );
    expect(releaseTrack).toHaveBeenCalledOnce();
    expect(SyntheticRecorder.instances).toHaveLength(0);
    expect(save).not.toHaveBeenCalled();
  });
  it("shows elapsed recording time, stops automatically, and previews immediately while a slow save is pending", async () => {
    let finish!: (id: string) => void;
    save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness />);
    await flush();
    await start();
    expect(screen.getByText("Recording your voice")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(65000);
    });
    expect(screen.getByRole("timer").textContent).toContain("1:05");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(23000);
    });
    expect(SyntheticRecorder.instances[0].stopCalls).toBe(1);
    expect(releaseTrack).toHaveBeenCalledOnce();
    expect(screen.queryByText("Recording your voice")).toBeNull();
    expect(
      screen.getByLabelText("Preview your recording").getAttribute("src"),
    ).toBe("blob:synthetic-recording");
    expect(screen.getByText(/You can listen while it saves/)).toBeTruthy();
    const playingPreview = screen.getByLabelText("Preview your recording");
    expect(save).toHaveBeenCalledOnce();
    await act(async () => finish("synthetic-upload"));
    expect(screen.getByLabelText("Preview your recording")).toBe(
      playingPreview,
    );
    expect(screen.getByLabelText("Saved preview").getAttribute("src")).toBe(
      "blob:synthetic-recording",
    );
    expect(screen.queryByText(/You can listen while it saves/)).toBeNull();
  });
  it("retains the recording on a failed upload and retries it without reopening the microphone", async () => {
    save.mockResolvedValueOnce(null).mockResolvedValueOnce("retried-upload");
    render(<Harness />);
    await flush();
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await flush();
    expect(screen.getByText(/Your recording is still here/)).toBeTruthy();
    const original = save.mock.calls[0][0];
    fireEvent.click(
      screen.getByRole("button", { name: "Retry saving voice note" }),
    );
    await flush();
    expect(save.mock.calls[1][0]).toBe(original);
    expect(getMicrophone).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Saved preview")).toBeTruthy();
  });
  it("handles denied permissions and recorder errors without uploading a partial recording", async () => {
    getMicrophone.mockRejectedValueOnce(
      new DOMException("Denied", "NotAllowedError"),
    );
    render(<Harness />);
    await flush();
    await start();
    expect(screen.getByRole("alert").textContent).toContain(
      "Microphone access wasn’t allowed",
    );
    await start();
    await act(async () => SyntheticRecorder.instances[0].onerror?.());
    await act(async () => SyntheticRecorder.instances[0].onstop?.());
    expect(releaseTrack).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "stopped unexpectedly",
    );
  });
  it("releases microphone tracks and object URLs when leaving, without uploading an abandoned recording", async () => {
    const first = render(<Harness />);
    await flush();
    await start();
    first.unmount();
    expect(releaseTrack).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    const second = render(<Harness />);
    await flush();
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await flush();
    second.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:synthetic-recording",
    );
  });
  it("shows the saved attachment from the local clip rather than downloading it again", async () => {
    let uploaded = false;
    mock.api.mockImplementation(async (path: string) => {
      if (path === "uploads")
        return {
          id: "recorded-upload",
          uploadUrl: "https://storage.test/synthetic",
        };
      if (path.endsWith("/complete")) {
        uploaded = true;
        return { ok: true };
      }
      return {
        displayName: "Synthetic Friend",
        submitted: false,
        uploads: uploaded
          ? [
              {
                id: "recorded-upload",
                kind: "audio",
                state: "validated",
                description: "",
              },
            ]
          : [],
        limits: MAX,
      };
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(
      <ContributionForm
        configured
        initialResolved
        initialSnapshot={{
          displayName: "Synthetic Friend",
          submitted: false,
          uploads: [],
          limits: MAX,
        }}
      />,
    );
    await flush();
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await flush();
    const audio = screen.getByLabelText("Preview your recording");
    expect(audio?.getAttribute("src")).toBe("blob:synthetic-recording");
    expect(mock.api).toHaveBeenCalledWith(
      "uploads/recorded-upload/complete",
      "POST",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("keeps a failed recording locally, discards its unfinished upload, and retries the same clip", async () => {
    let attempt = 0;
    mock.api.mockImplementation(async (path: string) => {
      if (path === "uploads") {
        attempt++;
        return {
          id: "recorded-upload",
          uploadUrl: "https://storage.test/synthetic",
        };
      }
      if (path.endsWith("/complete")) return { ok: true };
      return {
        displayName: "Synthetic Friend",
        submitted: false,
        uploads:
          attempt > 1
            ? [
                {
                  id: "recorded-upload",
                  kind: "audio",
                  state: "validated",
                  description: "",
                },
              ]
            : [],
        limits: MAX,
      };
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockResolvedValue({ ok: true }),
    );
    render(
      <ContributionForm
        configured
        initialResolved
        initialSnapshot={{
          displayName: "Synthetic Friend",
          submitted: false,
          uploads: [],
          limits: MAX,
        }}
      />,
    );
    await flush();
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await flush();
    expect(mock.api).toHaveBeenCalledWith("uploads/recorded-upload", "DELETE");
    expect(screen.getByLabelText("Preview your recording")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Send my little hello",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Retry saving voice note" }),
    );
    await flush();
    expect(getMicrophone).toHaveBeenCalledOnce();
    expect(
      screen.getByLabelText("Preview your recording").getAttribute("src"),
    ).toBe("blob:synthetic-recording");
  });
});
