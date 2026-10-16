-- Extension to 0001: media metadata and revocable recipient access links.
-- Requires server-only upload authorization, codec validation, EXIF sanitation,
-- signed-media URL access policy, moderation and orphan cleanup before launch.

create type public.media_kind as enum ('photo', 'audio');
create type public.media_status as enum ('pending', 'approved', 'rejected', 'deleted');

create table public.contribution_media (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  kind public.media_kind not null,
  status public.media_status not null default 'pending',
  storage_bucket text not null default 'bubu-contributions' check (storage_bucket = 'bubu-contributions'),
  storage_path text not null unique,
  media_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 90000),
  description text check (description is null or char_length(description) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_has_no_duration check (kind <> 'photo' or duration_ms is null)
);
create index contribution_media_by_parent on public.contribution_media(contribution_id);
create index contribution_media_by_status on public.contribution_media(status);

create table public.recipient_access_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.contribution_media enable row level security;
alter table public.recipient_access_links enable row level security;
-- No browser-role policies. Backend must check contributor scope/admin authorization
-- and approved + published state before issuing access to uploaded objects.

insert into storage.buckets (id, name, public, file_size_limit)
values ('bubu-contributions', 'bubu-contributions', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = 15728640;

-- No storage.objects policy for public/anon/authenticated users.
-- Upload/download operations must go through server-authorized workflows.
-- A bucket-wide file limit does not enforce per-type limits; do so in API.
