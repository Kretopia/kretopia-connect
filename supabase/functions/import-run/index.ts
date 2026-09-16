import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { job_id, mappings, project_id, new_project_title, workspace_type, retry_only } = await req.json();
    if (!job_id) return json({ error: "job_id is required" }, 400);

    const { data: job } = await admin.from("import_jobs").select("*").eq("id", job_id).maybeSingle();
    if (!job) return json({ error: "Import not found" }, 404);
    if (job.user_id !== user.id) return json({ error: "Not your import" }, 403);

    // ---- destination Studio ---------------------------------------------
    let projectId: string | null = project_id ?? job.project_id ?? null;
    if (projectId) {
      const { data: allowed } = await userClient.rpc("user_has_project_access", {
        project_id_param: projectId, user_id_param: user.id,
      });
      if (!allowed) return json({ error: "You don't have access to that Studio" }, 403);
    } else {
      const { data: created, error } = await admin
        .from("projects")
        .insert({
          title: (new_project_title || job.source_name || "Imported project").slice(0, 200),
          created_by: user.id,
          status: "active",
          workspace_type: workspace_type || "general",
          description: `Imported from ${job.provider}`,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      projectId = created.id;
    }

    // ---- persist confirmed mappings --------------------------------------
    if (Array.isArray(mappings) && mappings.length) {
      await admin.from("import_mappings").delete().eq("import_job_id", job_id);
      await admin.from("import_mappings").insert(
        mappings.map((m: any) => ({
          import_job_id: job_id,
          source_type: m.source_type,
          source_field: m.source_field ?? "object",
          destination_type: m.destination_type,
          destination_field: m.destination_field ?? null,
          transformation_rule: m.transformation_rule ?? {},
          enabled: m.enabled !== false,
          user_confirmed: true,
        })),
      );
    }

    if (retry_only) {
      await admin.from("import_source_objects")
        .update({ import_status: "pending", error: null })
        .eq("import_job_id", job_id)
        .eq("import_status", "failed");
    }

    const { count } = await admin
      .from("import_source_objects")
      .select("id", { count: "exact", head: true })
      .eq("import_job_id", job_id)
      .eq("import_status", "pending");

    await admin.from("import_jobs").update({
      project_id: projectId,
      status: "queued",
      progress_percentage: 0,
      error_summary: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      total_items: job.total_items || count || 0,
      ...(retry_only ? {} : { processed_items: 0, successful_items: 0, failed_items: 0, skipped_items: 0 }),
    }).eq("id", job_id);

    await admin.from("import_audit_log").insert({
      import_job_id: job_id, action: retry_only ? "retry" : "start", result: "ok",
      detail: { project_id: projectId, pending: count },
    });

    // fire-and-forget the background worker — the browser can close
    fetch(`${SUPABASE_URL}/functions/v1/import-worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ job_id }),
    }).catch((e) => console.error("worker kick failed", e));

    return json({ ok: true, job_id, project_id: projectId });
  } catch (e) {
    console.error("import-run failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
