-- Recipient capabilities are verified by server-only RPCs on every read/write.
alter table public.recipient_access_links add column passcode_hash text;
alter table public.recipient_sessions add column access_link_id uuid references public.recipient_access_links(id) on delete cascade;
-- Legacy links/sessions have no second factor and cannot authorize anything.
update public.recipient_sessions set revoked_at=now() where access_link_id is null;
create table public.recipient_seen (
  access_link_id uuid not null references public.recipient_access_links(id) on delete cascade,
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key(access_link_id,contribution_id)
);
alter table public.recipient_seen enable row level security;
revoke all on public.recipient_seen from anon,authenticated;
grant all on public.recipient_seen to service_role;

create function public.admin_create_recipient_link(p_hash text,p_passcode_hash text,p_expires timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_passcode_hash not like 'scrypt$%' or length(p_hash)<>64 then raise exception 'Invalid verifier'; end if;
  insert into public.recipient_access_links(token_hash,passcode_hash,expires_at) values(p_hash,p_passcode_hash,p_expires) returning id into v;
  return v;
end $$;
create function public.admin_revoke_recipient_link(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  update public.recipient_access_links set revoked_at=now() where id=p_id;
  update public.recipient_sessions set revoked_at=now() where access_link_id=p_id;
end $$;
create policy admin_read_recipient_links on public.recipient_access_links for select to authenticated using(public.is_world_admin());
grant select on public.recipient_access_links to authenticated;

create function public.recipient_verifier(p_hash text) returns text
language sql security definer set search_path='' as $$
  select passcode_hash from public.recipient_access_links where token_hash=p_hash and passcode_hash is not null
  and revoked_at is null and (expires_at is null or expires_at>now());
$$;
create function public.open_recipient_session(p_hash text,p_verifier text,p_session_hash text) returns void
language plpgsql security definer set search_path='' as $$
declare l public.recipient_access_links;
begin
  select * into l from public.recipient_access_links where token_hash=p_hash for update;
  if not found or l.revoked_at is not null or l.expires_at<=now() or l.passcode_hash is null or l.passcode_hash<>p_verifier then raise exception 'Access unavailable'; end if;
  insert into public.recipient_sessions(access_link_id,session_hash,expires_at)
    values(l.id,p_session_hash,least(now()+interval '8 hours',coalesce(l.expires_at,now()+interval '8 hours')));
end $$;
create function public.active_recipient(p_session_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
  select l.id into v from public.recipient_sessions s join public.recipient_access_links l on l.id=s.access_link_id
    where s.session_hash=p_session_hash and s.revoked_at is null and s.expires_at>now() and l.revoked_at is null
    and (l.expires_at is null or l.expires_at>now()) and l.passcode_hash is not null;
  if v is null then raise exception 'Recipient access required' using errcode='42501'; end if;
  return v;
end $$;
create function public.recipient_house(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
  l:=public.active_recipient(p_session_hash);
  return jsonb_build_object('npcs',coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'name',c.display_name,'variant',p.sprite_variant,'x',p.spawn_x,'y',p.spawn_y,'radius',p.wander_radius,
    'seen',exists(select 1 from public.recipient_seen s where s.access_link_id=l and s.contribution_id=c.id)) order by p.id)
    from public.npc_placements p join public.contributions c on c.id=p.contribution_id join public.areas a on a.id=p.area_id
    where p.published and c.status='approved' and a.published and a.map_key='sta_ana_house'
    and public.house_safe(p.spawn_x,p.spawn_y,p.wander_radius)),'[]'::jsonb));
end $$;
create function public.recipient_message(p_session_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
  perform public.active_recipient(p_session_hash);
  select jsonb_build_object('id',c.id,'name',c.display_name,'relationship',coalesce(c.relationship_label,''),'message',c.message_text,
    'media',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'description',coalesce(m.description,'')) order by m.created_at,m.id)
      from public.contribution_media m where m.contribution_id=c.id and m.status='approved'),'[]'::jsonb)) into v
    from public.contributions c join public.npc_placements p on p.contribution_id=c.id join public.areas a on a.id=p.area_id
    where c.id=p_id and c.status='approved' and p.published and a.published and a.map_key='sta_ana_house'
      and public.house_safe(p.spawn_x,p.spawn_y,p.wander_radius);
  if v is null then raise exception 'Message unavailable'; end if;
  return v;
end $$;
create function public.recipient_media(p_session_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
  perform public.active_recipient(p_session_hash);
  select jsonb_build_object('path',m.storage_path,'mime',m.media_type) into v from public.contribution_media m
    join public.contributions c on c.id=m.contribution_id join public.npc_placements p on p.contribution_id=c.id join public.areas a on a.id=p.area_id
    where m.id=p_id and m.status='approved' and c.status='approved' and p.published and a.published and a.map_key='sta_ana_house'
      and public.house_safe(p.spawn_x,p.spawn_y,p.wander_radius);
  if v is null then raise exception 'Media unavailable'; end if;
  return v;
end $$;
create function public.recipient_mark_seen(p_session_hash text,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
  l:=public.active_recipient(p_session_hash);
  perform public.recipient_message(p_session_hash,p_id);
  insert into public.recipient_seen(access_link_id,contribution_id) values(l,p_id) on conflict do nothing;
end $$;
revoke all on function public.admin_create_recipient_link(text,text,timestamptz),public.admin_revoke_recipient_link(uuid) from public,anon;
grant execute on function public.admin_create_recipient_link(text,text,timestamptz),public.admin_revoke_recipient_link(uuid) to authenticated;
revoke all on function public.recipient_verifier(text),public.open_recipient_session(text,text,text),public.active_recipient(text),public.recipient_house(text),
  public.recipient_message(text,uuid),public.recipient_media(text,uuid),public.recipient_mark_seen(text,uuid) from public,anon,authenticated;
grant execute on function public.recipient_verifier(text),public.open_recipient_session(text,text,text),public.active_recipient(text),public.recipient_house(text),
  public.recipient_message(text,uuid),public.recipient_media(text,uuid),public.recipient_mark_seen(text,uuid) to service_role;
