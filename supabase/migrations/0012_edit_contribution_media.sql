-- Revisions stage new files privately; saved attachments change only on commit.
create or replace function public.reserve_upload(p_session_hash text,p_id uuid,p_kind public.media_kind,p_bytes bigint,
  p_extension text,p_mime text,p_description text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_path text;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  perform 1 from public.invitations where id=v_id for update;
  if public.active_contributor(p_session_hash) is distinct from v_id then raise exception 'Session unavailable'; end if;
  if (select count(*) from public.upload_intents where invitation_id=v_id and (state='attached' or (state in ('allocated','validated') and expires_at>now())))>=24 then raise exception 'Invitation upload quota reached'; end if;
  if p_bytes < 1 or p_bytes > (case when p_kind='photo' then 5242880 else 15728640 end) then raise exception 'File too large'; end if;
  if (select count(*) from public.upload_intents where invitation_id=v_id and kind=p_kind
    and state in ('allocated','validated') and expires_at>now()) >= (case when p_kind='photo' then 3 else 1 end)
    then raise exception 'Attachment limit reached'; end if;
  v_path:='staging/'||v_id::text||'/'||p_id::text;
  insert into public.upload_intents(id,invitation_id,kind,declared_bytes,original_extension,declared_mime,staging_path,description)
  values(p_id,v_id,p_kind,p_bytes,p_extension,p_mime,v_path,p_description);
  -- A signed upload token is valid for 2h even after revoke. Wait beyond that to clean staging.
  insert into public.storage_cleanup(storage_path,not_before) values(v_path,now()+interval '3 hours');
  return v_path;
end $$;

create or replace function public.contributor_snapshot(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  return jsonb_build_object(
    'displayName',(select trim(label) from public.invitations where id=v_id),
    'submitted',exists(select 1 from public.contributions where invitation_id=v_id),
    'letter',(select jsonb_build_object('message',c.message_text,'version',c.updated_at,
      'media',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'state','attached','status',m.status,'description',coalesce(m.description,'')) order by m.created_at,m.id)
        from public.contribution_media m where m.contribution_id=c.id and m.status<>'deleted'),'[]'::jsonb))
      from public.contributions c where c.invitation_id=v_id order by c.created_at limit 1),
    'uploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'description',description))
      from public.upload_intents where invitation_id=v_id and state in ('allocated','validated') and expires_at>now()),'[]'::jsonb));
end $$;

create function public.edit_contribution_media(p_session_hash text,p_message text,p_version timestamptz,p_retained jsonb,p_upload_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid; c public.contributions; kept uuid[]; item jsonb;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  perform 1 from public.invitations where id=v_id for update;
  if public.active_contributor(p_session_hash) is distinct from v_id then raise exception 'Session unavailable'; end if;
  select * into c from public.contributions where invitation_id=v_id order by created_at limit 1 for update;
  if not found or p_version is null or c.updated_at<>p_version then raise exception 'Letter changed; reopen before saving'; end if;
  if p_message is null or char_length(trim(p_message)) not between 1 and 2000 then raise exception 'Invalid message'; end if;
  if p_retained is null or jsonb_typeof(p_retained)<>'array' or jsonb_array_length(p_retained)>4 then raise exception 'Invalid retained media'; end if;
  for item in select * from jsonb_array_elements(p_retained) loop
    if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'id') is distinct from 'string'
      or jsonb_typeof(item->'description') is distinct from 'string' or char_length(item->>'description')>300 then raise exception 'Invalid attachment'; end if;
  end loop;
  select coalesce(array_agg((v->>'id')::uuid),'{}'::uuid[]) into kept from jsonb_array_elements(p_retained) v;
  if cardinality(kept)<>(select count(distinct x) from unnest(kept) x) or p_upload_ids is null
    or cardinality(p_upload_ids)<>(select count(distinct x) from unnest(p_upload_ids) x)
    or cardinality(kept)+cardinality(p_upload_ids)>4 then raise exception 'Invalid attachments'; end if;
  perform 1 from public.contribution_media where contribution_id=c.id order by id for update;
  if (select count(*) from public.contribution_media where id=any(kept) and contribution_id=c.id and status<>'deleted')<>cardinality(kept) then raise exception 'Attachment unavailable'; end if;
  perform 1 from public.upload_intents where id=any(p_upload_ids) order by id for update;
  if (select count(*) from public.upload_intents where id=any(p_upload_ids) and invitation_id=v_id and state='validated' and expires_at>now())<>cardinality(p_upload_ids) then raise exception 'Upload unavailable'; end if;
  if (select count(*) from (select kind from public.contribution_media where id=any(kept) union all select kind from public.upload_intents where id=any(p_upload_ids)) q where kind='photo')>3
    or (select count(*) from (select kind from public.contribution_media where id=any(kept) union all select kind from public.upload_intents where id=any(p_upload_ids)) q where kind='audio')>1 then raise exception 'Attachment limit reached'; end if;

  insert into public.storage_cleanup(storage_path) select storage_path from public.contribution_media where contribution_id=c.id and status<>'deleted' and not(id=any(kept)) on conflict do nothing;
  update public.upload_intents set state='deleted' where id in (select id from public.contribution_media where contribution_id=c.id and status<>'deleted' and not(id=any(kept)));
  update public.contribution_media set status='deleted',description=null,updated_at=now() where contribution_id=c.id and not(id=any(kept)) and status<>'deleted';
  update public.contribution_media m set description=v->>'description',
    status=case when m.status='rejected' then 'rejected'::public.media_status when coalesce(m.description,'') is distinct from v->>'description' then 'pending'::public.media_status else m.status end,
    updated_at=now() from jsonb_array_elements(p_retained) v where m.id=(v->>'id')::uuid and m.contribution_id=c.id;
  insert into public.contribution_media(id,contribution_id,kind,storage_path,media_type,file_size_bytes,duration_ms,description)
    select id,c.id,kind,final_path,final_mime,final_bytes,duration_ms,description from public.upload_intents where id=any(p_upload_ids);
  update public.upload_intents set state='attached' where id=any(p_upload_ids);
  update public.contributions set message_text=trim(p_message),status='pending',updated_at=clock_timestamp() where id=c.id;
  update public.npc_placements set published=false where contribution_id=c.id;
end $$;
revoke all on function public.edit_contribution_media(text,text,timestamptz,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.edit_contribution_media(text,text,timestamptz,jsonb,uuid[]) to service_role;

