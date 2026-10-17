-- Private authoring, explicit publication and recipient-link progress.
create table public.finale_settings (
  singleton boolean primary key default true check(singleton),
  revision integer not null default 0 check(revision>=0),
  draft jsonb not null,
  published jsonb,
  published_revision integer
);
insert into public.finale_settings(draft) values
  ('{"title":"A little letter from Dudu","letter":"","threshold":3,"conversation":[]}');
create table public.recipient_finale (
  access_link_id uuid primary key references public.recipient_access_links(id) on delete cascade,
  revision integer not null,
  completed_at timestamptz not null default now()
);
alter table public.finale_settings enable row level security;
alter table public.recipient_finale enable row level security;
revoke all on public.finale_settings,public.recipient_finale from anon,authenticated;
grant all on public.finale_settings,public.recipient_finale to service_role;

create function public.admin_finale() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  return (select jsonb_build_object('revision',revision,'draft',draft,'published',published is not null) from public.finale_settings);
end $$;
create function public.admin_save_finale(p_content jsonb,p_revision integer,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare f public.finale_settings; turn jsonb;
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select * into f from public.finale_settings where singleton for update;
  if p_revision is null or f.revision<>p_revision then raise exception 'Finale changed; reload before saving'; end if;
  if p_action='unpublish' then
    update public.finale_settings set published=null,published_revision=null,revision=revision+1 where singleton;
    return;
  end if;
  if p_action is null or p_action not in ('save','publish') then raise exception 'Invalid action'; end if;
  if p_content is null or jsonb_typeof(p_content)<>'object'
    or jsonb_typeof(p_content->'title') is distinct from 'string' or length(trim(p_content->>'title')) not between 1 and 120
    or jsonb_typeof(p_content->'letter') is distinct from 'string' or length(p_content->>'letter')>12000
    or jsonb_typeof(p_content->'threshold') is distinct from 'number' or (p_content->>'threshold') !~ '^[0-9]+$'
    or (p_content->>'threshold')::numeric not between 0 and 50
    or jsonb_typeof(p_content->'conversation') is distinct from 'array' then raise exception 'Invalid finale'; end if;
  if jsonb_array_length(p_content->'conversation')>30 then raise exception 'Too many lines'; end if;
  for turn in select * from jsonb_array_elements(p_content->'conversation') loop
    if jsonb_typeof(turn)<>'object' or (turn->>'speaker') is null or (turn->>'speaker') not in ('Dudu','Bubu')
      or jsonb_typeof(turn->'text') is distinct from 'string' or length(trim(turn->>'text')) not between 1 and 2000 then raise exception 'Invalid conversation'; end if;
  end loop;
  if p_action='publish' and (length(trim(p_content->>'letter'))=0 or jsonb_array_length(p_content->'conversation')=0) then raise exception 'Letter and conversation required'; end if;
  update public.finale_settings set draft=p_content,revision=revision+1,
    published=case when p_action='publish' then p_content else published end,
    published_revision=case when p_action='publish' then revision+1 else published_revision end where singleton;
end $$;

create function public.recipient_finale_status(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l uuid; f public.finale_settings; total integer; seen integer; needed integer;
begin
  l:=public.active_recipient(p_session_hash);
  select * into f from public.finale_settings where singleton;
  if f.published is null then return jsonb_build_object('available',false,'unlocked',false,'seen',0,'required',0,'completed',false); end if;
  select count(distinct c.id),count(distinct c.id) filter(where s.contribution_id is not null) into total,seen
    from public.contributions c join public.npc_placements p on p.contribution_id=c.id join public.areas a on a.id=p.area_id
    left join public.recipient_seen s on s.contribution_id=c.id and s.access_link_id=l
    where c.status='approved' and p.published and a.published and public.scene_safe(a.map_key,p.spawn_x,p.spawn_y,p.wander_radius);
  needed:=least((f.published->>'threshold')::integer,total);
  return jsonb_build_object('available',true,'unlocked',seen>=needed,'seen',seen,'required',needed,
    'completed',exists(select 1 from public.recipient_finale where access_link_id=l and revision=f.published_revision));
end $$;
create function public.recipient_ending(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare status jsonb;
begin
  -- Lock the publication snapshot for this transaction, including completion.
  perform 1 from public.finale_settings where singleton for share;
  status:=public.recipient_finale_status(p_session_hash);
  if not (status->>'unlocked')::boolean then raise exception 'Finale unavailable' using errcode='42501'; end if;
  return (select jsonb_build_object('revision',published_revision,'content',published) from public.finale_settings where singleton);
end $$;
create function public.recipient_complete_finale(p_session_hash text,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
declare ending jsonb; l uuid;
begin
  ending:=public.recipient_ending(p_session_hash);
  if p_revision is null or (ending->>'revision')::integer<>p_revision then raise exception 'Finale changed; reopen it'; end if;
  l:=public.active_recipient(p_session_hash);
  insert into public.recipient_finale(access_link_id,revision) values(l,p_revision)
    on conflict(access_link_id) do update set revision=excluded.revision,completed_at=now();
end $$;
revoke all on function public.admin_finale(),public.admin_save_finale(jsonb,integer,text) from public,anon;
grant execute on function public.admin_finale(),public.admin_save_finale(jsonb,integer,text) to authenticated;
revoke all on function public.recipient_finale_status(text),public.recipient_ending(text),public.recipient_complete_finale(text,integer) from public,anon,authenticated;
grant execute on function public.recipient_finale_status(text),public.recipient_ending(text),public.recipient_complete_finale(text,integer) to service_role;
