import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getProvider } from "../_shared/import/registry.ts";
import { decryptToken } from "../_shared/import/crypto.ts";
import type { ProviderContext, ScopeSelection } from "../_shared/import/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const action: string = body.action ?? "analyze";
    const providerId: string = body.provider;
    if (!providerId) return json({ error: "provider is required" }, 400);
    const provider = getProvider(providerId);

    // ---- resolve credentials / upload ------------------------------------
    let accessToken: string | null = null;
    let connectionId: string | null = body.connection_id ?? null;
    if (provider.auth === "oauth") {
      const { data: conn } = await admin
        .from("integration_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", providerId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!conn) return json({ error: `Connect ${provider.label} first`, code: "not_connected" }, 400);
      connectionId = conn.id;
      accessToken = await decryptToken(conn.encrypted_access_token);
    }

    const uploadPath: string | null = body.upload_path ?? null;
    if (provider.auth === "upload") {
      if (!uploadPath) return json({ error: "Upload a file first" }, 400);
      if (!uploadPath.startsWith(`${user.id}/`)) return json({ error: "Invalid upload path" }, 403);
    }

    const ctx: ProviderContext = { supabase: admin, userId: user.id, job: {}, accessToken, uploadPath };

    if (action === "scopes") {
      const scopes = await provider.listScopes(ctx);
      return json({ scopes });
    }

    // ---- analyze ---------------------------------------------------------
    const scope: ScopeSelection = body.scope ?? {};
    const projectId: string | null = body.project_id ?? null;
    if (projectId) {
      const { data: allowed } = await userClient.rpc("user_has_project_access", {
        project_id_param: projectId,
        user_id_param: user.id,
      });
      if (!allowed) return json({ error: "You don't have access to that Studio" }, 403);
    }

    const result = await provider.analyze(ctx, scope);

    const counts: Record<string, number> = {};
    for (const o of result.objects) counts[o.external_object_type] = (counts[o.external_object_type] ?? 0) + 1;

    const { data: job, error: jobErr } = await admin
      .from("import_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        connection_id: connectionId,
        provider: providerId,
        source_name: result.source_name,
        source_type: result.source_type,
        scope_selection: scope,
        status: "analyzed",
        total_items: result.objects.length,
        warnings: result.warnings,
        upload_path: uploadPath,
        preview: { counts, warnings: result.warnings },
      })
      .select()
      .single();
    if (jobErr) throw new Error(jobErr.message);

    // persist normalised source objects in chunks
    const rows = result.objects.map((o) => ({
      import_job_id: job.id,
      provider: providerId,
      external_object_id: o.external_object_id,
      external_parent_id: o.external_parent_id ?? null,
      external_object_type: o.external_object_type,
      external_url: o.external_url ?? null,
      external_author_id: o.external_author_id ?? null,
      external_author_name: o.external_author_name ?? null,
      title: o.title ?? null,
      source_created_at: o.source_created_at ?? null,
      source_updated_at: o.source_updated_at ?? null,
      raw_metadata: o.raw_metadata ?? {},
      import_status: "pending",
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("import_source_objects").upsert(rows.slice(i, i + 500), {
        onConflict: "import_job_id,external_object_id,external_object_type",
        ignoreDuplicates: true,
      });
      if (error) throw new Error(error.message);
    }

    if (result.suggested_mappings.length) {
      await admin.from("import_mappings").insert(
        result.suggested_mappings.map((m) => ({
          import_job_id: job.id,
          source_type: m.source_type,
          source_field: m.source_field,
          destination_type: m.destination_type,
          destination_field: m.destination_field,
          transformation_rule: m.transformation_rule ?? {},
          enabled: m.enabled ?? true,
          user_confirmed: false,
        })),
      );
    }

    await admin.from("import_audit_log").insert({
      import_job_id: job.id,
      action: "analyze",
      result: "ok",
      detail: { counts, provider: providerId },
    });

    return json({ job_id: job.id, counts, warnings: result.warnings, source_name: result.source_name, mappings: result.suggested_mappings });
  } catch (e) {
    console.error("import-analyze failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
