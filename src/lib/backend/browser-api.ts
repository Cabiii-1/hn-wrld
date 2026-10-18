const pendingReads = new Map<string, Promise<unknown>>();

export function api<T = { ok: boolean }>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  // Share only simultaneous browser reads, never completed private responses.
  // Writes invalidate pending lookups so later reads cannot reuse pre-write data.
  const deduplicate = method === "GET" && typeof window !== "undefined";
  if (method !== "GET") pendingReads.clear();
  if (deduplicate && pendingReads.has(path))
    return pendingReads.get(path)! as Promise<T>;
  const request = (async () => {
    const response = await fetch(`/api/manage/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Please try again.");
    return result as T;
  })();
  if (!deduplicate) return request;
  const tracked = request.finally(() => {
    if (pendingReads.get(path) === tracked) pendingReads.delete(path);
  });
  pendingReads.set(path, tracked);
  return tracked;
}
