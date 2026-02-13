create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  cover_url text not null default '',
  image_urls jsonb not null default '[]'::jsonb,
  description text,
  is_published boolean not null default false,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists works_category_published_created_at_idx on public.works (category, is_published, created_at desc);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  cover_url text not null default '',
  base_price integer not null default 0,
  description text,
  deliverables text,
  option_groups jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists packages_category_published_created_at_idx on public.packages (category, is_published, created_at desc);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_openid text not null,
  item_type text not null,
  item_id text not null,
  item_title_snapshot text not null,
  selected_options_snapshot jsonb,
  price_snapshot jsonb,
  contact_name text not null,
  contact_phone text not null,
  contact_wechat text not null,
  shooting_type text not null,
  scheduled_at text not null,
  remark text,
  status text not null default '待确认',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists bookings_user_created_at_idx on public.bookings (user_openid, created_at desc);
create index if not exists bookings_status_created_at_idx on public.bookings (status, created_at desc);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value)
values ('contact', '{"wechatText":"","wechatQrUrl":""}'::jsonb)
on conflict (key) do nothing;

alter table public.admin_users enable row level security;
alter table public.works enable row level security;
alter table public.packages enable row level security;
alter table public.bookings enable row level security;
alter table public.app_config enable row level security;

create policy "public_read_published_works" on public.works
for select
to anon
using (is_published = true);

create policy "public_read_published_packages" on public.packages
for select
to anon
using (is_published = true);

create policy "public_read_contact_config" on public.app_config
for select
to anon
using (key = 'contact');

