alter table public.invitations add column assigned_map text not null default 'sta_ana_house'
  check (assigned_map in ('sta_ana_house','tuguegarao_park','slu_baguio'));
-- Preserve scenes already assigned to existing bears.
update public.invitations i set assigned_map=a.map_key from public.contributions c
  join public.npc_placements p on p.contribution_id=c.id join public.areas a on a.id=p.area_id
  where c.invitation_id=i.id;

create function public.admin_set_invite_place(p_id uuid,p_map text) returns void
language plpgsql security definer set search_path='' as $$
declare a uuid; x integer; y integer; r integer;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_map is null or p_map not in ('sta_ana_house','tuguegarao_park','slu_baguio') then raise exception 'Unknown place'; end if;
  perform 1 from public.invitations where id=p_id and revoked_at is null for update;
  if not found then raise exception 'Invitation unavailable'; end if;
  select id into a from public.areas where map_key=p_map;
  if a is null then raise exception 'Place unavailable'; end if;
  x:=case p_map when 'sta_ana_house' then 425 when 'tuguegarao_park' then 470 else 430 end;
  y:=case p_map when 'sta_ana_house' then 352 when 'tuguegarao_park' then 290 else 360 end;
  r:=case p_map when 'slu_baguio' then 12 else 20 end;
  update public.invitations set assigned_map=p_map where id=p_id;
  update public.npc_placements p set area_id=a,spawn_x=x,spawn_y=y,wander_radius=r,published=false
    from public.contributions c where c.id=p.contribution_id and c.invitation_id=p_id and p.area_id<>a;
end $$;

create function public.admin_issue_designated_invite(p_id uuid,p_hash text,p_cipher text,p_label text,p_expires timestamptz,p_map text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  perform public.admin_issue_invite(p_id,p_hash,p_cipher,p_label,p_expires,false);
  perform public.admin_set_invite_place(p_id,p_map);
  return p_id;
end $$;
revoke all on function public.admin_set_invite_place(uuid,text),public.admin_issue_designated_invite(uuid,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.admin_set_invite_place(uuid,text),public.admin_issue_designated_invite(uuid,text,text,text,timestamptz,text) to authenticated;

-- This is a visual-only projection for a submitted contributor session.
-- No other person's name, contribution ID, text, media, progress or finale.
create function public.contributor_visit(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid; m text; n text; variant text;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  select i.assigned_map,c.display_name,p.sprite_variant into m,n,variant from public.invitations i
    join public.contributions c on c.invitation_id=i.id left join public.npc_placements p on p.contribution_id=c.id
    where i.id=v_id order by c.created_at limit 1;
  if m is null then raise exception 'Submit your letter first'; end if;
  return jsonb_build_object('mapKey',m,'visitor',jsonb_build_object('name',n,'variant',
    case when variant in ('npc-cream-1','npc-brown-scarf','npc-rose-bow') then variant else 'npc-cream-1' end),
    'npcs',coalesce((select jsonb_agg(row_data) from (
      select jsonb_build_object('id',p.id,'name','A friend of Hanna','variant',case when p.sprite_variant in ('npc-cream-1','npc-brown-scarf','npc-rose-bow') then p.sprite_variant else 'npc-cream-1' end,
        'x',p.spawn_x,'y',p.spawn_y,'radius',p.wander_radius,'seen',false) as row_data
      from public.npc_placements p join public.contributions c on c.id=p.contribution_id join public.areas a on a.id=p.area_id
      where a.map_key=m and a.published and p.published and c.status='approved' and c.invitation_id<>v_id
        and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius) order by p.id limit 200
    ) q),'[]'::jsonb));
end $$;
revoke all on function public.contributor_visit(text) from public,anon,authenticated;
grant execute on function public.contributor_visit(text) to service_role;

-- Keep the invitation destination in sync when the detailed placement editor is
-- used. Lock invitations before contributions, matching contributor edit order.
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
  if p_variant not in ('npc-cream-1','npc-brown-scarf','npc-rose-bow') or p_variant is null then raise exception 'Unknown bear style'; end if;
  if p_published and (c.status<>'approved' or exists(select 1 from public.contribution_media where contribution_id=c.id and status='pending')) then raise exception 'Review required before publication'; end if;
  insert into public.npc_placements(contribution_id,area_id,sprite_variant,spawn_x,spawn_y,wander_radius,published)
    values(p_contribution,p_area,p_variant,p_x,p_y,p_radius,p_published)
    on conflict(contribution_id) do update set area_id=p_area,sprite_variant=p_variant,spawn_x=p_x,spawn_y=p_y,wander_radius=p_radius,published=p_published;
  update public.invitations set assigned_map=a.map_key where id=v_invite;
  if p_published then update public.areas set published=true where id=p_area; end if;
end $$;
