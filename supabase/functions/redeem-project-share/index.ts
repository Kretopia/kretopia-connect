// Public edge function — no JWT required.
// Validates a guest review token and returns scoped data, signs file URLs,
// logs views, and accepts approval submissions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, token, password } = body as {
      action: string;
      token: string;
      password?: string;
    };

    if (!action || !token) return json({ error: "Missing action or token" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---- Resolve link ----
    const { data: resolvedRows, error: resolveErr } = await supabase.rpc(
      "resolve_project_share_link",
      { _token: token, _password: password ?? null }
    );
    if (resolveErr) return json({ error: resolveErr.message }, 500);

    const link = (resolvedRows as any[])?.[0];
    if (!link) return json({ error: "not_found" }, 404);
    if (link.revoked) return json({ error: "revoked" }, 410);
    if (link.expired) return json({ error: "expired" }, 410);
    if (link.requires_password && !link.password_ok) {
      return json({ requires_password: true, password_ok: false }, 401);
    }

    if (action === "resolve") {
      return json({
        link: {
          id: link.share_link_id,
          project_id: link.project_id,
          project_title: link.project_title,
          scope: link.scope,
          scope_ref_id: link.scope_ref_id,
          label: link.label,
          can_comment: link.can_comment,
          can_approve: link.can_approve,
          can_download: link.can_download,
          requires_password: link.requires_password,
        },
      });
    }

    if (action === "list_files") {
      const { data: files, error: filesErr } = await supabase.rpc(
        "list_share_link_files",
        { _token: token }
      );
      if (filesErr) return json({ error: filesErr.message }, 500);

      // Sign URLs
      const signed = await Promise.all(
        (files as any[]).map(async (f) => {
          let signed_url: string | null = null;
          try {
            const path = f.file_url?.startsWith("http")
              ? new URL(f.file_url).pathname.split("/project-files/")[1]
              : f.file_url;
            if (path) {
              const { data: s } = await supabase.storage
                .from("project-files")
                .createSignedUrl(path, 60 * 60);
              signed_url = s?.signedUrl ?? null;
            }
          } catch (_) {}
          return { ...f, signed_url };
        })
      );

      return json({ files: signed });
    }

    if (action === "log_view") {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ip_hash = await hashIp(ip);
      const ua = req.headers.get("user-agent") ?? null;
      await supabase.rpc("log_share_link_view", {
        _token: token,
        _viewer_name: body.viewer_name ?? null,
        _viewer_email: body.viewer_email ?? null,
        _ip_hash: ip_hash,
        _user_agent: ua,
      });
      return json({ ok: true });
    }

    if (action === "submit_approval") {
      if (!link.can_approve) return json({ error: "not_allowed" }, 403);
      const { signer_name, signer_email, decision, note, deliverable_id, file_id } =
        body;
      if (!signer_name || !decision) {
        return json({ error: "Missing signer_name or decision" }, 400);
      }
      if (!["approved", "revision_requested"].includes(decision)) {
        return json({ error: "invalid_decision" }, 400);
      }
      const { error: insErr } = await supabase
        .from("share_link_approvals")
        .insert({
          share_link_id: link.share_link_id,
          deliverable_id: deliverable_id ?? null,
          file_id: file_id ?? null,
          signer_name,
          signer_email: signer_email ?? null,
          decision,
          note: note ?? null,
        });
      if (insErr) return json({ error: insErr.message }, 500);

      // If approving a deliverable, update its status (service role bypasses RLS).
      if (deliverable_id) {
        await supabase
          .from("project_deliverables")
          .update({
            status: decision === "approved" ? "approved" : "revision_requested",
          })
          .eq("id", deliverable_id);
      }

      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "unexpected_error" }, 500);
  }
});
