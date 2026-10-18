-- Owner update: show published contributors’ display names in visit scenes.
-- Continue to omit letters, media, contribution IDs, progress, and finale data.
create or replace function public.contributor_visit(p_session_hash text) returns jsonb
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
      select jsonb_build_object('id',p.id,'name',c.display_name,'variant',case when p.sprite_variant in ('npc-cream-1','npc-brown-scarf','npc-rose-bow') then p.sprite_variant else 'npc-cream-1' end,
        'x',p.spawn_x,'y',p.spawn_y,'radius',p.wander_radius,'seen',false) as row_data
      from public.npc_placements p join public.contributions c on c.id=p.contribution_id join public.areas a on a.id=p.area_id
      where a.map_key=m and a.published and p.published and c.status='approved' and c.invitation_id<>v_id
        and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius) order by p.id limit 200
    ) q),'[]'::jsonb));
end $$;
revoke all on function public.contributor_visit(text) from public,anon,authenticated;
grant execute on function public.contributor_visit(text) to service_role;

