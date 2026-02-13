create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists likes_target_idx on public.likes (target_type, target_id);

alter table public.likes enable row level security;

