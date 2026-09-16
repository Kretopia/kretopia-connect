// Background import worker. Processes a bounded batch then re-invokes itself.
// Invoked with the service-role key only (never from the browser).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sortForWrite, writeObject } from "../_shared/import/writer.ts";
import type { Mapping, SourceObject } from "../_shared/import/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let jobId: string | null = null;

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.includes(SERVICE_KEY)) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    jobId = body.job_id;
    if (!jobId) return json({ error: "job_id required" }, 400);

    const { data: job } = await admin.from("import_jobs").select("*").eq("id", jobId).maybeSingle();
    if (!job) return json({ error: "job not found" }, 404);
    if (!job.project_id) throw new Error("Import job has no destination Studio");
    if (!["queued", "running"].includes(job.status)) return json({ ok: true, skipped: job.status });

    await admin.from("import_jobs").update({ status: "running" }).eq("id", jobId);

    const { data: mapRows } = await admin.from("import_mappings").select("*").eq("import_job_id", jobId);
    const mappings: Mapping[] = (mapRows ?? []).map((m: any) => ({
      source_type: m.source_type,
      source_field: m.source_field,
      destination_type: m.destination_type,
      destination_field: m.destination_field,
      transformation_rule: m.transformation_rule ?? {},
      enabled: m.enabled,
    }));

    const { data: pending } = await admin
      .from("import_source_objects")
      .select("*")
      .eq("import_job_id", jobId)
      .eq("import_status", "pending")
      .limit(BATCH);

    if (!pending?.length) {
      const { count: failed } = await admin.from("import_source_objects")
        .select("id", { count: "exact", head: true })
        .eq("import_job_id", jobId).eq("import_status", "failed");
      await admin.from("import_jobs").update({
        status: "completed",
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        error_summary: failed ? `${failed} item(s) could not be imported. You can retry them.` : null,
      }).eq("id", jobId);
      await admin.from("import_audit_log").insert({ import_job_id: jobId, action: "complete", result: "ok" });
      return json({ ok: true, done: true });
    }

    // parent id map so replies/threads can resolve to created rows
    const { data: doneRows } = await admin
      .from("import_source_objects")
      .select("external_object_id,destination_id")
      .eq("import_job_id", jobId)
      .eq("import_status", "imported")
      .not("destination_id", "is", null)
      .limit(5000);
    const idMap = new Map<string, string>((doneRows ?? []).map((r: any) => [r.external_object_id, r.destination_id]));

    const objects: SourceObject[] = sortForWrite(pending.map((r: any) => ({
      external_object_id: r.external_object_id,
      external_parent_id: r.external_parent_id,
      external_object_type: r.external_object_type,
      external_url: r.external_url,
      external_author_id: r.external_author_id,
      external_author_name: r.external_author_name,
      title: r.title,
      source_created_at: r.source_created_at,
      source_updated_at: r.source_updated_at,
      raw_metadata: r.raw_metadata ?? {},
    })));
    const rowByExternal = new Map(pending.map((r: any) => [`${r.external_object_id}:${r.external_object_type}`, r]));

    let created = 0, skipped = 0, failed = 0;
    const auditRows: any[] = [];

    for (const obj of objects) {
      const row = rowByExternal.get(`${obj.external_object_id}:${obj.external_object_type}`);
      let res;
      try {
        res = await writeObject(admin, {
          projectId: job.project_id,
          userId: job.user_id,
          jobId: job.id,
          provider: job.provider,
          mappings,
          obj,
          idMap,
        });
      } catch (e) {
        res = { result: "failed" as const, error: (e as Error).message };
      }

      const status = res.result === "failed" ? "failed" : res.result === "created" ? "imported" : "skipped";
      if (res.result === "created") created++;
      else if (res.result === "failed") failed++;
      else skipped++;

      await admin.from("import_source_objects").update({
        import_status: status,
        destination_table: res.table ?? null,
        destination_id: res.id ?? null,
        error: res.error ?? null,
      }).eq("id", row.id);

      auditRows.push({
        import_job_id: jobId,
        action: `write:${obj.external_object_type}`,
        source_object_id: row.id,
        destination_table: res.table ?? null,
        destination_object_id: res.id ?? null,
        result: res.result,
        error: res.error ?? null,
      });
    }

    if (auditRows.length) await admin.from("import_audit_log").insert(auditRows);

    const processed = (job.processed_items ?? 0) + objects.length;
    const total = Math.max(job.total_items ?? 0, processed);
    await admin.from("import_jobs").update({
      processed_items: processed,
      successful_items: (job.successful_items ?? 0) + created,
      failed_items: (job.failed_items ?? 0) + failed,
      skipped_items: (job.skipped_items ?? 0) + skipped,
      total_items: total,
      progress_percentage: total ? Math.min(99, Math.round((processed / total) * 100)) : 0,
    }).eq("id", jobId);

    // continue with the next batch
    fetch(`${SUPABASE_URL}/functions/v1/import-worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ job_id: jobId }),
    }).catch((e) => console.error("continue failed", e));

    return json({ ok: true, created, skipped, failed });
  } catch (e) {
    console.error("import-worker failed:", e);
    if (jobId) {
      await admin.from("import_jobs").update({
        status: "failed",
        error_summary: (e as Error).message,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
      await admin.from("import_audit_log").insert({
        import_job_id: jobId, action: "worker_error", result: "failed", error: (e as Error).message,
      });
    }
    return json({ error: (e as Error).message }, 500);
  }
});
