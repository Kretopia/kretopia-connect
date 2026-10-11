-- KRETOPIA — Repair private message attachments (run on the LEGACY production backend only).
-- Safe to run several times. No files moved or deleted. No table changes.

-- 1. Make sure the private bucket exists and stays private.
insert into storage.buckets (id, name, public, file_size_limit)
values ('message-attachments', 'message-attachments', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400, allowed_mime_types = null;

-- 2. Re-create the three access rules (drop first so a partial run is fixed).
drop policy if exists "msg_att_insert_sender_only" on storage.objects;
drop policy if exists "msg_att_select_participants" on storage.objects;
drop policy if exists "msg_att_delete_sender" on storage.objects;

create policy "msg_att_insert_sender_only"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] <> auth.uid()::text
);

create policy "msg_att_select_participants"
on storage.objects for select to authenticated
using (
  bucket_id = 'message-attachments'
  and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
);

create policy "msg_att_delete_sender"
on storage.objects for delete to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Check: must return exactly 3 rows (INSERT, SELECT, DELETE).
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'msg_att_%'
order by policyname;
