import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isSafeHousePlacement } from "../src/lib/backend/contracts";
import geometry from "../src/game/scene-geometry.json";
import { SCENE_KEYS, SCENES, safePlacement } from "../src/game/scenes";

let db: PGlite;
const ADMIN = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222";
async function role(name: string, uid = "") {
  await db.exec(`reset role; set role ${name};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
}
async function scalar<T>(sql: string, params: unknown[] = []) {
  const result = await db.query<{ value: T }>(`select ${sql} as value`, params);
  return result.rows[0].value;
}
async function invite(expired = false, label = "Synthetic invite") {
  await role("authenticated", ADMIN);
  const token = randomUUID(),
    session = randomUUID();
  const id = await scalar<string>("public.admin_create_invite($1,$2,null)", [
    token,
    label,
  ]);
  await role("service_role");
  if (expired)
    await db.query(
      "update public.invitations set expires_at=now()-interval '1 minute' where id=$1",
      [id],
    );
  else await scalar("public.exchange_invitation($1,$2)", [token, session]);
  return { id, token, session };
}
async function submit(session: string, uploads: string[] = []) {
  return scalar<string>(
    "public.submit_contribution($1,'Sample Friend','','Synthetic hello 🌼',$2::uuid[])",
    [session, `{${uploads.join(",")}}`],
  );
}
async function reserve(session: string, kind = "photo") {
  const id = randomUUID();
  const path = await scalar<string>(
    "public.reserve_upload($1,$2::uuid,$3::public.media_kind,123,'png','image/png','Synthetic attachment')",
    [session, id, kind],
  );
  return { id, path };
}
async function validate(session: string, id: string, inviteId: string) {
  const path = `validated/${inviteId}/${id}/${randomUUID()}.webp`;
  await scalar("public.validate_upload($1,$2::uuid,$3,'image/webp',100,null)", [
    session,
    id,
    path,
  ]);
  return path;
}

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role; grant execute on function auth.uid() to public;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security; grant select on storage.objects to anon,authenticated;
    insert into auth.users values('${ADMIN}'),('${OTHER}');`);
  for (const file of [
    "0001_initial.sql",
    "0002_media_recipient_gate.sql",
    "0003_contributor_admin_workflows.sql",
    "0004_recipient_world.sql",
    "0005_three_places.sql",
    "0006_private_finale.sql",
    "0007_invitation_assigned_names.sql",
    "0008_returning_contributors.sql",
    "0009_contributor_visits.sql",
    "0010_named_contributor_visits.sql",
    "0011_character_display_names.sql",
    "0012_edit_contribution_media.sql",
    "0013_opt_in_shared_letters.sql",
  ]) {
    let sql = await readFile(
      new URL(`../supabase/migrations/${file}`, import.meta.url),
      "utf8",
    );
    // gen_random_uuid is core PostgreSQL. PGlite lacks only the unrelated pgcrypto extension.
    sql = sql.replace("create extension if not exists pgcrypto;", "");
    try {
      await db.exec(sql);
    } catch (error) {
      const e = error as {
        message: string;
        position?: number;
        internalPosition?: number;
        internalQuery?: string;
      };
      throw new Error(
        `${file}: ${e.message}; position=${e.position}; internal=${e.internalPosition}; query=${e.internalQuery}`,
      );
    }
  }
  await db.query("insert into public.admin_members(user_id) values($1)", [
    ADMIN,
  ]);
}, 30000);
afterEach(async () => {
  await role("postgres");
});
afterAll(async () => {
  await db?.close();
});

describe("Invitation-assigned contributor names", () => {
  it("returns only the authenticated invitation name and ignores submitted identity fields", async () => {
    const own = await invite(false, "Synthetic Auntie"),
      other = await invite(false, "Synthetic Other Friend");
    const snapshot = await scalar<{ displayName: string; submitted: boolean }>(
      "public.contributor_snapshot($1)",
      [own.session],
    );
    expect(snapshot.displayName).toBe("Synthetic Auntie");
    expect(JSON.stringify(snapshot)).not.toContain("Synthetic Other Friend");
    const id = await scalar<string>(
      "public.submit_contribution($1,'Forged name','Forged connection','Synthetic hello for Hanna','{}'::uuid[])",
      [own.session],
    );
    const row = await db.query<{
      display_name: string;
      relationship_label: string | null;
      status: string;
    }>(
      "select display_name,relationship_label,status from public.contributions where id=$1",
      [id],
    );
    expect(row.rows[0]).toEqual({
      display_name: "Synthetic Auntie",
      relationship_label: null,
      status: "pending",
    });
    expect(
      await scalar("public.contributor_snapshot($1)", [own.session]),
    ).toMatchObject({ displayName: "Synthetic Auntie", submitted: true });
    expect(
      await scalar("public.contributor_snapshot($1)", [other.session]),
    ).toMatchObject({
      displayName: "Synthetic Other Friend",
      submitted: false,
    });
  });
  it("does not require a name or relationship from the contributor", async () => {
    const own = await invite(false, "Synthetic Friend");
    const id = await scalar<string>(
      "public.submit_contribution($1,null,null,'Just the message','{}'::uuid[])",
      [own.session],
    );
    expect(
      await scalar(
        "(select display_name from public.contributions where id=$1)",
        [id],
      ),
    ).toBe("Synthetic Friend");
  });
});

describe("M2 PostgreSQL migrations, RLS and atomic workflows", () => {
  it("keeps every exposed table under RLS and storage private", async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'",
    );
    expect(tables.rows.length).toBeGreaterThanOrEqual(12);
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
    expect(
      await scalar<boolean>(
        "(select public from storage.buckets where id='bubu-contributions')",
      ),
    ).toBe(false);
    await role("anon");
    await expect(
      db.query("select * from public.contributions"),
    ).rejects.toThrow();
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
  });
  it("prevents anonymous and non-admin RPC escalation and allowlist writes", async () => {
    await role("anon");
    await expect(
      scalar("public.exchange_invitation('x','x')"),
    ).rejects.toThrow();
    await expect(
      scalar("public.admin_create_invite('x','x',null)"),
    ).rejects.toThrow();
    await role("authenticated", OTHER);
    expect(await scalar<boolean>("public.is_world_admin()")).toBe(false);
    await expect(
      scalar("public.admin_create_invite('x','x',null)"),
    ).rejects.toThrow("Admin required");
    await expect(
      db.query("insert into public.admin_members(user_id) values($1)", [OTHER]),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from public.contributions")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("update public.contributions set status='approved'"),
    ).rejects.toThrow();
  });
  it("denies invalid, expired, revoked, exhausted invites and old rotated sessions", async () => {
    const i = await invite();
    expect(await scalar("public.active_contributor($1)", [i.session])).toBe(
      i.id,
    );
    await scalar("public.exchange_invitation($1,'rotated-session')", [i.token]);
    expect(
      await scalar("public.active_contributor($1)", [i.session]),
    ).toBeNull();
    await expect(
      scalar("public.exchange_invitation('guessed','guess')"),
    ).rejects.toThrow("unavailable");
    const expired = await invite(true);
    await expect(
      scalar("public.exchange_invitation($1,'expired')", [expired.token]),
    ).rejects.toThrow("unavailable");
    const revoked = await invite();
    await role("authenticated", ADMIN);
    await scalar("public.admin_revoke_invite($1::uuid)", [revoked.id]);
    await role("service_role");
    expect(
      await scalar("public.active_contributor($1)", [revoked.session]),
    ).toBeNull();
    await expect(submit(revoked.session)).rejects.toThrow();
    const used = await invite();
    await submit(used.session);
    await expect(submit(used.session)).rejects.toThrow("Already submitted");
    await scalar("public.exchange_invitation($1,'used')", [used.token]);
    expect(await scalar("public.active_contributor('used')")).toBe(used.id);
    await expect(submit("used")).rejects.toThrow("Already submitted");
  });
  it("persists rate limits across callers and blocks after the allowed attempts", async () => {
    await role("service_role");
    const key = randomUUID();
    expect(await scalar("public.consume_rate_limit($1,2,600)", [key])).toBe(
      true,
    );
    expect(await scalar("public.consume_rate_limit($1,2,600)", [key])).toBe(
      true,
    );
    expect(await scalar("public.consume_rate_limit($1,2,600)", [key])).toBe(
      false,
    );
  });
  it("enforces photo/audio counts, scoped completion, and validated-only attachment", async () => {
    const i = await invite(),
      other = await invite();
    const p1 = await reserve(i.session),
      p2 = await reserve(i.session),
      p3 = await reserve(i.session);
    await expect(reserve(i.session)).rejects.toThrow("limit");
    const audio = await reserve(i.session, "audio");
    await expect(reserve(i.session, "audio")).rejects.toThrow("limit");
    await expect(submit(i.session, [p1.id])).rejects.toThrow("attachments");
    await expect(validate(other.session, p1.id, other.id)).rejects.toThrow(
      "unavailable",
    );
    await validate(i.session, p1.id, i.id);
    await validate(i.session, p2.id, i.id);
    await validate(i.session, p3.id, i.id);
    await expect(submit(other.session, [p1.id])).rejects.toThrow("attachments");
    await expect(submit(i.session, [p1.id, p1.id])).rejects.toThrow(
      "attachments",
    );
    await expect(
      scalar("public.validate_upload($1,$2::uuid,$3,'audio/mpeg',123,90001)", [
        i.session,
        audio.id,
        `validated/${i.id}/${audio.id}/voice.mp3`,
      ]),
    ).rejects.toThrow("Invalid media");
    await scalar(
      "public.validate_upload($1,$2::uuid,$3,'audio/mpeg',123,90000)",
      [i.session, audio.id, `validated/${i.id}/${audio.id}/voice.mp3`],
    );
    const c = await submit(i.session, [p1.id, p2.id, p3.id, audio.id]);
    expect(
      await scalar(
        "(select count(*) from public.contribution_media where contribution_id=$1)",
        [c],
      ),
    ).toBe(4);
    expect(
      await scalar(
        "(select status::text from public.contributions where id=$1)",
        [c],
      ),
    ).toBe("pending");
    await expect(
      scalar("public.discard_upload($1,$2::uuid)", [i.session, p1.id]),
    ).rejects.toThrow("unavailable");
  });
  it("requires explicit attachment decisions and approval before publication", async () => {
    const i = await invite();
    const p = await reserve(i.session);
    await validate(i.session, p.id, i.id);
    const c = await submit(i.session, [p.id]);
    await role("authenticated", ADMIN);
    const area = await scalar<string>(
      "(select id from public.areas where map_key='sta_ana_house')",
    );
    await expect(
      scalar("public.admin_review($1::uuid,'approved',null)", [c]),
    ).rejects.toThrow("every attachment");
    await expect(
      scalar(
        "public.admin_place_npc($1::uuid,$2::uuid,'npc-brown-scarf',425,352,20,true)",
        [c, area],
      ),
    ).rejects.toThrow("Review required");
    await scalar("public.admin_review_media($1::uuid,'rejected')", [p.id]);
    await scalar("public.admin_review($1::uuid,'approved',null)", [c]);
    await scalar(
      "public.admin_place_npc($1::uuid,$2::uuid,'npc-brown-scarf',425,352,20,true)",
      [c, area],
    );
    expect(
      await scalar(
        "(select published from public.npc_placements where contribution_id=$1)",
        [c],
      ),
    ).toBe(true);
    await scalar("public.admin_review($1::uuid,'hidden',null)", [c]);
    expect(
      await scalar(
        "(select published from public.npc_placements where contribution_id=$1)",
        [c],
      ),
    ).toBe(false);
    await role("authenticated", OTHER);
    expect(
      (await db.query("select * from public.contributions where id=$1", [c]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from public.contribution_media where id=$1", [
          p.id,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("allows deleting one attachment without deleting its message, and forbids resurrection", async () => {
    const i = await invite(),
      p = await reserve(i.session);
    const path = await validate(i.session, p.id, i.id);
    const c = await submit(i.session, [p.id]);
    await role("authenticated", ADMIN);
    await scalar("public.admin_delete_media($1::uuid)", [p.id]);
    expect(
      await scalar(
        "(select status::text from public.contribution_media where id=$1)",
        [p.id],
      ),
    ).toBe("deleted");
    expect(
      await scalar("(select count(*) from public.contributions where id=$1)", [
        c,
      ]),
    ).toBe(1);
    await expect(
      scalar("public.admin_review_media($1::uuid,'approved')", [p.id]),
    ).rejects.toThrow("unavailable");
    await role("service_role");
    expect(
      await scalar(
        "exists(select 1 from public.storage_cleanup where storage_path=$1)",
        [path],
      ),
    ).toBe(true);
  });
  it("allows future revisions after discarded reservations while capping active drafts", async () => {
    const i = await invite();
    for (let n = 0; n < 24; n++) {
      const p = await reserve(i.session);
      await scalar("public.discard_upload($1,$2::uuid)", [i.session, p.id]);
    }
    await reserve(i.session);
    await reserve(i.session);
    await reserve(i.session);
    await expect(reserve(i.session)).rejects.toThrow("Attachment limit");
  });
  it("serializes duplicate submissions so only one message is created", async () => {
    const i = await invite();
    const results = await Promise.allSettled([
      submit(i.session),
      submit(i.session),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(
      await scalar(
        "(select count(*) from public.contributions where invitation_id=$1)",
        [i.id],
      ),
    ).toBe(1);
  });
  it("rejects unsafe spawns and allows verified park publication, matching TS house geometry", async () => {
    const i = await invite();
    const c = await submit(i.session);
    await role("authenticated", ADMIN);
    const house = await scalar<string>(
        "(select id from public.areas where map_key='sta_ana_house')",
      ),
      park = await scalar<string>(
        "(select id from public.areas where map_key='tuguegarao_park')",
      );
    await scalar("public.admin_review($1::uuid,'approved',null)", [c]);
    await expect(
      scalar(
        "public.admin_place_npc($1::uuid,$2::uuid,'npc-brown-scarf',450,270,20,true)",
        [c, house],
      ),
    ).rejects.toThrow("Unsafe");
    await scalar(
      "public.admin_place_npc($1::uuid,$2::uuid,'npc-brown-scarf',425,352,20,true)",
      [c, park],
    );
    await scalar(
      "public.admin_place_npc($1::uuid,$2::uuid,'npc-brown-scarf',425,352,20,false)",
      [c, park],
    );
    for (const [x, y, r] of [
      [425, 352, 20],
      [450, 300, 20],
      [650, 350, 50],
      [100, 400, 40],
      [39, 249, 0],
      [797, 424, 0],
      [375, 300, 0],
    ])
      expect(await scalar("public.house_safe($1,$2,$3)", [x, y, r])).toBe(
        isSafeHousePlacement(x, y, r),
      );
  });
  it("deletes NPC/message, revokes contributor access, and queues private objects", async () => {
    const i = await invite();
    const p = await reserve(i.session);
    const path = await validate(i.session, p.id, i.id);
    const c = await submit(i.session, [p.id]);
    await role("authenticated", ADMIN);
    await scalar("public.admin_delete_contribution($1::uuid)", [c]);
    await role("service_role");
    expect(
      await scalar("public.active_contributor($1)", [i.session]),
    ).toBeNull();
    expect(
      await scalar("(select count(*) from public.contributions where id=$1)", [
        c,
      ]),
    ).toBe(0);
    expect(
      await scalar(
        "exists(select 1 from public.storage_cleanup where storage_path=$1)",
        [path],
      ),
    ).toBe(true);
  });
  it("cleans abandoned objects without deleting attached or still-valid uploads", async () => {
    const i = await invite();
    const p = await reserve(i.session);
    const path = await validate(i.session, p.id, i.id);
    await db.query(
      "insert into public.storage_cleanup(storage_path,not_before) values($1,now()-interval '1 hour') on conflict do nothing",
      [path],
    );
    expect(
      (
        await db.query<{ storage_path: string }>(
          "select * from public.cleanup_candidates()",
        )
      ).rows.map((r) => r.storage_path),
    ).not.toContain(path);
    await submit(i.session, [p.id]);
    await db.query(
      "update public.upload_intents set expires_at=now()-interval '1 hour' where id=$1",
      [p.id],
    );
    await scalar("public.queue_expired_uploads()");
    expect(
      (
        await db.query<{ storage_path: string }>(
          "select * from public.cleanup_candidates()",
        )
      ).rows.map((r) => r.storage_path),
    ).not.toContain(path);
    const abandoned = await invite();
    const ap = await reserve(abandoned.session);
    const aPath = await validate(abandoned.session, ap.id, abandoned.id);
    await db.query(
      "update public.upload_intents set expires_at=now()-interval '1 hour' where id=$1",
      [ap.id],
    );
    await scalar("public.queue_expired_uploads()");
    expect(
      (
        await db.query<{ storage_path: string }>(
          "select * from public.cleanup_candidates()",
        )
      ).rows.map((r) => r.storage_path),
    ).toContain(aPath);
  });
});

async function recipient() {
  const hash = randomUUID().replaceAll("-", "").repeat(2),
    verifier = "scrypt$synthetic-test-verifier",
    session = randomUUID();
  await role("authenticated", ADMIN);
  const id = await scalar<string>(
    "public.admin_create_recipient_link($1,$2,null)",
    [hash, verifier],
  );
  await role("service_role");
  await scalar("public.open_recipient_session($1,$2,$3)", [
    hash,
    verifier,
    session,
  ]);
  return { id, hash, verifier, session };
}
describe("M4 per-scene publication and exact geometry", () => {
  it("keeps the PostgreSQL geometry identical to the canonical TS data, including union seams", async () => {
    await role("postgres");
    const rows = await db.query<{ map_key: string; geometry: unknown }>(
      "select * from public.scene_geometry",
    );
    expect(
      Object.fromEntries(rows.rows.map((r) => [r.map_key, r.geometry])),
    ).toEqual(geometry);
    let seed = 42;
    const cases: { map: string; x: number; y: number; r: number }[] = [];
    for (const map of SCENE_KEYS) {
      for (let i = 0; i < 250; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const x = 20 + (seed % 797);
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const y = 160 + (seed % 271);
        cases.push({ map, x, y, r: [0, 8, 20, 80][i % 4] });
      }
      for (const x of [190, 230, 292, 310, 327, 385, 430, 459])
        for (const y of [332, 339, 378, 381, 384, 388, 395])
          cases.push({ map, x, y, r: 0 });
    }
    const results = await db.query<{
      map: string;
      x: number;
      y: number;
      r: number;
      safe: boolean;
    }>(
      "select t.*,public.scene_safe(t.map,t.x,t.y,t.r) as safe from jsonb_to_recordset($1::jsonb) as t(map text,x integer,y integer,r integer)",
      [JSON.stringify(cases)],
    );
    for (const row of results.rows)
      expect(row.safe, `${row.map} (${row.x},${row.y},${row.r})`).toBe(
        safePlacement(
          row.map as (typeof SCENE_KEYS)[number],
          row.x,
          row.y,
          row.r,
        ),
      );
  });
  it("publishes in exactly the assigned scene and protects messages/media across all three places", async () => {
    const i = await invite(),
      r = await recipient(),
      photo = await reserve(i.session);
    await validate(i.session, photo.id, i.id);
    const c = await submit(i.session, [photo.id]);
    await role("authenticated", ADMIN);
    const park = await scalar<string>(
      "(select id from public.areas where map_key='tuguegarao_park')",
    );
    await expect(
      scalar(
        "public.admin_place_npc($1::uuid,$2::uuid,'npc-cream-1',470,290,20,true)",
        [c, park],
      ),
    ).rejects.toThrow("Review");
    await scalar("public.admin_review_media($1::uuid,'approved')", [photo.id]);
    await scalar("public.admin_review($1::uuid,'approved',null)", [c]);
    for (const map of SCENE_KEYS) {
      await role("authenticated", ADMIN);
      const area = await scalar<string>(
        "(select id from public.areas where map_key=$1)",
        [map],
      );
      const p = SCENES[map].npc;
      await scalar(
        "public.admin_place_npc($1::uuid,$2::uuid,'npc-rose-bow',$3,$4,$5,true)",
        [c, area, p.x, p.y, p.radius],
      );
      await role("service_role");
      for (const candidate of SCENE_KEYS) {
        const data = await scalar<{ mapKey: string; npcs: { id: string }[] }>(
          "public.recipient_scene($1,$2)",
          [r.session, candidate],
        );
        expect(data.mapKey).toBe(candidate);
        expect(data.npcs.some((n) => n.id === c)).toBe(map === candidate);
      }
      expect(
        await scalar("public.recipient_message($1,$2::uuid)", [r.session, c]),
      ).toHaveProperty("id", c);
      expect(
        await scalar("public.recipient_media($1,$2::uuid)", [
          r.session,
          photo.id,
        ]),
      ).toHaveProperty("path");
    }
    await db.query(
      "update public.areas set published=false where map_key='slu_baguio'",
    );
    expect(
      (
        await scalar<{ npcs: { id: string }[] }>(
          "public.recipient_scene($1,'slu_baguio')",
          [r.session],
        )
      ).npcs.some((n) => n.id === c),
    ).toBe(false);
    await expect(
      scalar("public.recipient_media($1,$2::uuid)", [r.session, photo.id]),
    ).rejects.toThrow();
    await expect(
      scalar("public.recipient_message($1,$2::uuid)", [r.session, c]),
    ).rejects.toThrow();
  });
  it("denies anonymous/non-admin scene RPCs and unsafe stair/road publication", async () => {
    await role("anon");
    await expect(
      scalar("public.recipient_scene('guessed','slu_baguio')"),
    ).rejects.toThrow();
    await role("authenticated", OTHER);
    await expect(
      scalar("public.recipient_scene('guessed','tuguegarao_park')"),
    ).rejects.toThrow();
    await role("service_role");
    await expect(
      scalar("public.recipient_scene('guessed','sta_ana_house')"),
    ).rejects.toThrow();
    const i = await invite(),
      c = await submit(i.session);
    await role("authenticated", ADMIN);
    await scalar("public.admin_review($1::uuid,'approved',null)", [c]);
    const area = await scalar<string>(
      "(select id from public.areas where map_key='slu_baguio')",
    );
    for (const [x, y, r] of [
      [400, 420, 0],
      [310, 360, 0],
      [430, 360, 30],
    ])
      await expect(
        scalar(
          "public.admin_place_npc($1::uuid,$2::uuid,'npc-cream-1',$3,$4,$5,true)",
          [c, area, x, y, r],
        ),
      ).rejects.toThrow("Unsafe");
  });
});

describe("M3 recipient database authorization", () => {
  it("denies browser-role access to verifiers, sessions, progress and projections", async () => {
    await role("anon");
    await expect(scalar("public.recipient_house('forged')")).rejects.toThrow();
    await expect(
      scalar("public.recipient_verifier('guessed')"),
    ).rejects.toThrow();
    await expect(
      db.query("select * from public.recipient_seen"),
    ).rejects.toThrow();
    await role("authenticated", OTHER);
    await expect(
      scalar("public.admin_create_recipient_link($1,'scrypt$test',null)", [
        "0".repeat(64),
      ]),
    ).rejects.toThrow();
    await expect(
      scalar("public.recipient_message('forged',$1::uuid)", [ADMIN]),
    ).rejects.toThrow();
  });
  it("rechecks verifier, link and session expiration instead of trusting cookies", async () => {
    const r = await recipient();
    await expect(
      scalar("public.open_recipient_session($1,'wrong','forged')", [r.hash]),
    ).rejects.toThrow();
    expect(await scalar("public.active_recipient($1)", [r.session])).toBe(r.id);
    await db.query(
      "update public.recipient_sessions set expires_at=now()-interval '1 second' where session_hash=$1",
      [r.session],
    );
    await expect(
      scalar("public.recipient_house($1)", [r.session]),
    ).rejects.toThrow();
    await db.query(
      "update public.recipient_access_links set expires_at=now()-interval '1 second' where id=$1",
      [r.id],
    );
    expect(await scalar("public.recipient_verifier($1)", [r.hash])).toBeNull();
    await expect(
      scalar("public.open_recipient_session($1,$2,'another')", [
        r.hash,
        r.verifier,
      ]),
    ).rejects.toThrow();
  });
  it("projects only published approved house NPCs and explicitly approved media", async () => {
    const i = await invite(),
      r = await recipient();
    const photo = await reserve(i.session);
    await validate(i.session, photo.id, i.id);
    const c = await submit(i.session, [photo.id]);
    await expect(
      scalar("public.recipient_message($1,$2::uuid)", [r.session, c]),
    ).rejects.toThrow();
    await role("authenticated", ADMIN);
    await scalar("public.admin_review_media($1::uuid,'rejected')", [photo.id]);
    await scalar("public.admin_review($1::uuid,'approved',null)", [c]);
    const area = await scalar<string>(
      "(select id from public.areas where map_key='sta_ana_house')",
    );
    await scalar(
      "public.admin_place_npc($1::uuid,$2::uuid,'npc-cream-1',425,352,20,true)",
      [c, area],
    );
    await role("service_role");
    const house = await scalar<{ npcs: { id: string; seen: boolean }[] }>(
      "public.recipient_house($1)",
      [r.session],
    );
    expect(house.npcs.some((n) => n.id === c)).toBe(true);
    const message = await scalar<{ media: unknown[] }>(
      "public.recipient_message($1,$2::uuid)",
      [r.session, c],
    );
    expect(message.media).toEqual([]);
    await expect(
      scalar("public.recipient_media($1,$2::uuid)", [r.session, photo.id]),
    ).rejects.toThrow();
    await role("authenticated", ADMIN);
    await scalar("public.admin_review_media($1::uuid,'approved')", [photo.id]);
    await scalar(
      "public.admin_place_npc($1::uuid,$2::uuid,'npc-cream-1',425,352,20,true)",
      [c, area],
    );
    await role("service_role");
    expect(
      await scalar("public.recipient_media($1,$2::uuid)", [
        r.session,
        photo.id,
      ]),
    ).toHaveProperty("path");
    await scalar("public.recipient_mark_seen($1,$2::uuid)", [r.session, c]);
    await scalar("public.open_recipient_session($1,$2,'new-visit')", [
      r.hash,
      r.verifier,
    ]);
    const revisited = await scalar<{ npcs: { id: string; seen: boolean }[] }>(
      "public.recipient_house('new-visit')",
    );
    expect(revisited.npcs.find((n) => n.id === c)?.seen).toBe(true);
    const other = await recipient();
    expect(
      (
        await scalar<{ npcs: { id: string; seen: boolean }[] }>(
          "public.recipient_house($1)",
          [other.session],
        )
      ).npcs.find((n) => n.id === c)?.seen,
    ).toBe(false);
    await role("authenticated", ADMIN);
    await scalar("public.admin_review($1::uuid,'hidden',null)", [c]);
    await role("service_role");
    await expect(
      scalar("public.recipient_message($1,$2::uuid)", [r.session, c]),
    ).rejects.toThrow();
    await expect(
      scalar("public.recipient_media($1,$2::uuid)", [r.session, photo.id]),
    ).rejects.toThrow();
    await expect(
      scalar("public.recipient_mark_seen($1,$2::uuid)", [r.session, c]),
    ).rejects.toThrow();
  });
  it("revoking a recipient link invalidates every existing visit", async () => {
    const r = await recipient();
    await scalar("public.open_recipient_session($1,$2,'second-visit')", [
      r.hash,
      r.verifier,
    ]);
    await role("authenticated", ADMIN);
    await scalar("public.admin_revoke_recipient_link($1::uuid)", [r.id]);
    await role("service_role");
    for (const session of [r.session, "second-visit"])
      await expect(
        scalar("public.recipient_house($1)", [session]),
      ).rejects.toThrow();
    expect(await scalar("public.recipient_verifier($1)", [r.hash])).toBeNull();
  });
});

describe("M5 private finale and progress", () => {
  const content = {
    title: "Synthetic private title",
    letter: "Synthetic private finale sentinel 🌼",
    threshold: 1,
    conversation: [{ speaker: "Cj", text: "Synthetic closing hello" }],
  };
  beforeEach(async () => {
    await role("postgres");
    await db.exec(
      "update public.npc_placements set published=false; update public.finale_settings set revision=0,published=null,published_revision=null;",
    );
  });
  async function save(
    action = "publish",
    revision = 0,
    value: unknown = content,
  ) {
    await role("authenticated", ADMIN);
    await scalar("public.admin_save_finale($1::jsonb,$2,$3)", [
      JSON.stringify(value),
      revision,
      action,
    ]);
    await role("service_role");
  }
  async function approvedBear() {
    const i = await invite(),
      c = await submit(i.session);
    await role("authenticated", ADMIN);
    await scalar("public.admin_review($1::uuid,'approved',null)", [c]);
    const area = await scalar<string>(
      "(select id from public.areas where map_key='sta_ana_house')",
    );
    await scalar(
      "public.admin_place_npc($1::uuid,$2::uuid,'npc-cream-1',425,352,20,true)",
      [c, area],
    );
    await role("service_role");
    return c;
  }
  it("denies direct tables and RPCs to anonymous and non-admin identities", async () => {
    for (const who of ["anon", "authenticated"]) {
      await role(who, OTHER);
      for (const table of ["finale_settings", "recipient_finale"])
        await expect(
          db.query(`select * from public.${table}`),
        ).rejects.toThrow();
      await expect(scalar("public.admin_finale()")).rejects.toThrow();
      await expect(
        scalar("public.admin_save_finale($1::jsonb,0,'publish')", [
          JSON.stringify(content),
        ]),
      ).rejects.toThrow();
      await expect(
        scalar("public.recipient_ending('forged')"),
      ).rejects.toThrow();
      await expect(
        scalar("public.recipient_finale_status('forged')"),
      ).rejects.toThrow();
      await expect(
        scalar("public.recipient_complete_finale('forged',1)"),
      ).rejects.toThrow();
    }
  });
  it("hides drafts and refuses incomplete publication at database boundary", async () => {
    const r = await recipient();
    await save("save");
    expect(
      await scalar("public.recipient_finale_status($1)", [r.session]),
    ).toEqual({
      available: false,
      unlocked: false,
      seen: 0,
      required: 0,
      completed: false,
    });
    await expect(
      scalar("public.recipient_ending($1)", [r.session]),
    ).rejects.toThrow();
    await role("authenticated", ADMIN);
    expect(
      await scalar<{ draft: unknown }>("public.admin_finale()"),
    ).toHaveProperty("draft", content);
    await expect(
      scalar("public.admin_save_finale($1::jsonb,1,'publish')", [
        JSON.stringify({ ...content, letter: "" }),
      ]),
    ).rejects.toThrow();
    await expect(
      scalar("public.admin_save_finale($1::jsonb,1,'publish')", [
        JSON.stringify({
          ...content,
          conversation: [{ speaker: "Fake", text: "bad" }],
        }),
      ]),
    ).rejects.toThrow();
  });
  it("unlocks from eligible seen hellos and persists completion across sessions", async () => {
    const c = await approvedBear(),
      r = await recipient();
    await save();
    expect(
      await scalar("public.recipient_finale_status($1)", [r.session]),
    ).toMatchObject({ unlocked: false, seen: 0, required: 1 });
    await expect(
      scalar("public.recipient_ending($1)", [r.session]),
    ).rejects.toThrow();
    await expect(
      scalar("public.recipient_complete_finale($1,1)", [r.session]),
    ).rejects.toThrow();
    await scalar("public.recipient_mark_seen($1,$2::uuid)", [r.session, c]);
    expect(await scalar("public.recipient_ending($1)", [r.session])).toEqual({
      revision: 1,
      content,
    });
    await scalar("public.recipient_complete_finale($1,1)", [r.session]);
    await scalar("public.recipient_complete_finale($1,1)", [r.session]);
    const second = randomUUID();
    await scalar("public.open_recipient_session($1,$2,$3)", [
      r.hash,
      r.verifier,
      second,
    ]);
    expect(
      await scalar("public.recipient_finale_status($1)", [second]),
    ).toMatchObject({ completed: true });
    const other = await recipient();
    expect(
      await scalar("public.recipient_finale_status($1)", [other.session]),
    ).toMatchObject({ unlocked: false, seen: 0, completed: false });
  });
  it("caps the threshold at the published cast instead of awaiting every invitation", async () => {
    const c = await approvedBear();
    await invite();
    const r = await recipient();
    await save("publish", 0, { ...content, threshold: 50 });
    expect(
      await scalar("public.recipient_finale_status($1)", [r.session]),
    ).toMatchObject({ required: 1, unlocked: false });
    await scalar("public.recipient_mark_seen($1,$2::uuid)", [r.session, c]);
    expect(
      await scalar("public.recipient_finale_status($1)", [r.session]),
    ).toMatchObject({ unlocked: true });
  });
  it("supports immediate entry with zero published contributors", async () => {
    const r = await recipient();
    await save("publish", 0, { ...content, threshold: 50 });
    expect(
      await scalar("public.recipient_finale_status($1)", [r.session]),
    ).toMatchObject({ required: 0, unlocked: true });
  });
  it("keeps published text unchanged on draft save, rejects stale writes and old completion", async () => {
    const r = await recipient();
    await save();
    await save("save", 1, { ...content, letter: "Different draft sentinel" });
    expect(await scalar("public.recipient_ending($1)", [r.session])).toEqual({
      revision: 1,
      content,
    });
    await role("authenticated", ADMIN);
    await expect(
      scalar("public.admin_save_finale($1::jsonb,1,'publish')", [
        JSON.stringify(content),
      ]),
    ).rejects.toThrow("changed");
    await save("publish", 2, {
      ...content,
      letter: "New published synthetic letter",
    });
    await expect(
      scalar("public.recipient_complete_finale($1,1)", [r.session]),
    ).rejects.toThrow("changed");
    expect(
      await scalar("public.recipient_ending($1)", [r.session]),
    ).toHaveProperty("revision", 3);
  });
  it("denies unpublished, expired and revoked finale reads and writes", async () => {
    const r = await recipient();
    await save();
    await save("unpublish", 1, null);
    await expect(
      scalar("public.recipient_ending($1)", [r.session]),
    ).rejects.toThrow();
    await expect(
      scalar("public.recipient_complete_finale($1,1)", [r.session]),
    ).rejects.toThrow();
    await save("publish", 2);
    await db.query(
      "update public.recipient_sessions set expires_at=now()-interval '1 second' where session_hash=$1",
      [r.session],
    );
    await expect(
      scalar("public.recipient_finale_status($1)", [r.session]),
    ).rejects.toThrow();
    await db.query(
      "update public.recipient_sessions set expires_at=now()+interval '1 hour' where session_hash=$1",
      [r.session],
    );
    await role("authenticated", ADMIN);
    await scalar("public.admin_revoke_recipient_link($1::uuid)", [r.id]);
    await role("service_role");
    await expect(
      scalar("public.recipient_ending($1)", [r.session]),
    ).rejects.toThrow();
    await expect(
      scalar("public.recipient_complete_finale($1,3)", [r.session]),
    ).rejects.toThrow();
  });
});

describe("Returning contributors", () => {
  it("edits only the owned letter, rejects stale versions, and withdraws publication for review", async () => {
    const owner = await invite(),
      stranger = await invite();
    const id = await submit(owner.session);
    await role("postgres");
    await db.query(
      "update public.contributions set status='approved' where id=$1",
      [id],
    );
    const area = await scalar<string>("(select id from public.areas limit 1)");
    await db.query(
      "insert into public.npc_placements(contribution_id,area_id,spawn_x,spawn_y,published) values($1,$2,100,100,true)",
      [id, area],
    );
    await role("service_role");
    const snapshot = await scalar<{
      letter: { message: string; version: string };
    }>("public.contributor_snapshot($1)", [owner.session]);
    expect(snapshot.letter.message).toContain("Synthetic hello");
    expect(
      await scalar("public.contributor_snapshot($1)->'letter'", [
        stranger.session,
      ]),
    ).toBeNull();
    await expect(
      scalar("public.edit_contribution($1,'Forged',$2)", [
        stranger.session,
        snapshot.letter.version,
      ]),
    ).rejects.toThrow();
    await scalar("public.edit_contribution($1,'Updated synthetic letter',$2)", [
      owner.session,
      snapshot.letter.version,
    ]);
    expect(
      await scalar(
        "(select status::text from public.contributions where id=$1)",
        [id],
      ),
    ).toBe("pending");
    expect(
      await scalar(
        "(select published from public.npc_placements where contribution_id=$1)",
        [id],
      ),
    ).toBe(false);
    await expect(
      scalar("public.edit_contribution($1,'Stale overwrite',$2)", [
        owner.session,
        snapshot.letter.version,
      ]),
    ).rejects.toThrow("changed");
    await role("authenticated", ADMIN);
    await scalar("public.admin_revoke_invite($1)", [owner.id]);
    await role("service_role");
    await expect(
      scalar("public.edit_contribution($1,'Revoked',$2)", [
        owner.session,
        snapshot.letter.version,
      ]),
    ).rejects.toThrow("unavailable");
  });
  it("issues and replaces recoverable links only for an allowlisted admin, preserving the letter", async () => {
    const id = randomUUID();
    const issue = () =>
      scalar(
        "public.admin_issue_invite($1,'new-hash',$2,'Synthetic',null,false)",
        [id, "x".repeat(80)],
      );
    await role("anon");
    await expect(issue()).rejects.toThrow();
    await role("authenticated", OTHER);
    await expect(issue()).rejects.toThrow("Admin required");
    await role("authenticated", ADMIN);
    await issue();
    await role("service_role");
    await scalar(
      "public.exchange_invitation('new-hash','recoverable-session')",
    );
    const letter = await submit("recoverable-session");
    await role("authenticated", ADMIN);
    await scalar(
      "public.admin_issue_invite($1,'replacement-hash',$2,null,null,true)",
      [id, "y".repeat(80)],
    );
    await role("service_role");
    expect(
      await scalar("public.active_contributor('recoverable-session')"),
    ).toBeNull();
    await expect(
      scalar("public.exchange_invitation('new-hash','old')"),
    ).rejects.toThrow("unavailable");
    await scalar("public.exchange_invitation('replacement-hash','new')");
    expect(
      await scalar(
        "(select id from public.contributions where invitation_id=$1)",
        [id],
      ),
    ).toBe(letter);
    await role("authenticated", ADMIN);
    await scalar("public.admin_revoke_invite($1)", [id]);
    await expect(
      scalar("public.admin_issue_invite($1,'revived',$2,null,null,true)", [
        id,
        "z".repeat(80),
      ]),
    ).rejects.toThrow("unavailable");
  });
});

describe("Contributor visit privacy and designation", () => {
  it("requires submission and shares published bear names without letters or pending contributors", async () => {
    const owner = await invite(false, "Synthetic Visitor");
    await expect(
      scalar("public.contributor_visit($1)", [owner.session]),
    ).rejects.toThrow("Submit your letter first");
    await role("anon");
    await expect(
      scalar("public.contributor_visit($1)", [owner.session]),
    ).rejects.toThrow();
    await role("authenticated", OTHER);
    await expect(
      scalar("public.admin_set_invite_place($1,'slu_baguio')", [owner.id]),
    ).rejects.toThrow("Admin required");
    await role("authenticated", ADMIN);
    await scalar("public.admin_set_invite_place($1,'slu_baguio')", [owner.id]);
    await role("service_role");
    const own = await submit(owner.session);
    const friend = await invite(false, "Private friend name"),
      pending = await invite(false, "Pending private name");
    const friendId = await submit(friend.session),
      pendingId = await submit(pending.session);
    await role("authenticated", ADMIN);
    const slu = await scalar<string>(
      "(select id from public.areas where map_key='slu_baguio')",
    );
    await scalar("public.admin_review($1,'approved',null)", [friendId]);
    await scalar(
      "public.admin_place_npc($1,$2,'npc-rose-bow',430,360,12,true)",
      [friendId, slu],
    );
    await scalar(
      "public.admin_place_npc($1,$2,'npc-brown-scarf',410,360,12,false)",
      [own, slu],
    );
    await role("postgres");
    await db.query(
      "insert into public.npc_placements(contribution_id,area_id,spawn_x,spawn_y,wander_radius,published) values($1,$2,430,360,12,true)",
      [pendingId, slu],
    );
    await role("service_role");
    const view = await scalar<{
      mapKey: string;
      visitor: { name: string; variant: string };
      npcs: { id: string; name: string }[];
    }>("public.contributor_visit($1)", [owner.session]);
    expect(view.mapKey).toBe("slu_baguio");
    expect(view.visitor).toEqual({
      name: "Synthetic Visitor",
      variant: "npc-brown-scarf",
    });
    const published = await scalar<string>(
      "(select id from public.npc_placements where contribution_id=$1)",
      [friendId],
    );
    const unpublished = await scalar<string>(
      "(select id from public.npc_placements where contribution_id=$1)",
      [pendingId],
    );
    expect(view.npcs).toContainEqual(
      expect.objectContaining({ id: published, name: "Private friend name" }),
    );
    expect(view.npcs.some((n) => n.id === unpublished)).toBe(false);
    expect(JSON.stringify(view)).not.toContain("Pending private name");
    expect(JSON.stringify(view)).not.toContain(friendId);
    expect(JSON.stringify(view)).not.toContain("Synthetic hello");
    await expect(
      scalar("public.recipient_scene($1,'slu_baguio')", [owner.session]),
    ).rejects.toThrow();
    await expect(
      scalar("public.recipient_message($1,$2)", [owner.session, friendId]),
    ).rejects.toThrow();
    await role("authenticated", ADMIN);
    await scalar("public.admin_set_invite_place($1,'tuguegarao_park')", [
      owner.id,
    ]);
    await role("service_role");
    expect(
      await scalar("public.contributor_visit($1)->>'mapKey'", [owner.session]),
    ).toBe("tuguegarao_park");
    expect(
      await scalar(
        "(select published from public.npc_placements where contribution_id=$1)",
        [own],
      ),
    ).toBe(false);
    await role("authenticated", ADMIN);
    await scalar("public.admin_revoke_invite($1)", [owner.id]);
    await role("service_role");
    await expect(
      scalar("public.contributor_visit($1)", [owner.session]),
    ).rejects.toThrow("unavailable");
  });
  it("rolls back a new invite with an invalid place and synchronizes detailed NPC assignments", async () => {
    const id = randomUUID();
    await role("authenticated", ADMIN);
    await expect(
      scalar(
        "public.admin_issue_designated_invite($1,'synthetic',$2,'Fixture',null,'unknown')",
        [id, "x".repeat(80)],
      ),
    ).rejects.toThrow("Unknown place");
    expect(
      await scalar("exists(select 1 from public.invitations where id=$1)", [
        id,
      ]),
    ).toBe(false);
    const owner = await invite();
    const own = await submit(owner.session);
    await role("authenticated", ADMIN);
    const park = await scalar<string>(
      "(select id from public.areas where map_key='tuguegarao_park')",
    );
    await scalar(
      "public.admin_place_npc($1,$2,'npc-cream-1',470,290,20,false)",
      [own, park],
    );
    expect(
      await scalar(
        "(select assigned_map from public.invitations where id=$1)",
        [owner.id],
      ),
    ).toBe("tuguegarao_park");
  });
});

describe("Rich media revisions", () => {
  async function snapshot(session: string) {
    return scalar<{
      letter: {
        message: string;
        version: string;
        media: { id: string; status: string; description: string }[];
      };
    }>("public.contributor_snapshot($1)", [session]);
  }
  const edit = (
    session: string,
    version: string,
    kept: { id: string; description: string }[],
    added: string[],
  ) =>
    scalar(
      "public.edit_contribution_media($1,'Revised memories',$2,$3::jsonb,$4::uuid[])",
      [session, version, JSON.stringify(kept), added],
    );
  it("atomically replaces saved photos and audio, queues removals, and returns updates for review", async () => {
    const own = await invite();
    const photo = await reserve(own.session),
      audio = await reserve(own.session, "audio"),
      keep = await reserve(own.session);
    const oldPath = await validate(own.session, photo.id, own.id);
    await scalar("public.validate_upload($1,$2,$3,'audio/mpeg',123,1000)", [
      own.session,
      audio.id,
      `validated/${own.id}/${audio.id}/old.mp3`,
    ]);
    await validate(own.session, keep.id, own.id);
    const parent = await submit(own.session, [photo.id, audio.id, keep.id]);
    await role("authenticated", ADMIN);
    for (const id of [photo.id, audio.id, keep.id])
      await scalar("public.admin_review_media($1,'approved')", [id]);
    await scalar("public.admin_review($1,'approved',null)", [parent]);
    const area = await scalar<string>(
      "(select id from public.areas where map_key='sta_ana_house')",
    );
    await scalar(
      "public.admin_place_npc($1,$2,'npc-brown-scarf',425,352,20,true)",
      [parent, area],
    );
    await role("service_role");
    const before = await snapshot(own.session);
    expect(before.letter.media).toHaveLength(3);
    const replacement = await reserve(own.session),
      voice = await reserve(own.session, "audio");
    await validate(own.session, replacement.id, own.id);
    await scalar("public.validate_upload($1,$2,$3,'audio/mpeg',123,1000)", [
      own.session,
      voice.id,
      `validated/${own.id}/${voice.id}/new.mp3`,
    ]);
    await edit(
      own.session,
      before.letter.version,
      [{ id: keep.id, description: "Updated caption" }],
      [replacement.id, voice.id],
    );
    const after = await snapshot(own.session);
    expect(after.letter.media.map((m) => m.id).sort()).toEqual(
      [keep.id, replacement.id, voice.id].sort(),
    );
    expect(after.letter.media.every((m) => m.status === "pending")).toBe(true);
    expect(after.letter.media.find((m) => m.id === keep.id)?.description).toBe(
      "Updated caption",
    );
    expect(
      await scalar(
        "(select status::text from public.contributions where id=$1)",
        [parent],
      ),
    ).toBe("pending");
    expect(
      await scalar(
        "(select published from public.npc_placements where contribution_id=$1)",
        [parent],
      ),
    ).toBe(false);
    expect(
      await scalar(
        "(select count(*) from public.storage_cleanup where storage_path=$1)",
        [oldPath],
      ),
    ).toBe(1);
    expect(
      await scalar(
        "(select state::text from public.upload_intents where id=$1)",
        [photo.id],
      ),
    ).toBe("deleted");
    await expect(
      edit(own.session, before.letter.version, [], []),
    ).rejects.toThrow("changed");
    await role("authenticated", ADMIN);
    await scalar("public.admin_review_media($1,'rejected')", [keep.id]);
    await role("service_role");
    const current = await snapshot(own.session);
    await edit(
      own.session,
      current.letter.version,
      current.letter.media.map((m) => ({
        id: m.id,
        description: m.id === keep.id ? "Changed again" : m.description,
      })),
      [],
    );
    expect(
      (await snapshot(own.session)).letter.media.find((m) => m.id === keep.id)
        ?.status,
    ).toBe("rejected");
  });
  it("rejects foreign, duplicate, unfinished, expired, excess and revoked revisions without deleting originals", async () => {
    const own = await invite(),
      stranger = await invite();
    await role("service_role");
    const original = await reserve(own.session);
    await validate(own.session, original.id, own.id);
    await submit(own.session, [original.id]);
    const foreign = await reserve(stranger.session);
    await validate(stranger.session, foreign.id, stranger.id);
    await submit(stranger.session, [foreign.id]);
    const draft = await reserve(own.session);
    const before = await snapshot(own.session),
      kept = [{ id: original.id, description: "Synthetic attachment" }];
    await expect(
      edit(
        own.session,
        before.letter.version,
        [{ id: foreign.id, description: "" }],
        [],
      ),
    ).rejects.toThrow("unavailable");
    await expect(
      edit(own.session, before.letter.version, [], [foreign.id]),
    ).rejects.toThrow("unavailable");
    await expect(
      edit(own.session, before.letter.version, [...kept, ...kept], []),
    ).rejects.toThrow("Invalid");
    await expect(
      edit(own.session, before.letter.version, [], [draft.id]),
    ).rejects.toThrow("unavailable");
    await validate(own.session, draft.id, own.id);
    await db.query(
      "update public.upload_intents set expires_at=now()-interval '1 second' where id=$1",
      [draft.id],
    );
    await expect(
      edit(own.session, before.letter.version, [], [draft.id]),
    ).rejects.toThrow("unavailable");
    const more = [];
    for (let n = 0; n < 3; n++) {
      const p = await reserve(own.session);
      await validate(own.session, p.id, own.id);
      more.push(p.id);
    }
    await expect(
      edit(own.session, before.letter.version, kept, more),
    ).rejects.toThrow("limit");
    expect((await snapshot(own.session)).letter).toEqual(before.letter);
    await role("anon");
    await expect(
      edit(own.session, before.letter.version, [], []),
    ).rejects.toThrow();
    await role("authenticated", ADMIN);
    await scalar("public.admin_revoke_invite($1)", [own.id]);
    await role("service_role");
    await expect(
      edit(own.session, before.letter.version, [], []),
    ).rejects.toThrow("unavailable");
  });
});

describe("Opt-in shared letters", () => {
  async function shared(session: string, share: boolean) {
    return scalar<string>(
      "public.submit_shared_contribution($1,'Synthetic shared words','{}'::uuid[],$2)",
      [session, share],
    );
  }
  async function publish(id: string) {
    await role("authenticated", ADMIN);
    await scalar("public.admin_review($1,'approved',null)", [id]);
    const area = await scalar<string>(
      "(select id from public.areas where map_key='sta_ana_house')",
    );
    await scalar(
      "public.admin_place_npc($1,$2,'npc-cream-1',425,352,12,true)",
      [id, area],
    );
    await role("service_role");
    return scalar<string>(
      "(select id from public.npc_placements where contribution_id=$1)",
      [id],
    );
  }
  const read = (session: string, id: string) =>
    scalar<{ id: string; name: string; message: string }>(
      "public.contributor_shared_message($1,$2)",
      [session, id],
    );
  it("defaults legacy letters to private and exposes only opted-in approved text to submitted same-scene invitees", async () => {
    const owner = await invite(),
      privateFriend = await invite(),
      friend = await invite(),
      waiting = await invite();
    const legacy = await submit(privateFriend.session);
    const source = await shared(friend.session, true);
    expect(
      await scalar(
        "(select share_with_invitees from public.contributions where id=$1)",
        [legacy],
      ),
    ).toBe(false);
    const place = await publish(source),
      privatePlace = await publish(legacy);
    await expect(read(owner.session, place)).rejects.toThrow(
      "Submit your letter first",
    );
    await submit(owner.session);
    const message = await read(owner.session, place);
    expect(message).toEqual({
      id: place,
      name: "Synthetic invite",
      message: "Synthetic shared words",
    });
    expect(Object.keys(message).sort()).toEqual(["id", "message", "name"]);
    await expect(read(owner.session, privatePlace)).rejects.toThrow(
      "unavailable",
    );
    const scene = await scalar<{ npcs: { id: string; readable: boolean }[] }>(
      "public.contributor_visit($1)",
      [owner.session],
    );
    expect(scene.npcs.find((n) => n.id === place)?.readable).toBe(true);
    expect(scene.npcs.find((n) => n.id === privatePlace)?.readable).toBe(false);
    await expect(read(waiting.session, place)).rejects.toThrow();
    await role("authenticated", ADMIN);
    await scalar("public.admin_set_invite_place($1,'slu_baguio')", [owner.id]);
    await role("service_role");
    await expect(read(owner.session, place)).rejects.toThrow("unavailable");
    await role("anon");
    await expect(read(friend.session, place)).rejects.toThrow();
    await role("authenticated", OTHER);
    await expect(read(friend.session, place)).rejects.toThrow();
  });
  it("withdraws sharing atomically, preserves it for old-client edits, and requires renewed moderation after updates", async () => {
    const reader = await invite(),
      friend = await invite();
    await submit(reader.session);
    const source = await shared(friend.session, true);
    let place = await publish(source);
    const version = await scalar<string>(
      "public.contributor_snapshot($1)->'letter'->>'version'",
      [friend.session],
    );
    await scalar(
      "public.edit_shared_contribution($1,'New private words',$2,'[]'::jsonb,'{}'::uuid[],false)",
      [friend.session, version],
    );
    expect(
      await scalar(
        "public.contributor_snapshot($1)->'letter'->>'shareWithInvitees'",
        [friend.session],
      ),
    ).toBe("false");
    expect(
      await scalar(
        "(select sharing_consent_at from public.contributions where id=$1)",
        [source],
      ),
    ).toBeNull();
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    await expect(
      scalar(
        "public.edit_shared_contribution($1,'Stale opt-in',$2,null,null,true)",
        [friend.session, version],
      ),
    ).rejects.toThrow("changed");
    place = await publish(source);
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    const current = await scalar<string>(
      "public.contributor_snapshot($1)->'letter'->>'version'",
      [friend.session],
    );
    await scalar(
      "public.edit_shared_contribution($1,'Sharing again',$2,null,null,true)",
      [friend.session, current],
    );
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    place = await publish(source);
    expect((await read(reader.session, place)).message).toBe("Sharing again");
    const next = await scalar<string>(
      "public.contributor_snapshot($1)->'letter'->>'version'",
      [friend.session],
    );
    await scalar("public.edit_contribution($1,'Old client edit',$2)", [
      friend.session,
      next,
    ]);
    expect(
      await scalar(
        "(select share_with_invitees from public.contributions where id=$1)",
        [source],
      ),
    ).toBe(true);
    await expect(read(reader.session, place)).rejects.toThrow();
  });
  it("denies opted-in content after moderation, placement, area, safety, expiry or session access changes", async () => {
    const reader = await invite(),
      friend = await invite();
    await submit(reader.session);
    const source = await shared(friend.session, true);
    const place = await publish(source);
    for (const status of ["pending", "hidden", "rejected"]) {
      await role("postgres");
      await db.query(
        "update public.contributions set status=$1::public.moderation_status where id=$2",
        [status, source],
      );
      await role("service_role");
      await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    }
    await publish(source);
    await role("postgres");
    await db.query(
      "update public.npc_placements set published=false where id=$1",
      [place],
    );
    await role("service_role");
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    await publish(source);
    await role("postgres");
    await db.query(
      "update public.areas set published=false where map_key='sta_ana_house'",
    );
    await role("service_role");
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    await role("postgres");
    await db.query(
      "update public.areas set published=true where map_key='sta_ana_house'",
    );
    await db.query("update public.npc_placements set spawn_x=0 where id=$1", [
      place,
    ]);
    await role("service_role");
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    await publish(source);
    await role("postgres");
    await db.query(
      "update public.invitations set expires_at=now()-interval '1 second' where id=$1",
      [friend.id],
    );
    await role("service_role");
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    await role("postgres");
    await db.query(
      "update public.invitations set expires_at=null,revoked_at=now() where id=$1",
      [friend.id],
    );
    await role("service_role");
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
    await role("authenticated", ADMIN);
    await scalar("public.admin_revoke_invite($1)", [reader.id]);
    await role("service_role");
    await expect(read(reader.session, place)).rejects.toThrow("unavailable");
  });
});
