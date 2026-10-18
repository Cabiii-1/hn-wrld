import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ handler: vi.fn(), configured: true }));
vi.mock("../src/lib/backend/http", () => ({ handleBackend: mock.handler }));
vi.mock("../src/lib/supabase/server", () => ({
  backendConfigured: () => mock.configured,
  backendEnv: () => ({ APP_ORIGIN: "https://world.test" }),
}));
import { readPageData } from "../src/lib/backend/page-data";
beforeEach(() => {
  vi.clearAllMocks();
  mock.configured = true;
});
it("uses the authorized API projection per request without caching a prior identity's data", async () => {
  mock.handler
    .mockResolvedValueOnce(Response.json({ displayName: "Synthetic Friend" }))
    .mockResolvedValueOnce(
      Response.json(
        { error: "Please reopen your invitation" },
        { status: 401 },
      ),
    );
  expect((await readPageData("contributor")).data).toEqual({
    displayName: "Synthetic Friend",
  });
  expect(await readPageData("contributor")).toEqual({
    data: null,
    status: 401,
    error: "Please reopen your invitation",
  });
  expect(mock.handler).toHaveBeenCalledTimes(2);
  expect(mock.handler.mock.calls[0][1]).toEqual(["contributor"]);
});
it("does not attempt a private read when the backend is unconfigured", async () => {
  mock.configured = false;
  expect((await readPageData("admin/dashboard")).status).toBe(503);
  expect(mock.handler).not.toHaveBeenCalled();
});
