-- Owner-approved automatic publication for trusted invitation submissions.
-- Internal moderation states remain for explicit hide/exclude/delete controls.
create function public.publish_invited_contribution(p_id uuid,p_publish boolean,p_reposition boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare c public.contributions; i public.invitations; a public.areas; p public.npc_placements;
  spot record; anchor_x integer; anchor_y integer; r integer; min_r integer; v text; offset_x integer; offset_y integer;
begin
  select * into c from public.contributions where id=p_id for update;
  if not found then raise exception 'Contribution unavailable'; end if;
  select * into i from public.invitations where id=c.invitation_id;
  if i.revoked_at is not null or (i.expires_at is not null and i.expires_at<=now()) then raise exception 'Invitation unavailable'; end if;
  -- Never undo an administrator's explicit exclusion.
  if c.status in ('hidden','rejected') then return; end if;
  if exists(select 1 from public.contribution_media m where m.contribution_id=c.id and m.status='pending'
    and not exists(select 1 from public.upload_intents u where u.id=m.id and u.invitation_id=i.id
      and u.state='attached' and u.final_path=m.storage_path and u.final_mime=m.media_type and u.final_bytes=m.file_size_bytes))
    then raise exception 'Attachment validation required'; end if;
  update public.contribution_media set status='approved',updated_at=clock_timestamp()
    where contribution_id=c.id and status='pending';
  update public.contributions set status='approved',updated_at=clock_timestamp() where id=c.id;
  select * into a from public.areas where map_key=i.assigned_map for update;
  if not found then raise exception 'Place unavailable'; end if;
  select * into p from public.npc_placements where contribution_id=c.id;
  if found and not p_reposition and p.area_id=a.id and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius) then
    update public.npc_placements set published=p_publish where id=p.id;
  else
    anchor_x:=case a.map_key when 'sta_ana_house' then 340 when 'tuguegarao_park' then 415 else 385 end;
    anchor_y:=case a.map_key when 'sta_ana_house' then 350 when 'tuguegarao_park' then 300 else 365 end;
    min_r:=case a.map_key when 'slu_baguio' then 4 else 8 end;
    offset_x:=38+floor(random()*16)::integer;
    offset_y:=130+floor(random()*12)::integer;
    -- Serialize per scene; maximize distance from existing bears and the player
    -- entrance, randomizing the sampling grid and ties rather than stacking.
    select x,y,least(coalesce((select min(sqrt((n.spawn_x-x)::float8*(n.spawn_x-x)+(n.spawn_y-y)::float8*(n.spawn_y-y)))
        from public.npc_placements n where n.area_id=a.id and n.contribution_id<>c.id and n.published),1000),
        sqrt((x-anchor_x)::float8*(x-anchor_x)+(y-anchor_y)::float8*(y-anchor_y))) as clearance
      into spot from generate_series(offset_x,798,16) x cross join generate_series(offset_y,402,12) y
      where public.scene_safe(a.map_key,x,y,min_r)
      order by clearance desc,random() limit 1;
    if not found or spot.clearance<24 then raise exception 'This place is full; please contact Cj'; end if;
    r:=least(20,greatest(min_r,floor((spot.clearance-24)/2)::integer));
    while not public.scene_safe(a.map_key,spot.x,spot.y,r) loop r:=r-1; end loop;
    r:=min_r+floor(random()*(r-min_r+1))::integer;
    v:=case (select count(*)%3 from public.npc_placements where area_id=a.id)
      when 0 then 'npc-cream-1' when 1 then 'npc-brown-scarf' else 'npc-rose-bow' end;
    insert into public.npc_placements(contribution_id,area_id,sprite_variant,spawn_x,spawn_y,wander_radius,published)
      values(c.id,a.id,coalesce(p.sprite_variant,v),spot.x,spot.y,r,p_publish)
      on conflict(contribution_id) do update set area_id=excluded.area_id,spawn_x=excluded.spawn_x,
        spawn_y=excluded.spawn_y,wander_radius=excluded.wander_radius,published=excluded.published;
  end if;
  if p_publish then update public.areas set published=true where id=a.id; end if;
end $$;

create function public.submit_instant_contribution(p_session_hash text,p_message text,p_upload_ids uuid[],p_share boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
  c:=public.submit_shared_contribution(p_session_hash,p_message,p_upload_ids,coalesce(p_share,false));
  perform public.publish_invited_contribution(c,true);
  return c;
end $$;

create function public.edit_instant_contribution(p_session_hash text,p_message text,p_version timestamptz,p_retained jsonb,p_upload_ids uuid[],p_share boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid; c public.contributions; was_published boolean;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  perform 1 from public.invitations where id=v_id for update;
  select * into c from public.contributions where invitation_id=v_id order by created_at limit 1 for update;
  if not found then raise exception 'Letter unavailable'; end if;
  select published into was_published from public.npc_placements where contribution_id=c.id;
  perform public.edit_shared_contribution(p_session_hash,p_message,p_version,p_retained,p_upload_ids,coalesce(p_share,c.share_with_invitees));
  if c.status in ('hidden','rejected') then
    update public.contributions set status=c.status where id=c.id;
    return;
  end if;
  -- Existing manual unpublication remains a hold; pending legacy letters join
  -- automatically on their next edit. Active bears retain custom placement.
  perform public.publish_invited_contribution(c.id,coalesce(was_published,true) or c.status='pending');
end $$;

revoke all on function public.publish_invited_contribution(uuid,boolean,boolean),public.submit_instant_contribution(text,text,uuid[],boolean),public.edit_instant_contribution(text,text,timestamptz,jsonb,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.publish_invited_contribution(uuid,boolean,boolean),public.submit_instant_contribution(text,text,uuid[],boolean),public.edit_instant_contribution(text,text,timestamptz,jsonb,uuid[],boolean) to service_role;

-- Explicitly requested backfill: pending hellos only, from active invitations.
-- Already hidden/rejected letters, excluded media and existing private choices
-- remain unchanged. Invalid/unvalidated attachments abort instead of leaking.
do $$
declare item record;
begin
  for item in select c.id,c.invitation_id from public.contributions c join public.invitations i on i.id=c.invitation_id
    where c.status='pending' and i.revoked_at is null and (i.expires_at is null or i.expires_at>now()) order by c.created_at,c.id
  loop
    perform 1 from public.invitations where id=item.invitation_id for update;
    perform public.publish_invited_contribution(item.id,true,true);
  end loop;
end $$;
