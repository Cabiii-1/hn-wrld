-- Additive character selection; no backfill or modification of real identities.
alter table public.contributions add column character_key text
  check(character_key in ('bear','turtle','capybara','frog','cat','bee'));

create function public.resolved_character(p_character text,p_legacy text) returns text
language sql immutable set search_path='' as $$
  select case when p_character in ('bear','turtle','capybara','frog','cat','bee') then 'animal-'||p_character
    when p_legacy in ('npc-cream-1','npc-brown-scarf','npc-rose-bow') then p_legacy else 'npc-cream-1' end;
$$;
create function public.set_contribution_character(p_id uuid,p_character text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_character is null then return; end if;
  if p_character not in ('bear','turtle','capybara','frog','cat','bee') then raise exception 'Unknown character'; end if;
  update public.contributions set character_key=p_character,updated_at=clock_timestamp()
    where id=p_id and character_key is distinct from p_character;
  update public.npc_placements set sprite_variant='animal-'||p_character where contribution_id=p_id;
end $$;

-- New names avoid PostgREST overload ambiguity; old signatures remain compatible.
create function public.submit_character_contribution(p_session_hash text,p_message text,p_upload_ids uuid[],p_share boolean,p_character text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
  c:=public.submit_instant_contribution(p_session_hash,p_message,p_upload_ids,p_share);
  perform public.set_contribution_character(c,coalesce(p_character,'bear'));
  return c;
end $$;
create function public.edit_character_contribution(p_session_hash text,p_message text,p_version timestamptz,p_retained jsonb,p_upload_ids uuid[],p_share boolean,p_character text) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid; c_id uuid;
begin
  -- Existing routine owns authorization, invitation/contribution locks, version,
  -- attachment validation and publication/hold behavior. All stays one transaction.
  perform public.edit_instant_contribution(p_session_hash,p_message,p_version,p_retained,p_upload_ids,p_share);
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  select id into c_id from public.contributions where invitation_id=v_id order by created_at limit 1;
  perform public.set_contribution_character(c_id,p_character);
end $$;

-- Wrap the established authorized projections, retaining their exact row scope.
alter function public.contributor_snapshot(text) rename to contributor_snapshot_before_characters;
create function public.contributor_snapshot(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; c public.contributions; v text;
begin
  result:=public.contributor_snapshot_before_characters(p_session_hash);
  select * into c from public.contributions where invitation_id=public.active_contributor(p_session_hash) order by created_at limit 1;
  if c.id is not null then
    select sprite_variant into v from public.npc_placements where contribution_id=c.id;
    result:=jsonb_set(result,'{letter,characterKey}',coalesce(to_jsonb(c.character_key),'null'::jsonb));
    result:=jsonb_set(result,'{letter,legacyVariant}',to_jsonb(public.resolved_character(null,v)));
  end if;
  return result;
end $$;

alter function public.recipient_scene(text,text) rename to recipient_scene_before_characters;
create function public.recipient_scene(p_session_hash text,p_map text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cast_data jsonb;
begin
  result:=public.recipient_scene_before_characters(p_session_hash,p_map);
  select coalesce(jsonb_agg(n||jsonb_build_object('variant',public.resolved_character(c.character_key,p.sprite_variant)) order by ord),'[]'::jsonb)
    into cast_data from jsonb_array_elements(result->'npcs') with ordinality as q(n,ord)
    join public.contributions c on c.id=(n->>'id')::uuid
    join public.npc_placements p on p.contribution_id=c.id;
  return jsonb_set(result,'{npcs}',cast_data);
end $$;

alter function public.contributor_visit(text) rename to contributor_visit_before_characters;
create function public.contributor_visit(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; cast_data jsonb; variant text;
begin
  result:=public.contributor_visit_before_characters(p_session_hash);
  select public.resolved_character(c.character_key,p.sprite_variant) into variant
    from public.contributions c left join public.npc_placements p on p.contribution_id=c.id
    where c.invitation_id=public.active_contributor(p_session_hash) order by c.created_at limit 1;
  result:=jsonb_set(result,'{visitor,variant}',to_jsonb(variant));
  select coalesce(jsonb_agg(n||jsonb_build_object('variant',public.resolved_character(c.character_key,p.sprite_variant)) order by ord),'[]'::jsonb)
    into cast_data from jsonb_array_elements(result->'npcs') with ordinality as q(n,ord)
    join public.npc_placements p on p.id=(n->>'id')::uuid
    join public.contributions c on c.id=p.contribution_id;
  return jsonb_set(result,'{npcs}',cast_data);
end $$;

revoke all on function public.resolved_character(text,text),public.set_contribution_character(uuid,text),
  public.submit_character_contribution(text,text,uuid[],boolean,text),
  public.edit_character_contribution(text,text,timestamptz,jsonb,uuid[],boolean,text),
  public.contributor_snapshot(text),public.recipient_scene(text,text),public.contributor_visit(text)
  from public,anon,authenticated;
grant execute on function public.resolved_character(text,text),public.set_contribution_character(uuid,text),
  public.submit_character_contribution(text,text,uuid[],boolean,text),
  public.edit_character_contribution(text,text,timestamptz,jsonb,uuid[],boolean,text),
  public.contributor_snapshot(text),public.recipient_scene(text,text),public.contributor_visit(text) to service_role;
create or replace function public.admin_place_npc(p_contribution uuid,p_area uuid,p_variant text,p_x integer,p_y integer,p_radius integer,p_published boolean) returns void
language plpgsql security definer set search_path='' as $$
declare c public.contributions; a public.areas; v_invite uuid;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select invitation_id into v_invite from public.contributions where id=p_contribution;
  perform 1 from public.invitations where id=v_invite for update;
  select * into c from public.contributions where id=p_contribution for update;
  if not found then raise exception 'Contribution unavailable'; end if;
  select * into a from public.areas where id=p_area;
  if not found or not public.scene_safe(a.map_key,p_x,p_y,p_radius) then raise exception 'Unsafe placement'; end if;
  if p_variant not in ('npc-cream-1','npc-brown-scarf','npc-rose-bow','animal-bear','animal-turtle','animal-capybara','animal-frog','animal-cat','animal-bee') or p_variant is null then raise exception 'Unknown character'; end if;
  if p_published and (c.status<>'approved' or exists(select 1 from public.contribution_media where contribution_id=c.id and status='pending')) then raise exception 'Review required before publication'; end if;
  if p_variant like 'animal-%' then
    perform public.set_contribution_character(c.id,substr(p_variant,8));
  elsif c.character_key is not null then raise exception 'Choose an animal for this contributor'; end if;
  insert into public.npc_placements(contribution_id,area_id,sprite_variant,spawn_x,spawn_y,wander_radius,published)
    values(p_contribution,p_area,p_variant,p_x,p_y,p_radius,p_published)
    on conflict(contribution_id) do update set area_id=p_area,sprite_variant=p_variant,spawn_x=p_x,spawn_y=p_y,wander_radius=p_radius,published=p_published;
  update public.invitations set assigned_map=a.map_key where id=v_invite;
  if p_published then update public.areas set published=true where id=p_area; end if;
end $$;
