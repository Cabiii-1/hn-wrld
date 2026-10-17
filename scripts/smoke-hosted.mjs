// Explicit, destructive-to-own-fixtures integration rehearsal. Never uses real submissions.
// Start npm run dev, then node scripts/smoke-hosted.mjs <project-ref> --allow-test-writes
import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
const ref = process.argv[2];
assert.match(ref ?? "", /^[a-z]{20}$/);
assert.ok(
  process.argv.includes("--allow-test-writes"),
  "Explicit test-write flag required",
);
assert.equal(process.env.SUPABASE_URL, `https://${ref}.supabase.co`);
const base = process.env.APP_ORIGIN;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  options,
);
const anon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  options,
);
const bucket = "bubu-contributions";
const run = randomUUID();
const users = [],
  invitations = [];
const recipientLinks = [];
const browserFile = new URL("../test-results/m3-browser.json", import.meta.url),
  browserDone = new URL("../test-results/m3-browser.done", import.meta.url);
let browserFixture = false;
const originalAreas = checked(
  await db.from("areas").select("id,published"),
  "Read original area flags",
);
const root = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(
  new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
);
function checked(result, label) {
  assert.ok(
    !result.error,
    `${label}: backend operation failed (details suppressed)`,
  );
  return result.data;
}
function sql(query) {
  const r = spawnSync(
    process.execPath,
    [cli, "db", "query", "--linked", "--project-ref", ref, query],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  assert.equal(r.status, 0, "Test membership SQL failed (output suppressed)");
}
function client() {
  let cookie = "";
  return async (
    path,
    method = "GET",
    body,
    expected = 200,
    extraHeaders = {},
  ) => {
    const r = await fetch(`${base}/api/manage/${path}`, {
      method,
      headers: {
        Origin: base,
        Cookie: cookie,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = r.headers.getSetCookie();
    if (set.length) cookie = set.map((v) => v.split(";")[0]).join("; ");
    assert.equal(
      r.status,
      expected,
      `${method} ${path.split("/").slice(0, 2).join("/")}: expected ${expected}, got ${r.status}`,
    );
    assert.match(r.headers.get("cache-control") ?? "", /private.*no-store/);
    if (r.headers.get("content-type")?.includes("application/json"))
      return r.json();
    return r;
  };
}
const admin = client(),
  owner = client(),
  other = client(),
  unprivileged = client();
const recipient = client(),
  revisit = client();
async function invite(label) {
  const v = await admin(
    "admin/invitations",
    "POST",
    { label: `SYNTHETIC ${run} ${label}`, expiresAt: null },
    201,
  );
  invitations.push(v.id);
  return v;
}
async function exchange(api, v) {
  await api("invitations/exchange", "POST", {
    token: new URL(v.url).hash.slice(1),
  });
}
async function upload(bytes, filename, mime, kind) {
  const u = await owner(
    "uploads",
    "POST",
    {
      kind,
      filename,
      mime,
      bytes: bytes.length,
      description: "Synthetic integration fixture",
    },
    201,
  );
  const cors = await fetch(u.uploadUrl, {
    method: "OPTIONS",
    headers: {
      Origin: base,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type,x-upsert",
    },
  });
  assert.ok(cors.ok, "Storage preflight must succeed");
  assert.ok(
    ["*", base].includes(cors.headers.get("access-control-allow-origin")),
  );
  assert.match(cors.headers.get("access-control-allow-methods") ?? "", /PUT/i);
  const put = await fetch(u.uploadUrl, {
    method: "PUT",
    body: bytes,
    headers: { "Content-Type": mime, "x-upsert": "false", Origin: base },
  });
  assert.ok(put.ok, `Private signed upload failed: ${put.status}`);
  await owner(`uploads/${u.id}/complete`, "POST");
  return u;
}
try {
  for (const role of ["admin", "nonadmin"]) {
    const email = `bubu-${role}-${run}@example.com`,
      password = randomBytes(32).toString("base64url");
    const u = checked(
      await db.auth.admin.createUser({ email, password, email_confirm: true }),
      "Create synthetic user",
    ).user;
    users.push(u.id);
    const direct = await createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      options,
    ).auth.signInWithPassword({ email, password });
    assert.ok(
      !direct.error,
      `Synthetic direct Auth login failed: ${direct.error?.code ?? "unknown"}`,
    );
    if (role === "admin") {
      sql(`insert into public.admin_members(user_id) values ('${u.id}');`);
      await admin("admin/login", "POST", { email, password });
    } else await unprivileged("admin/login", "POST", { email, password }, 403);
  }
  console.log("PASS real Auth: allowlisted login succeeds; non-admin denied");
  const signup = await anon.auth.signUp({
    email: `bubu-signup-${run}@example.com`,
    password: randomBytes(32).toString("base64url"),
  });
  if (signup.data.user) users.push(signup.data.user.id);
  assert.equal(
    signup.error?.code,
    "signup_disabled",
    "Public signup must remain disabled",
  );
  await client()("admin/dashboard", "GET", undefined, 401);
  await admin(
    "admin/invitations",
    "POST",
    { label: "SYNTHETIC", expiresAt: null },
    403,
    { Origin: "https://example.com" },
  );
  const a = await invite("owner"),
    b = await invite("other");
  await exchange(owner, a);
  await exchange(other, b);
  const photo = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#e5d7a8" },
  })
    .jpeg()
    .withExif({ IFD0: { Copyright: "SYNTHETIC_EXIF_REMOVE" } })
    .toBuffer();
  const uploads = [];
  for (let i = 0; i < 3; i++)
    uploads.push(await upload(photo, `sample-${i}.jpg`, "image/jpeg", "photo"));
  await owner(
    "uploads",
    "POST",
    {
      kind: "photo",
      filename: "fourth.jpg",
      mime: "image/jpeg",
      bytes: photo.length,
    },
    409,
  );
  const mp3 = Buffer.alloc(Math.ceil((2 * 44100) / 1152) * 417);
  for (let i = 0; i < mp3.length; i += 417)
    mp3.set([0xff, 0xfb, 0x90, 0x00], i);
  uploads.push(await upload(mp3, "sample.mp3", "audio/mpeg", "audio"));
  const first = uploads[0];
  const preview = await owner(`media/${first.id}`);
  assert.equal(preview.headers.get("content-type"), "image/webp");
  assert.equal(
    (await sharp(Buffer.from(await preview.arrayBuffer())).metadata()).exif,
    undefined,
  );
  await other(`media/${first.id}`, "GET", undefined, 404);
  await client()(`media/${first.id}`, "GET", undefined, 401);
  const audio = await owner(`media/${uploads[3].id}`, "GET", undefined, 206, {
    Range: "bytes=0-15",
  });
  assert.equal((await audio.arrayBuffer()).byteLength, 16);
  const row = checked(
    await db
      .from("upload_intents")
      .select("staging_path,final_path")
      .eq("id", first.id)
      .single(),
    "Read own fixture paths",
  );
  assert.ok(
    (await anon.storage.from(bucket).download(row.final_path)).error,
    "Anonymous Storage read must fail",
  );
  const replay = await fetch(first.uploadUrl, {
    method: "PUT",
    body: photo,
    headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
  });
  assert.ok(!replay.ok, "Used non-upsert signed URL must reject replay");
  console.log(
    "PASS 3-photo/1-audio limits, direct private uploads, normalization, range reads, ownership and replay denial",
  );
  const message = {
    displayName: "Synthetic Bear",
    relationship: "Test fixture",
    message: `SYNTHETIC ${run}`,
    consent: true,
    uploadIds: uploads.map((u) => u.id),
  };
  await other("contributions", "POST", message, 409);
  const receipts = await Promise.all(
    [0, 1].map(async () => {
      const r = await owner("contributions", "POST", message, 201)
        .then(() => 201)
        .catch((e) => {
          if (e.message.includes("expected 201, got 409")) return 409;
          throw e;
        });
      return r;
    }),
  );
  assert.deepEqual(receipts.sort(), [201, 409]);
  let desk = await admin("admin/dashboard");
  const contribution = desk.contributions.find((c) => c.invitation_id === a.id);
  assert.ok(contribution);
  assert.equal(contribution.status, "pending");
  const passcode = randomBytes(24).toString("base64url");
  const key = await admin(
    "admin/recipient-links",
    "POST",
    { passcode, expiresAt: null },
    201,
  );
  recipientLinks.push(key.id);
  const entry = { token: new URL(key.url).hash.slice(1), passcode };
  await client()("recipient/house", "GET", undefined, 401);
  await recipient(
    "recipient/unlock",
    "POST",
    { ...entry, passcode: "wrong-code" },
    401,
  );
  await recipient("recipient/unlock", "POST", entry);
  assert.ok(
    !(await recipient("recipient/house")).npcs.some(
      (n) => n.id === contribution.id,
    ),
  );
  await recipient(
    `recipient/messages/${contribution.id}`,
    "GET",
    undefined,
    404,
  );
  await admin(
    `admin/contributions/${contribution.id}`,
    "PATCH",
    { status: "approved" },
    409,
  );
  for (const u of uploads)
    await admin(`admin/media/${u.id}`, "PATCH", { status: "approved" });
  await admin(`admin/contributions/${contribution.id}`, "PATCH", {
    status: "approved",
  });
  const area = desk.areas.find((a) => a.map_key === "sta_ana_house");
  await admin("admin/placements", "POST", {
    contributionId: contribution.id,
    areaId: area.id,
    variant: "npc-cream-1",
    x: 425,
    y: 352,
    radius: 20,
    published: true,
  });
  desk = await admin("admin/dashboard");
  assert.equal(
    desk.placements.find((p) => p.contribution_id === contribution.id)
      .published,
    true,
  );
  assert.ok(
    (await recipient("recipient/house")).npcs.some(
      (n) => n.id === contribution.id,
    ),
  );
  const hello = await recipient(`recipient/messages/${contribution.id}`);
  assert.equal(hello.message, message.message);
  assert.equal(hello.media.length, 4);
  assert.ok(!JSON.stringify(hello).includes("storage_path"));
  await recipient(`recipient/media/${first.id}`);
  await recipient(`recipient/seen/${contribution.id}`, "POST");
  await revisit("recipient/unlock", "POST", entry);
  assert.equal(
    (await revisit("recipient/house")).npcs.find(
      (n) => n.id === contribution.id,
    ).seen,
    true,
  );
  await revisit("recipient/logout", "POST");
  await revisit("recipient/house", "GET", undefined, 401);
  console.log(
    "PASS recipient two-factor entry, pending denial, connected NPC/message/media, persistent seen state and logout",
  );
  const sceneSpots = {
    sta_ana_house: { x: 425, y: 352, radius: 20 },
    tuguegarao_park: { x: 470, y: 290, radius: 20 },
    slu_baguio: { x: 430, y: 360, radius: 12 },
  };
  for (const map of Object.keys(sceneSpots)) {
    await client()(`recipient/scenes/${map}`, "GET", undefined, 401);
    const target = desk.areas.find((a) => a.map_key === map);
    await admin("admin/placements", "POST", {
      contributionId: contribution.id,
      areaId: target.id,
      variant: "npc-rose-bow",
      ...sceneSpots[map],
      published: true,
    });
    for (const candidate of Object.keys(sceneSpots)) {
      const scene = await recipient(`recipient/scenes/${candidate}`);
      assert.equal(scene.mapKey, candidate);
      assert.equal(
        scene.npcs.some((n) => n.id === contribution.id),
        candidate === map,
        "A bear belongs only to its assigned scene",
      );
      if (candidate === map)
        assert.equal(
          scene.npcs.find((n) => n.id === contribution.id).seen,
          true,
        );
    }
    assert.equal(
      (await recipient(`recipient/messages/${contribution.id}`)).id,
      contribution.id,
    );
    await recipient(`recipient/media/${first.id}`);
  }
  await recipient("recipient/scenes/unknown", "GET", undefined, 400);
  await admin("admin/placements", "POST", {
    contributionId: contribution.id,
    areaId: area.id,
    variant: "npc-cream-1",
    ...sceneSpots.sta_ana_house,
    published: true,
  });
  console.log(
    "PASS all three scene projections, correct placement isolation, media authorization and seen state across relocation",
  );
  if (process.argv.includes("--browser-check")) {
    mkdirSync(new URL("../test-results/", import.meta.url), {
      recursive: true,
    });
    writeFileSync(
      browserFile,
      JSON.stringify({
        url: key.url,
        passcode,
        contributionId: contribution.id,
      }),
      { flag: "wx", mode: 0o600 },
    );
    browserFixture = true;
    console.log(
      "Browser fixture ready in ignored test-results/m3-browser.json; waiting up to 6 minutes for m3-browser.done",
    );
    const deadline = Date.now() + 360000;
    while (!existsSync(browserDone) && Date.now() < deadline) await delay(1000);
  }
  const privateRows = await anon.from("contributions").select("id");
  assert.ok(privateRows.error || privateRows.data.length === 0);
  await admin(`admin/media/${first.id}`, "PATCH", { status: "rejected" });
  await owner(`media/${first.id}`, "GET", undefined, 404);
  await recipient(`recipient/media/${first.id}`, "GET", undefined, 404);
  await recipient(
    `recipient/messages/${contribution.id}`,
    "GET",
    undefined,
    404,
  );
  assert.equal(
    (await admin("admin/dashboard")).placements.find(
      (p) => p.contribution_id === contribution.id,
    ).published,
    false,
  );
  await admin(`admin/media/${first.id}`, "DELETE");
  await admin(`media/${first.id}`, "GET", undefined, 404);
  await admin(`admin/contributions/${contribution.id}`, "DELETE");
  await owner("contributor", "GET", undefined, 401);
  const finalPaths = checked(
    await db
      .from("upload_intents")
      .select("final_path")
      .in(
        "id",
        uploads.map((u) => u.id),
      ),
    "Read own cleanup fixture paths",
  ).map((u) => u.final_path);
  // Only advance this run's deleted final-object jobs; never shorten staging TTLs.
  checked(
    await db
      .from("storage_cleanup")
      .update({ not_before: new Date().toISOString() })
      .in("storage_path", finalPaths),
    "Make deleted test objects eligible",
  );
  await admin("admin/cleanup", "POST");
  for (const path of finalPaths)
    assert.ok(
      (await db.storage.from(bucket).download(path)).error,
      "Cleanup must physically remove deleted test media",
    );
  await admin(`admin/invitations/${b.id}`, "DELETE");
  await other("contributor", "GET", undefined, 401);
  await admin(`admin/recipient-links/${key.id}`, "DELETE");
  await recipient("recipient/house", "GET", undefined, 401);
  for (const map of Object.keys(sceneSpots))
    await recipient(`recipient/scenes/${map}`, "GET", undefined, 401);
  await client()("recipient/unlock", "POST", entry, 401);
  console.log(
    "PASS concurrent submit, moderation gates, safe placement, RLS, rejection/unpublish, deletion and revocation",
  );
} finally {
  if (browserFixture) {
    unlinkSync(browserFile);
    if (existsSync(browserDone)) unlinkSync(browserDone);
  }
  if (recipientLinks.length)
    checked(
      await db.from("recipient_access_links").delete().in("id", recipientLinks),
      "Remove synthetic recipient links and visits",
    );
  // Restrict cleanup to IDs created in this run. Delayed staging cleanup jobs remain
  // because a signed upload capability can outlive a revoked invitation by two hours.
  if (invitations.length) {
    const intents = checked(
      await db
        .from("upload_intents")
        .select("staging_path,final_path")
        .in("invitation_id", invitations),
      "Find synthetic objects",
    );
    const paths = intents.flatMap((i) =>
      [i.staging_path, i.final_path].filter(Boolean),
    );
    if (paths.length)
      checked(
        await db.storage.from(bucket).remove(paths),
        "Remove synthetic objects",
      );
    const contributions = checked(
      await db
        .from("contributions")
        .select("id")
        .in("invitation_id", invitations),
      "Find synthetic contributions",
    );
    if (contributions.length)
      checked(
        await db
          .from("contributions")
          .delete()
          .in(
            "id",
            contributions.map((c) => c.id),
          ),
        "Remove synthetic contributions",
      );
    checked(
      await db.from("upload_intents").delete().in("invitation_id", invitations),
      "Remove synthetic upload intents",
    );
    checked(
      await db.from("invitations").delete().in("id", invitations),
      "Remove synthetic invitations",
    );
  }
  for (const area of originalAreas.filter((a) => !a.published)) {
    const remaining = checked(
      await db
        .from("npc_placements")
        .select("id")
        .eq("area_id", area.id)
        .eq("published", true),
      "Check area publication",
    );
    if (!remaining.length)
      checked(
        await db.from("areas").update({ published: false }).eq("id", area.id),
        "Restore test area flag",
      );
  }
  for (const id of users)
    checked(await db.auth.admin.deleteUser(id), "Remove temporary account");
  console.log(
    "Synthetic accounts, invitations, messages and objects removed; delayed cleanup jobs retained",
  );
}
