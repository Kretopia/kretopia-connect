-- KRETOPIA — Private message attachments (apply on the LEGACY production backend).
-- Reversible: the app keeps using the public `portfolio` bucket until
-- PRIVATE_MESSAGE_ATTACHMENTS is set to true in src/lib/messageAttachments.ts.
-- No table changes. No historical files moved or deleted.

-- 1. Private bucket (25 MB per file). Never set public = true.
insert into storage.buckets (id, name, public, file_size_limit)
values ('message-attachments', 'message-attachments', false, 26214400)
on conflict (id) do update set public = false;

-- Path convention: {sender_uid}/{receiver_uid}/{random_uuid}.{ext}

-- 2. Upload: only into your own sender folder, receiver must be a UUID other than you.
create policy "msg_att_insert_sender_only"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] <> auth.uid()::text
);

-- 3. Read / sign: only the two participants named in the path.
create policy "msg_att_select_participants"
on storage.objects for select to authenticated
using (
  bucket_id = 'message-attachments'
  and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
);

-- 4. Delete: sender only (cleanup of orphaned uploads).
create policy "msg_att_delete_sender"
on storage.objects for delete to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ROLLBACK (only if needed; files stay in place):
-- drop policy "msg_att_insert_sender_only" on storage.objects;
-- drop policy "msg_att_select_participants" on storage.objects;
-- drop policy "msg_att_delete_sender" on storage.objects;
