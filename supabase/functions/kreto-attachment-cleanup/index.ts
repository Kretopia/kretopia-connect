import { createClient } from 'npm:@supabase/supabase-js@2';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { ATTACHMENT_BUCKET } from '../_shared/kretoAttachmentPolicy.ts';

Deno.serve(async request => {
  const denial = authenticateCronRequest(request);
  if (denial) return denial;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Unavailable', { status: 503 });
  const admin = createClient(url, key);
  let removed = 0;
  // Bounded batch loop; retain reference on storage error so deletion retries.
  for (let batch = 0; batch < 20; batch++) {
    const { data, error } = await admin.from('kreto_attachments').select('id,object_path').lte('expires_at', new Date().toISOString()).order('expires_at').limit(100);
    if (error) return new Response('Cleanup failed', { status: 503 });
    if (!data?.length) break;
    const { error: storageError } = await admin.storage.from(ATTACHMENT_BUCKET).remove(data.map(r => r.object_path));
    if (storageError) return new Response('Cleanup failed', { status: 503 });
    const { error: deleteError } = await admin.from('kreto_attachments').delete().in('id', data.map(r => r.id));
    if (deleteError) return new Response('Cleanup failed', { status: 503 });
    removed += data.length;
  }
  return Response.json({ removed });
});