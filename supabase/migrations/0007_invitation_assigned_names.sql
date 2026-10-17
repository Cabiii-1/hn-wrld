-- Identity is chosen by the administrator when creating the invitation.
-- Keep RPC signatures compatible with already-open contributor forms, but never
-- use client-supplied names or relationships for new submissions.
create or replace function public.contributor_snapshot(p_session_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  return jsonb_build_object(
    'displayName',(select trim(label) from public.invitations where id=v_id),
    'submitted',exists(select 1 from public.contributions where invitation_id=v_id),
    'uploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'description',description))
      from public.upload_intents where invitation_id=v_id and state in ('allocated','validated') and expires_at>now()),'[]'::jsonb));
end $$;

create or replace function public.submit_contribution(p_session_hash text,p_name text,p_relationship text,p_message text,p_upload_ids uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; i public.invitations; c uuid;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  select * into i from public.invitations where id=v_id for update;
  if public.active_contributor(p_session_hash) is distinct from v_id then raise exception 'Session unavailable'; end if;
  if (select count(*) from public.contributions where invitation_id=v_id)>=i.max_submissions then raise exception 'Already submitted'; end if;
  if p_message is null or char_length(trim(p_message)) not between 1 and 2000
    or char_length(trim(i.label)) not between 1 and 80 then raise exception 'Invalid contribution'; end if;
  if p_upload_ids is null or cardinality(p_upload_ids)>4 or cardinality(p_upload_ids)<>(select count(distinct x) from unnest(p_upload_ids) x)
    then raise exception 'Invalid attachments'; end if;
  perform 1 from public.upload_intents where id=any(p_upload_ids) order by id for update;
  if (select count(*) from public.upload_intents where id=any(p_upload_ids) and invitation_id=v_id and state='validated' and expires_at>now())<>cardinality(p_upload_ids)
    or (select count(*) from public.upload_intents where id=any(p_upload_ids) and kind='photo')>3
    or (select count(*) from public.upload_intents where id=any(p_upload_ids) and kind='audio')>1 then raise exception 'Invalid attachments'; end if;
  insert into public.contributions(invitation_id,display_name,relationship_label,message_text)
    values(v_id,trim(i.label),null,trim(p_message)) returning id into c;
  insert into public.contribution_media(id,contribution_id,kind,storage_path,media_type,file_size_bytes,duration_ms,description)
    select id,c,kind,final_path,final_mime,final_bytes,duration_ms,description from public.upload_intents where id=any(p_upload_ids);
  update public.upload_intents set state='attached' where id=any(p_upload_ids);
  return c;
end $$;
revoke all on function public.contributor_snapshot(text),public.submit_contribution(text,text,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.contributor_snapshot(text),public.submit_contribution(text,text,text,text,uuid[]) to service_role;
