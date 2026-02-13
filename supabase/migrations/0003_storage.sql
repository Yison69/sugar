insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

create policy "public_read_media" on storage.objects
for select
to anon
using (bucket_id = 'media');

