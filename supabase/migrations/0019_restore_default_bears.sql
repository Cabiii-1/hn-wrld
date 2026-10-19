-- Owner requested removal of character selection and a return to default bears.
-- Only animal appearance metadata changes; letters/media/placement/access remain.
update public.npc_placements set sprite_variant='npc-cream-1'
where sprite_variant in ('animal-bear','animal-turtle','animal-capybara','animal-frog','animal-cat','animal-bee');

drop function public.contributor_snapshot(text);
alter function public.contributor_snapshot_before_characters(text) rename to contributor_snapshot;
drop function public.recipient_scene(text,text);
alter function public.recipient_scene_before_characters(text,text) rename to recipient_scene;
drop function public.contributor_visit(text);
alter function public.contributor_visit_before_characters(text) rename to contributor_visit;

drop function public.submit_character_contribution(text,text,uuid[],boolean,text);
drop function public.edit_character_contribution(text,text,timestamptz,jsonb,uuid[],boolean,text);
drop function public.set_contribution_character(uuid,text);
drop function public.resolved_character(text,text);
alter table public.contributions drop column character_key;

-- Restore the original admin bear styles and existing authorization/placement rules.
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

