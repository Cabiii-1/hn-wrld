import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3000";
const parsed = new URL(base);
if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
  throw new Error("This smoke check is for local previews only.");
for (const path of [
  "admin/dashboard",
  "contributor",
  "recipient/house",
  "recipient/scenes/sta_ana_house",
  "recipient/scenes/tuguegarao_park",
  "recipient/scenes/slu_baguio",
  "recipient/messages/11111111-1111-4111-8111-111111111111",
  "recipient/media/11111111-1111-4111-8111-111111111111",
  "media/11111111-1111-4111-8111-111111111111",
]) {
  const response = await fetch(`${base}/api/manage/${path}`, {
    redirect: "manual",
  });
  assert.equal(response.status, 401, `Anonymous ${path} must be denied`);
  assert.match(
    response.headers.get("cache-control") ?? "",
    /private.*no-store/,
  );
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  console.log(`PASS anonymous ${path}: 401, private/no-store, no-referrer`);
}
for (const path of ["", "play", "admin", "invite", "contribute"]) {
  const response = await fetch(`${base}/${path}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  console.log(`PASS /${path}: renders with no-store and noindex`);
}
