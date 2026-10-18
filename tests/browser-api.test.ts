// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { api } from "../src/lib/backend/browser-api";
afterEach(() => vi.unstubAllGlobals());
it("shares simultaneous private reads but does not cache completed responses", async () => {
  let finish!: (value: Response) => void;
  const fetchMock = vi.fn<typeof fetch>(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const first = api("contributor"),
    second = api("contributor");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  finish(Response.json({ submitted: false }));
  expect(await first).toEqual(await second);
  fetchMock.mockResolvedValueOnce(Response.json({ submitted: true }));
  expect(await api("contributor")).toEqual({ submitted: true });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    credentials: "same-origin",
  });
});
it("a logout prevents new reads from reusing any earlier in-flight response", async () => {
  let finish!: (value: Response) => void;
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(Response.json({ ok: true }))
    .mockResolvedValueOnce(
      Response.json({ error: "Please sign in" }, { status: 401 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  const stale = api("admin/dashboard");
  await api("admin/logout", "POST");
  await expect(api("admin/dashboard")).rejects.toThrow("Please sign in");
  finish(Response.json({ synthetic: true }));
  await stale;
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
