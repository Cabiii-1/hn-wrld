-- New speaker names, with legacy IDs accepted for saved drafts and open editors.
-- Existing authored text, publication state, revisions and progress are preserved.
create or replace function public.admin_save_finale(p_content jsonb,p_revision integer,p_action text) returns void
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
    if jsonb_typeof(turn)<>'object' or (turn->>'speaker') is null or (turn->>'speaker') not in ('Cj','Hanna','Dudu','Bubu')
      or jsonb_typeof(turn->'text') is distinct from 'string' or length(trim(turn->>'text')) not between 1 and 2000 then raise exception 'Invalid conversation'; end if;
  end loop;
  if p_action='publish' and (length(trim(p_content->>'letter'))=0 or jsonb_array_length(p_content->'conversation')=0) then raise exception 'Letter and conversation required'; end if;
  update public.finale_settings set draft=p_content,revision=revision+1,
    published=case when p_action='publish' then p_content else published end,
    published_revision=case when p_action='publish' then revision+1 else published_revision end where singleton;
end $$;

