-- Owner-approved civic plaza artwork, 2026-10-18. Coordinates use the 836x470 world.
-- Only incompatible placements move; authorship, moderation and publication are preserved.
update public.scene_geometry set geometry='{"regions":[{"left":220,"right":615,"top":125,"bottom":160},{"left":210,"right":626,"top":160,"bottom":200},{"left":192,"right":644,"top":200,"bottom":240},{"left":180,"right":655,"top":240,"bottom":275},{"left":162,"right":672,"top":275,"bottom":310},{"left":150,"right":686,"top":310,"bottom":340},{"left":166,"right":660,"top":340,"bottom":360},{"left":378,"right":458,"top":360,"bottom":405}],"obstacles":[{"x":399,"y":140,"width":38,"height":62},{"x":377,"y":180,"width":82,"height":62},{"x":343,"y":200,"width":146,"height":62},{"x":172,"y":335,"width":16,"height":43},{"x":292,"y":335,"width":15,"height":43},{"x":356,"y":335,"width":13,"height":43},{"x":467,"y":335,"width":14,"height":43},{"x":531,"y":335,"width":15,"height":43},{"x":650,"y":335,"width":15,"height":43}]}'::jsonb where map_key='tuguegarao_park';

do $$
declare p record; spot record; search_radius integer;
begin
  for p in select n.* from public.npc_placements n join public.areas a on a.id=n.area_id
    where a.map_key='tuguegarao_park' and not public.scene_safe(a.map_key,n.spawn_x,n.spawn_y,n.wander_radius)
    order by n.id for update of n
  loop
    search_radius:=p.wander_radius;
    select x,y into spot from generate_series(160,680,8) x cross join generate_series(136,352,8) y
      where public.scene_safe('tuguegarao_park',x,y,search_radius)
      order by (x-p.spawn_x)::bigint*(x-p.spawn_x)+(y-p.spawn_y)::bigint*(y-p.spawn_y),y,x limit 1;
    if not found then
      search_radius:=least(p.wander_radius,20);
      select x,y into spot from generate_series(160,680,8) x cross join generate_series(136,352,8) y
        where public.scene_safe('tuguegarao_park',x,y,search_radius)
        order by (x-p.spawn_x)::bigint*(x-p.spawn_x)+(y-p.spawn_y)::bigint*(y-p.spawn_y),y,x limit 1;
    end if;
    if not found then raise exception 'No safe plaza placement available'; end if;
    update public.npc_placements set spawn_x=spot.x,spawn_y=spot.y,wander_radius=search_radius where id=p.id;
  end loop;
end $$;
