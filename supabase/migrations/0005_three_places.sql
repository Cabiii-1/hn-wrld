-- Geometry mirrors src/game/scene-geometry.json; parity is checked in PostgreSQL tests.
create table public.scene_geometry(map_key text primary key, geometry jsonb not null);
alter table public.scene_geometry enable row level security;
revoke all on public.scene_geometry from anon,authenticated;
grant select on public.scene_geometry to service_role;
insert into public.scene_geometry values
('sta_ana_house','{"regions":[{"left":32,"right":804,"top":242,"bottom":424}],"obstacles":[{"x":384,"y":216,"width":132,"height":72},{"x":495,"y":40,"width":341,"height":257}]}'),
('tuguegarao_park','{"regions":[{"left":190,"right":646,"top":170,"bottom":240},{"left":166,"right":674,"top":240,"bottom":310},{"left":142,"right":698,"top":310,"bottom":377}],"obstacles":[{"x":284,"y":329,"width":18,"height":65},{"x":534,"y":329,"width":18,"height":65}]}'),
('slu_baguio','{"regions":[{"left":20,"right":816,"top":381,"bottom":395},{"left":327,"right":459,"top":330,"bottom":385},{"left":187,"right":292,"top":332,"bottom":385}],"obstacles":[]}');

create function public.scene_safe(p_map text,p_x integer,p_y integer,p_radius integer) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare g jsonb; l double precision; r double precision; t double precision; b double precision;
 xs double precision[]; ys double precision[]; xx double precision; yy double precision; i integer; j integer;
begin
  if p_x is null or p_y is null or p_radius is null or p_radius<0 or p_radius>80 then return false; end if;
  select geometry into g from public.scene_geometry where map_key=p_map;
  if not found then return false; end if;
  l:=p_x-p_radius-7; r:=p_x+p_radius+7; t:=p_y-p_radius-7; b:=p_y+p_radius;
  if exists(select 1 from jsonb_array_elements(g->'obstacles') o where r>(o->>'x')::float8 and l<(o->>'x')::float8+(o->>'width')::float8
    and b>(o->>'y')::float8 and t<(o->>'y')::float8+(o->>'height')::float8) then return false; end if;
  select array_agg(distinct edge order by edge) into xs from (
    select l as edge union select r union select greatest(l,least(r,(v->>'left')::float8)) from jsonb_array_elements(g->'regions') v
    union select greatest(l,least(r,(v->>'right')::float8)) from jsonb_array_elements(g->'regions') v) q;
  select array_agg(distinct edge order by edge) into ys from (
    select t as edge union select b union select greatest(t,least(b,(v->>'top')::float8)) from jsonb_array_elements(g->'regions') v
    union select greatest(t,least(b,(v->>'bottom')::float8)) from jsonb_array_elements(g->'regions') v) q;
  for i in 1..(array_length(xs,1)-1) loop
    for j in 1..(array_length(ys,1)-1) loop
      xx:=(xs[i]+xs[i+1])/2; yy:=(ys[j]+ys[j+1])/2;
      if not exists(select 1 from jsonb_array_elements(g->'regions') v where xx between (v->>'left')::float8 and (v->>'right')::float8
        and yy between (v->>'top')::float8 and (v->>'bottom')::float8) then return false; end if;
    end loop;
  end loop;
  return true;
end $$;
revoke all on function public.scene_safe(text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.scene_safe(text,integer,integer,integer) to service_role;

create or replace function public.admin_place_npc(p_contribution uuid,p_area uuid,p_variant text,p_x integer,p_y integer,p_radius integer,p_published boolean) returns void
language plpgsql security definer set search_path='' as $$
declare c public.contributions; a public.areas;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select * into c from public.contributions where id=p_contribution for update;
  if not found then raise exception 'Contribution unavailable'; end if;
  select * into a from public.areas where id=p_area;
  if not found or not public.scene_safe(a.map_key,p_x,p_y,p_radius) then raise exception 'Unsafe placement'; end if;
  if p_variant not in ('npc-cream-1','npc-brown-scarf','npc-rose-bow') or p_variant is null then raise exception 'Unknown bear style'; end if;
  if p_published and (c.status<>'approved' or exists(select 1 from public.contribution_media where contribution_id=c.id and status='pending')) then raise exception 'Review required before publication'; end if;
  insert into public.npc_placements(contribution_id,area_id,sprite_variant,spawn_x,spawn_y,wander_radius,published)
    values(p_contribution,p_area,p_variant,p_x,p_y,p_radius,p_published)
    on conflict(contribution_id) do update set area_id=p_area,sprite_variant=p_variant,spawn_x=p_x,spawn_y=p_y,wander_radius=p_radius,published=p_published;
  if p_published then update public.areas set published=true where id=p_area; end if;
end $$;

create function public.recipient_scene(p_session_hash text,p_map text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
  l:=public.active_recipient(p_session_hash);
  if not exists(select 1 from public.scene_geometry where map_key=p_map) then raise exception 'Unknown place'; end if;
  return jsonb_build_object('mapKey',p_map,'npcs',coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'name',c.display_name,'variant',case when p.sprite_variant in ('npc-cream-1','npc-brown-scarf','npc-rose-bow') then p.sprite_variant else 'npc-cream-1' end,
    'x',p.spawn_x,'y',p.spawn_y,'radius',p.wander_radius,'seen',exists(select 1 from public.recipient_seen s where s.access_link_id=l and s.contribution_id=c.id)) order by p.id)
    from public.npc_placements p join public.contributions c on c.id=p.contribution_id join public.areas a on a.id=p.area_id
    where a.map_key=p_map and a.published and p.published and c.status='approved' and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius)), '[]'::jsonb));
end $$;
revoke all on function public.recipient_scene(text,text) from public,anon,authenticated;
grant execute on function public.recipient_scene(text,text) to service_role;
-- Preserve the verified M3 endpoint for existing clients.
create or replace function public.recipient_house(p_session_hash text) returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object('npcs',public.recipient_scene(p_session_hash,'sta_ana_house')->'npcs');
$$;
create or replace function public.recipient_message(p_session_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
  perform public.active_recipient(p_session_hash);
  select jsonb_build_object('id',c.id,'name',c.display_name,'relationship',coalesce(c.relationship_label,''),'message',c.message_text,
    'media',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'description',coalesce(m.description,'')) order by m.created_at,m.id)
    from public.contribution_media m where m.contribution_id=c.id and m.status='approved'),'[]'::jsonb)) into v
    from public.contributions c join public.npc_placements p on p.contribution_id=c.id join public.areas a on a.id=p.area_id
    where c.id=p_id and c.status='approved' and p.published and a.published and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius);
  if v is null then raise exception 'Message unavailable'; end if;
  return v;
end $$;
create or replace function public.recipient_media(p_session_hash text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
  perform public.active_recipient(p_session_hash);
  select jsonb_build_object('path',m.storage_path,'mime',m.media_type) into v from public.contribution_media m
    join public.contributions c on c.id=m.contribution_id join public.npc_placements p on p.contribution_id=c.id join public.areas a on a.id=p.area_id
    where m.id=p_id and m.status='approved' and c.status='approved' and p.published and a.published and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius);
  if v is null then raise exception 'Media unavailable'; end if;
  return v;
end $$;
-- CREATE OR REPLACE preserves the M2/M3 grants on replaced functions.
