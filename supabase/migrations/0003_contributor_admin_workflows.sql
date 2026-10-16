-- M2: application writes are atomic RPCs; browser roles cannot write tables.
-- Keep 0001/0002 intact for existing installations. All elevated functions use
-- a fixed search_path and explicit role grants. No recipient API in this phase.
update public.areas set name='Sta. Ana House', map_key='sta_ana_house' where slug='sta-ana';
update public.areas set name='Tuguegarao Park', map_key='tuguegarao_park' where slug='tuguegarao';
update public.areas set name='SLU Baguio', map_key='slu_baguio' where slug='baguio';

-- Existing radius 0..12 was a tile count; M2 consistently uses world pixels.
alter table public.npc_placements drop constraint npc_placements_wander_radius_check;
alter table public.npc_placements add constraint npc_wander_pixels check (wander_radius between 0 and 80);
alter table public.npc_placements alter column wander_radius set default 20;
alter table public.contributions add column submitted_at timestamptz not null default now();
alter table public.contributions add column consent_at timestamptz not null default now();
alter table public.contribution_media add column reviewed_at timestamptz;

create table public.upload_intents (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id),
  kind public.media_kind not null,
  state text not null default 'allocated' check (state in ('allocated','validated','rejected','attached','deleted')),
  declared_bytes bigint not null check (declared_bytes > 0 and declared_bytes <= 15728640),
  original_extension text not null,
  declared_mime text not null,
  staging_path text not null unique,
  final_path text unique,
  final_mime text,
  final_bytes bigint,
  duration_ms integer,
  description text not null default '' check (char_length(description) <= 300),
  expires_at timestamptz not null default now() + interval '3 hours',
  created_at timestamptz not null default now()
);
create index upload_intents_by_invitation on public.upload_intents(invitation_id);
create table public.rate_limits (
  key_hash text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
create table public.storage_cleanup (
  storage_path text primary key,
  not_before timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.upload_intents enable row level security;
alter table public.rate_limits enable row level security;
alter table public.storage_cleanup enable row level security;

create function public.is_world_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_members where user_id = (select auth.uid()));
$$;
revoke all on function public.is_world_admin() from public, anon;
grant execute on function public.is_world_admin() to authenticated, service_role;
create policy admin_self on public.admin_members for select to authenticated using (user_id = (select auth.uid()));
create policy admin_areas on public.areas for select to authenticated using ((select public.is_world_admin()));
create policy admin_invitations on public.invitations for select to authenticated using ((select public.is_world_admin()));
create policy admin_contributions on public.contributions for select to authenticated using ((select public.is_world_admin()));
create policy admin_media on public.contribution_media for select to authenticated using ((select public.is_world_admin()));
create policy admin_placements on public.npc_placements for select to authenticated using ((select public.is_world_admin()));
-- Explicit privileges as well as RLS: authenticated users get read-only policies.
revoke all on public.areas,public.admin_members,public.invitations,public.contributions,
  public.contribution_media,public.npc_placements,public.contributor_sessions,
  public.recipient_sessions,public.recipient_access_links,public.upload_intents,
  public.rate_limits,public.storage_cleanup from anon,authenticated;
grant select on public.areas,public.admin_members,public.invitations,public.contributions,
  public.contribution_media,public.npc_placements to authenticated;
grant all on public.areas,public.admin_members,public.invitations,public.contributions,
  public.contribution_media,public.npc_placements,public.contributor_sessions,
  public.recipient_sessions,public.recipient_access_links,public.upload_intents,
  public.rate_limits,public.storage_cleanup to service_role;

create function public.consume_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_limit < 1 or p_seconds < 1 then raise exception 'Invalid rate configuration'; end if;
  insert into public.rate_limits(key_hash,window_start,attempts) values (p_key,now(),1)
  on conflict(key_hash) do update set
    attempts = case when public.rate_limits.window_start <= now()-make_interval(secs=>p_seconds) then 1 else public.rate_limits.attempts+1 end,
    window_start = case when public.rate_limits.window_start <= now()-make_interval(secs=>p_seconds) then now() else public.rate_limits.window_start end
  returning attempts into v_count;
  return v_count <= p_limit;
end $$;

create function public.active_contributor(p_session_hash text) returns uuid
language sql volatile security definer set search_path = '' as $$
  select i.id from public.contributor_sessions s join public.invitations i on i.id=s.invitation_id
  where s.session_hash=p_session_hash and s.revoked_at is null and s.expires_at>now()
    and i.revoked_at is null and (i.expires_at is null or i.expires_at>now());
$$;

create function public.exchange_invitation(p_token_hash text,p_session_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i public.invitations; s uuid;
begin
  select * into i from public.invitations where token_hash=p_token_hash for update;
  if not found or i.revoked_at is not null or (i.expires_at is not null and i.expires_at<=now())
    or (select count(*) from public.contributions where invitation_id=i.id)>=i.max_submissions
    then raise exception 'Invitation unavailable' using errcode='P0001'; end if;
  -- Rotation invalidates old browser sessions, and prevents unbounded session rows.
  update public.contributor_sessions set revoked_at=now() where invitation_id=i.id and revoked_at is null;
  insert into public.contributor_sessions(invitation_id,session_hash,expires_at)
  values(i.id,p_session_hash,least(coalesce(i.expires_at,now()+interval '2 hours'),now()+interval '2 hours')) returning id into s;
  return s;
end $$;

create function public.contributor_snapshot(p_session_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  return jsonb_build_object('submitted',exists(select 1 from public.contributions where invitation_id=v_id),
    'uploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'description',description))
      from public.upload_intents where invitation_id=v_id and state in ('allocated','validated') and expires_at>now()),'[]'::jsonb));
end $$;

create function public.reserve_upload(p_session_hash text,p_id uuid,p_kind public.media_kind,p_bytes bigint,
  p_extension text,p_mime text,p_description text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_path text;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  perform 1 from public.invitations where id=v_id for update;
  if public.active_contributor(p_session_hash) is distinct from v_id then raise exception 'Session unavailable'; end if;
  if exists(select 1 from public.contributions where invitation_id=v_id) then raise exception 'Already submitted'; end if;
  if (select count(*) from public.upload_intents where invitation_id=v_id)>=24 then raise exception 'Invitation upload quota reached'; end if;
  if p_bytes < 1 or p_bytes > (case when p_kind='photo' then 5242880 else 15728640 end) then raise exception 'File too large'; end if;
  if (select count(*) from public.upload_intents where invitation_id=v_id and kind=p_kind
    and state in ('allocated','validated') and expires_at>now()) >= (case when p_kind='photo' then 3 else 1 end)
    then raise exception 'Attachment limit reached'; end if;
  v_path:='staging/'||v_id::text||'/'||p_id::text;
  insert into public.upload_intents(id,invitation_id,kind,declared_bytes,original_extension,declared_mime,staging_path,description)
  values(p_id,v_id,p_kind,p_bytes,p_extension,p_mime,v_path,p_description);
  -- A signed upload token is valid for 2h even after revoke. Wait beyond that to clean staging.
  insert into public.storage_cleanup(storage_path,not_before) values(v_path,now()+interval '3 hours');
  return v_path;
end $$;

create function public.validate_upload(p_session_hash text,p_id uuid,p_path text,p_mime text,p_bytes bigint,p_duration integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; u public.upload_intents;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  perform 1 from public.invitations where id=v_id for update;
  if public.active_contributor(p_session_hash) is distinct from v_id then raise exception 'Session unavailable'; end if;
  select * into u from public.upload_intents where id=p_id and invitation_id=v_id for update;
  if not found or u.state<>'allocated' or u.expires_at<=now() then raise exception 'Upload unavailable'; end if;
  if p_path not like 'validated/'||v_id::text||'/'||p_id::text||'/%' then raise exception 'Invalid path'; end if;
  if (u.kind='photo' and (p_mime<>'image/webp' or p_duration is not null or p_bytes>5242880))
    or (u.kind='audio' and (p_mime not in ('audio/mpeg','audio/mp4','audio/ogg','audio/webm') or p_duration is null or p_duration<=0 or p_duration>90000))
    or p_bytes<=0 or p_bytes>15728640 then raise exception 'Invalid media'; end if;
  update public.upload_intents set state='validated',final_path=p_path,final_mime=p_mime,final_bytes=p_bytes,duration_ms=p_duration where id=p_id;
end $$;

create function public.discard_upload(p_session_hash text,p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; u public.upload_intents;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  perform 1 from public.invitations where id=v_id for update;
  if public.active_contributor(p_session_hash) is distinct from v_id then raise exception 'Session unavailable'; end if;
  select * into u from public.upload_intents where id=p_id and invitation_id=v_id for update;
  if not found or u.state not in ('allocated','validated','rejected') then raise exception 'Upload unavailable'; end if;
  if u.final_path is not null then insert into public.storage_cleanup(storage_path) values(u.final_path) on conflict do nothing; end if;
  update public.upload_intents set state='deleted' where id=p_id;
end $$;

create function public.submit_contribution(p_session_hash text,p_name text,p_relationship text,p_message text,p_upload_ids uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; i public.invitations; c uuid;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  select * into i from public.invitations where id=v_id for update;
  if public.active_contributor(p_session_hash) is distinct from v_id then raise exception 'Session unavailable'; end if;
  if (select count(*) from public.contributions where invitation_id=v_id)>=i.max_submissions then raise exception 'Already submitted'; end if;
  if char_length(trim(p_name)) not between 1 and 80 or char_length(trim(p_message)) not between 1 and 2000
    or char_length(coalesce(p_relationship,''))>80 then raise exception 'Invalid contribution'; end if;
  if cardinality(p_upload_ids)>4 or cardinality(p_upload_ids)<>(select count(distinct x) from unnest(p_upload_ids) x)
    then raise exception 'Invalid attachments'; end if;
  perform 1 from public.upload_intents where id=any(p_upload_ids) order by id for update;
  if (select count(*) from public.upload_intents where id=any(p_upload_ids) and invitation_id=v_id and state='validated' and expires_at>now())<>cardinality(p_upload_ids)
    or (select count(*) from public.upload_intents where id=any(p_upload_ids) and kind='photo')>3
    or (select count(*) from public.upload_intents where id=any(p_upload_ids) and kind='audio')>1 then raise exception 'Invalid attachments'; end if;
  insert into public.contributions(invitation_id,display_name,relationship_label,message_text)
    values(v_id,trim(p_name),nullif(trim(p_relationship),''),trim(p_message)) returning id into c;
  insert into public.contribution_media(id,contribution_id,kind,storage_path,media_type,file_size_bytes,duration_ms,description)
    select id,c,kind,final_path,final_mime,final_bytes,duration_ms,description from public.upload_intents where id=any(p_upload_ids);
  update public.upload_intents set state='attached' where id=any(p_upload_ids);
  return c;
end $$;

create function public.admin_create_invite(p_hash text,p_label text,p_expires timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if char_length(p_label) not between 1 and 80 or (p_expires is not null and p_expires<=now()) then raise exception 'Invalid invitation'; end if;
  insert into public.invitations(token_hash,label,expires_at) values(p_hash,p_label,p_expires) returning id into v_id;
  return v_id;
end $$;

create function public.admin_revoke_invite(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  update public.invitations set revoked_at=coalesce(revoked_at,now()) where id=p_id;
  update public.contributor_sessions set revoked_at=now() where invitation_id=p_id;
end $$;

create function public.admin_review(p_id uuid,p_status public.moderation_status,p_message text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_status='pending' or (p_message is not null and char_length(trim(p_message)) not between 1 and 2000) then raise exception 'Invalid review'; end if;
  perform 1 from public.contributions where id=p_id for update;
  if not found then raise exception 'Contribution unavailable'; end if;
  -- All attachment decisions must be explicit before approving the message.
  if p_status='approved' and exists(select 1 from public.contribution_media where contribution_id=p_id and status='pending') then raise exception 'Review every attachment first'; end if;
  update public.contributions set status=p_status,message_text=coalesce(trim(p_message),message_text),updated_at=now() where id=p_id;
  update public.npc_placements set published=false where contribution_id=p_id;
end $$;

create function public.admin_review_media(p_id uuid,p_status public.media_status) returns void
language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid media review'; end if;
  select contribution_id into c from public.contribution_media where id=p_id;
  if not found then raise exception 'Media unavailable'; end if;
  perform 1 from public.contributions where id=c for update;
  update public.contribution_media set status=p_status,reviewed_at=now(),updated_at=now() where id=p_id and status<>'deleted';
  if not found then raise exception 'Media unavailable'; end if;
  update public.npc_placements set published=false where contribution_id=c;
end $$;

create function public.admin_delete_media(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select contribution_id into c from public.contribution_media where id=p_id;
  if not found then raise exception 'Media unavailable'; end if;
  perform 1 from public.contributions where id=c for update;
  insert into public.storage_cleanup(storage_path) select storage_path from public.contribution_media where id=p_id on conflict do nothing;
  update public.contribution_media set status='deleted',description=null,updated_at=now() where id=p_id;
  update public.upload_intents set state='deleted' where id=p_id;
  update public.npc_placements set published=false where contribution_id=c;
end $$;
revoke all on function public.admin_delete_media(uuid) from public,anon;
grant execute on function public.admin_delete_media(uuid) to authenticated;

-- House safety is enforced in DB as well as TypeScript. Other scenes remain
-- unpublished until their geometry is authored and verified in M4.
create function public.house_safe(p_x integer,p_y integer,p_radius integer) returns boolean
language sql immutable set search_path = '' as $$
  select p_radius between 0 and 80
    and p_x-p_radius>=39 and p_x+p_radius<=797 and p_y-p_radius>=249 and p_y+p_radius<=424
    and not (p_x+p_radius+7>384 and p_x-p_radius-7<516 and p_y+p_radius>216 and p_y-p_radius-7<288)
    and not (p_x+p_radius+7>495 and p_y+p_radius>40 and p_y-p_radius-7<297);
$$;

create function public.admin_place_npc(p_contribution uuid,p_area uuid,p_variant text,p_x integer,p_y integer,p_radius integer,p_published boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.areas; c public.contributions;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select * into c from public.contributions where id=p_contribution for update;
  if not found then raise exception 'Contribution unavailable'; end if;
  select * into a from public.areas where id=p_area;
  if not found or p_variant not in ('npc-cream-1','npc-brown-scarf','npc-rose-bow') or p_x<0 or p_y<0 or p_radius not between 0 and 80 then raise exception 'Invalid placement'; end if;
  if a.map_key='sta_ana_house' and not public.house_safe(p_x,p_y,p_radius) then raise exception 'Unsafe yard placement'; end if;
  if a.map_key<>'sta_ana_house' and p_published then raise exception 'Scene not yet verified'; end if;
  if p_published and (c.status<>'approved' or exists(select 1 from public.contribution_media where contribution_id=c.id and status='pending')) then raise exception 'Review required before publication'; end if;
  insert into public.npc_placements(contribution_id,area_id,sprite_variant,spawn_x,spawn_y,wander_radius,published)
  values(p_contribution,p_area,p_variant,p_x,p_y,p_radius,p_published)
  on conflict(contribution_id) do update set area_id=p_area,sprite_variant=p_variant,spawn_x=p_x,spawn_y=p_y,wander_radius=p_radius,published=p_published;
  if p_published then update public.areas set published=true where id=p_area; end if;
end $$;

create function public.admin_delete_contribution(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_invite uuid;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select invitation_id into v_invite from public.contributions where id=p_id for update;
  if not found then raise exception 'Contribution unavailable'; end if;
  insert into public.storage_cleanup(storage_path) select storage_path from public.contribution_media where contribution_id=p_id on conflict do nothing;
  update public.upload_intents set state='deleted' where id in (select id from public.contribution_media where contribution_id=p_id);
  delete from public.contributions where id=p_id;
  perform public.admin_revoke_invite(v_invite);
end $$;

create function public.queue_expired_uploads() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.storage_cleanup(storage_path)
    select final_path from public.upload_intents u where state in ('allocated','validated','rejected','deleted')
      and (expires_at<=now() or exists(select 1 from public.invitations i where i.id=u.invitation_id and (i.revoked_at is not null or i.expires_at<=now())))
      and final_path is not null on conflict do nothing;
  update public.upload_intents set state='deleted' where state in ('allocated','validated','rejected') and expires_at<=now();
  delete from public.rate_limits where window_start<now()-interval '1 day';
  delete from public.contributor_sessions where expires_at<now()-interval '1 day';
end $$;

create function public.cleanup_candidates() returns table(storage_path text)
language sql security definer set search_path = '' as $$
  select j.storage_path from public.storage_cleanup j where j.not_before<=now()
    and not exists(select 1 from public.contribution_media m where m.storage_path=j.storage_path and m.status<>'deleted')
    and not exists(select 1 from public.upload_intents u join public.invitations i on i.id=u.invitation_id
      where u.final_path=j.storage_path and u.state='validated' and u.expires_at>now()
      and i.revoked_at is null and (i.expires_at is null or i.expires_at>now()))
    order by j.not_before limit 100;
$$;
revoke all on function public.cleanup_candidates() from public,anon,authenticated;
grant execute on function public.cleanup_candidates() to service_role;

-- Default EXECUTE grants on SECURITY DEFINER functions are dangerous. Revoke
-- PUBLIC for every function introduced here, then permit only intended roles.
revoke all on function public.consume_rate_limit(text,integer,integer),public.active_contributor(text),
 public.exchange_invitation(text,text),public.contributor_snapshot(text),
 public.reserve_upload(text,uuid,public.media_kind,bigint,text,text,text),
 public.validate_upload(text,uuid,text,text,bigint,integer),public.discard_upload(text,uuid),
 public.submit_contribution(text,text,text,text,uuid[]),public.queue_expired_uploads() from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer),public.active_contributor(text),
 public.exchange_invitation(text,text),public.contributor_snapshot(text),
 public.reserve_upload(text,uuid,public.media_kind,bigint,text,text,text),
 public.validate_upload(text,uuid,text,text,bigint,integer),public.discard_upload(text,uuid),
 public.submit_contribution(text,text,text,text,uuid[]),public.queue_expired_uploads() to service_role;
revoke all on function public.admin_create_invite(text,text,timestamptz),public.admin_revoke_invite(uuid),
 public.admin_review(uuid,public.moderation_status,text),public.admin_review_media(uuid,public.media_status),
 public.admin_place_npc(uuid,uuid,text,integer,integer,integer,boolean),public.admin_delete_contribution(uuid),
 public.house_safe(integer,integer,integer) from public,anon;
grant execute on function public.admin_create_invite(text,text,timestamptz),public.admin_revoke_invite(uuid),
 public.admin_review(uuid,public.moderation_status,text),public.admin_review_media(uuid,public.media_status),
 public.admin_place_npc(uuid,uuid,text,integer,integer,integer,boolean),public.admin_delete_contribution(uuid),
 public.house_safe(integer,integer,integer) to authenticated;
