alter table public.packages
add column if not exists media_urls jsonb not null default '[]'::jsonb;

