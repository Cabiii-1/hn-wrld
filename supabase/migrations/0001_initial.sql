-- Baseline private-by-default schema. Backend endpoint design, role policies,
-- secure invite exchange and recipient session checks MUST be implemented and tested
-- before production. Not a drop-in public CRUD API.
create extension if not exists pgcrypto;

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  map_key text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  label text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  max_submissions integer not null default 1 check (max_submissions between 1 and 10),
  created_at timestamptz not null default now()
);

create type public.moderation_status as enum ('pending','approved','rejected','hidden');

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 80),
  relationship_label text check (relationship_label is null or char_length(relationship_label) <= 80),
  message_text text not null check (char_length(message_text) between 1 and 2000),
  status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contributions_by_invitation on public.contributions(invitation_id);
create index contributions_by_status on public.contributions(status);

create table public.npc_placements (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null unique references public.contributions(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete restrict,
  sprite_variant text not null default 'npc-cream-1',
  spawn_x integer not null check (spawn_x >= 0),
  spawn_y integer not null check (spawn_y >= 0),
  wander_radius integer not null default 2 check (wander_radius between 0 and 12),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index npc_placements_by_area on public.npc_placements(area_id, published);

-- Server-only opaque sessions; use a high entropy random token whose SHA-256/HMAC
-- digest is kept here, never the raw cookie/token value.
create table public.recipient_sessions (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.contributor_sessions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.areas (slug, name, map_key) values
('sta-ana', 'Sta. Ana Seaside', 'sta_ana'),
('tuguegarao', 'Tuguegarao City', 'tuguegarao'),
('baguio', 'Baguio Campus', 'baguio');

-- Row Level Security: browser roles get no policies by default; deny all.
alter table public.areas enable row level security;
alter table public.admin_members enable row level security;
alter table public.invitations enable row level security;
alter table public.contributions enable row level security;
alter table public.npc_placements enable row level security;
alter table public.recipient_sessions enable row level security;
alter table public.contributor_sessions enable row level security;

-- No permissive policies here by design. A deliberately privileged server backend
-- must authorize every request; service keys MUST remain server-only.
