-- Sharing is opt-in, text-only and limited to active submitted invitees in the same scene.
alter table public.contributions add column share_with_invitees boolean not null default false;
alter table public.contributions add column sharing_consent_at timestamptz;

create function public.submit_shared_contribution(p_session_hash text,p_message text,p_upload_ids uuid[],p_share boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
  if p_share is null then raise exception 'Choose letter visibility'; end if;
  c:=public.submit_contribution(p_session_hash,'','',p_message,p_upload_ids);
  update public.contributions set share_with_invitees=p_share,sharing_consent_at=case when p_share then clock_timestamp() else null end where id=c;
  return c;
end $$;

create function public.edit_shared_contribution(p_session_hash text,p_message text,p_version timestamptz,p_retained jsonb,p_upload_ids uuid[],p_share boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_share is null then raise exception 'Choose letter visibility'; end if;
  if p_retained is null and p_upload_ids is null then
    perform public.edit_contribution(p_session_hash,p_message,p_version);
  else
    perform public.edit_contribution_media(p_session_hash,p_message,p_version,p_retained,p_upload_ids);
  end if;
  -- The called edit holds invitation and parent locks and withdraws publication.
  update public.contributions set share_with_invitees=p_share,sharing_consent_at=case when p_share then clock_timestamp() else null end
    where id=(select id from public.contributions where invitation_id=public.active_contributor(p_session_hash) order by created_at limit 1);
end $$;
revoke all on function public.submit_shared_contribution(text,text,uuid[],boolean),public.edit_shared_contribution(text,text,timestamptz,jsonb,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.submit_shared_contribution(text,text,uuid[],boolean),public.edit_shared_contribution(text,text,timestamptz,jsonb,uuid[],boolean) to service_role;

create or replace function public.contributor_snapshot(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  return jsonb_build_object(
    'displayName',(select trim(label) from public.invitations where id=v_id),
    'submitted',exists(select 1 from public.contributions where invitation_id=v_id),
    'letter',(select jsonb_build_object('message',c.message_text,'version',c.updated_at,'shareWithInvitees',c.share_with_invitees,
      'media',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'state','attached','status',m.status,'description',coalesce(m.description,'')) order by m.created_at,m.id)
        from public.contribution_media m where m.contribution_id=c.id and m.status<>'deleted'),'[]'::jsonb))
      from public.contributions c where c.invitation_id=v_id order by c.created_at limit 1),
    'uploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'description',description))
      from public.upload_intents where invitation_id=v_id and state in ('allocated','validated') and expires_at>now()),'[]'::jsonb));
end $$;

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
        'x',p.spawn_x,'y',p.spawn_y,'radius',p.wander_radius,'seen',false,'readable',c.share_with_invitees and i.revoked_at is null and (i.expires_at is null or i.expires_at>now())) as row_data
      from public.npc_placements p join public.contributions c on c.id=p.contribution_id join public.areas a on a.id=p.area_id join public.invitations i on i.id=c.invitation_id
      where a.map_key=m and a.published and p.published and c.status='approved' and c.invitation_id<>v_id
        and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius) order by p.id limit 200
    ) q),'[]'::jsonb));
end $$;
revoke all on function public.contributor_visit(text) from public,anon,authenticated;
grant execute on function public.contributor_visit(text) to service_role;


create function public.contributor_shared_message(p_session_hash text,p_placement uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid; destination text; letter jsonb;
begin
  viewer:=public.active_contributor(p_session_hash);
  if viewer is null then raise exception 'Session unavailable'; end if;
  select i.assigned_map into destination from public.invitations i where i.id=viewer
    and exists(select 1 from public.contributions c where c.invitation_id=viewer);
  if destination is null then raise exception 'Submit your letter first'; end if;
  select jsonb_build_object('id',p.id,'name',c.display_name,'message',c.message_text) into letter
    from public.npc_placements p join public.contributions c on c.id=p.contribution_id
    join public.areas a on a.id=p.area_id join public.invitations i on i.id=c.invitation_id
    where p.id=p_placement and c.invitation_id<>viewer and c.share_with_invitees and c.status='approved'
      and p.published and a.published and a.map_key=destination
      and i.revoked_at is null and (i.expires_at is null or i.expires_at>now())
      and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius);
  if letter is null then raise exception 'Shared letter unavailable'; end if;
  return letter;
end $$;
revoke all on function public.contributor_shared_message(text,uuid) from public,anon,authenticated;
grant execute on function public.contributor_shared_message(text,uuid) to service_role;
