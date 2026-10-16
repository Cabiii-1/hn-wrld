import { beforeAll, afterAll, afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isSafeHousePlacement } from "../src/lib/backend/contracts";

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
async function invite(expired = false) {
  await role("authenticated", ADMIN);
  const token = randomUUID(),
    session = randomUUID();
  const id = await scalar<string>("public.admin_create_invite($1,$2,null)", [
    token,
    "Synthetic invite",
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
    await expect(
      scalar("public.exchange_invitation($1,'used')", [used.token]),
    ).rejects.toThrow("unavailable");
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
  it("caps the lifetime upload budget even after discarded reservations", async () => {
    const i = await invite();
    for (let n = 0; n < 24; n++) {
      const p = await reserve(i.session);
      await scalar("public.discard_upload($1,$2::uuid)", [i.session, p.id]);
    }
    await expect(reserve(i.session)).rejects.toThrow("quota");
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
  it("rejects unsafe and unverified-scene publication, matching TS house geometry", async () => {
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
    await expect(
      scalar(
        "public.admin_place_npc($1::uuid,$2::uuid,'npc-brown-scarf',425,352,20,true)",
        [c, park],
      ),
    ).rejects.toThrow("not yet verified");
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
