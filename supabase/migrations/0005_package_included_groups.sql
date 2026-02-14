alter table public.packages
add column if not exists included_groups jsonb not null default '[]'::jsonb;

