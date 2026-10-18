-- Encrypted recovery is for allowlisted admins only. Token verification still
-- uses the HMAC hash; the encryption key lives only in the application server.
alter table public.invitations add column link_ciphertext text;

create function public.admin_issue_invite(p_id uuid,p_hash text,p_cipher text,p_label text,p_expires timestamptz,p_replace boolean) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_world_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_hash is null or p_cipher is null or char_length(p_cipher) not between 40 and 500 then raise exception 'Invalid link'; end if;
  if p_replace then
    perform 1 from public.invitations where id=p_id and revoked_at is null and (expires_at is null or expires_at>now()) for update;
    if not found then raise exception 'Invitation unavailable'; end if;
    update public.invitations set token_hash=p_hash,link_ciphertext=p_cipher where id=p_id;
    update public.contributor_sessions set revoked_at=now() where invitation_id=p_id;
  else
    if p_label is null or char_length(trim(p_label)) not between 1 and 80 or (p_expires is not null and p_expires<=now()) then raise exception 'Invalid invitation'; end if;
    insert into public.invitations(id,token_hash,link_ciphertext,label,expires_at) values(p_id,p_hash,p_cipher,trim(p_label),p_expires);
  end if;
  return p_id;
end $$;
revoke all on function public.admin_issue_invite(uuid,text,text,text,timestamptz,boolean) from public,anon;
grant execute on function public.admin_issue_invite(uuid,text,text,text,timestamptz,boolean) to authenticated;

-- Returning invitees can reopen their own letter; submission quotas still block
-- additional letters. Exchanges continue to invalidate earlier browser sessions.
create or replace function public.exchange_invitation(p_token_hash text,p_session_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.invitations; s uuid;
begin
  select * into i from public.invitations where token_hash=p_token_hash for update;
  if not found or i.revoked_at is not null or (i.expires_at is not null and i.expires_at<=now()) then raise exception 'Invitation unavailable'; end if;
  update public.contributor_sessions set revoked_at=now() where invitation_id=i.id and revoked_at is null;
  insert into public.contributor_sessions(invitation_id,session_hash,expires_at)
    values(i.id,p_session_hash,least(coalesce(i.expires_at,now()+interval '2 hours'),now()+interval '2 hours')) returning id into s;
  return s;
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
    'letter',(select jsonb_build_object('message',message_text,'version',updated_at) from public.contributions where invitation_id=v_id order by created_at limit 1),
    'uploads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',state,'description',description))
      from public.upload_intents where invitation_id=v_id and state in ('allocated','validated') and expires_at>now()),'[]'::jsonb));
end $$;

create function public.edit_contribution(p_session_hash text,p_message text,p_version timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid; c public.contributions;
begin
  v_id:=public.active_contributor(p_session_hash);
  if v_id is null then raise exception 'Session unavailable'; end if;
  perform 1 from public.invitations where id=v_id for update;
  if public.active_contributor(p_session_hash) is distinct from v_id then raise exception 'Session unavailable'; end if;
  select * into c from public.contributions where invitation_id=v_id order by created_at limit 1 for update;
  if not found or p_version is null or c.updated_at<>p_version then raise exception 'Letter changed; reopen it before saving'; end if;
  if p_message is null or char_length(trim(p_message)) not between 1 and 2000 then raise exception 'Invalid message'; end if;
  update public.contributions set message_text=trim(p_message),status='pending',updated_at=clock_timestamp() where id=c.id;
  update public.npc_placements set published=false where contribution_id=c.id;
end $$;
revoke all on function public.edit_contribution(text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.edit_contribution(text,text,timestamptz) to service_role;
