// Public edge function — no JWT required.
// Validates a guest review token and returns scoped data, signs file URLs,
// logs views, and accepts approval submissions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import {
  approvalNeedsListing,
  decideApprovalTarget,
  type ShareVisibleFile,
} from "../_shared/shareLinkScope.ts";

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

// Share-link passwords were guessable without limit. Per-instance and in memory, so best-effort (a
// determined attacker spreading over instances is slowed, not stopped); the real defence is a long
// random link token plus this brake on the password step.
const PASSWORD_WINDOW_MS = 10 * 60_000;
const PASSWORD_MAX_FAILURES = 10;
const passwordFailures = new Map<string, { n: number; first: number }>();

function passwordThrottled(key: string): boolean {
  const e = passwordFailures.get(key);
  if (!e) return false;
  if (Date.now() - e.first > PASSWORD_WINDOW_MS) {
    passwordFailures.delete(key);
    return false;
  }
  return e.n >= PASSWORD_MAX_FAILURES;
}

function notePasswordFailure(key: string) {
  const e = passwordFailures.get(key);
  if (!e || Date.now() - e.first > PASSWORD_WINDOW_MS) passwordFailures.set(key, { n: 1, first: Date.now() });
  else e.n += 1;
  if (passwordFailures.size > 5000) passwordFailures.clear();
}

const clip = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, token, password } = body as {
      action: string;
      token: string;
      password?: string;
    };

    if (!action || !token || typeof token !== "string" || token.length > 200) {
      return json({ error: "Missing action or token" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const throttleKey = `${clientIp}|${token.slice(0, 24)}`;
    if (password && passwordThrottled(throttleKey)) {
      return json({ error: "too_many_attempts" }, 429);
    }

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
      if (password) notePasswordFailure(throttleKey);
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
        _viewer_name: clip(body.viewer_name, 120),
        _viewer_email: clip(body.viewer_email, 254),
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
      const signerName = clip(signer_name, 120);
      const signerEmail = clip(signer_email, 254);
      const approvalNote = clip(note, 2000);
      if (!signerName) return json({ error: "Missing signer_name or decision" }, 400);
      if (signerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signerEmail)) {
        return json({ error: "invalid_signer_email" }, 400);
      }

      // Bind the target to the link. This function writes with the service
      // role, so without these checks any holder of ANY valid link could
      // approve a deliverable (or record an approval for a file) in an
      // unrelated project by sending its id.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (deliverable_id != null && (typeof deliverable_id !== "string" || !UUID_RE.test(deliverable_id))) {
        return json({ error: "invalid_deliverable" }, 400);
      }
      if (file_id != null && (typeof file_id !== "string" || !UUID_RE.test(file_id))) {
        return json({ error: "invalid_file" }, 400);
      }
      if (deliverable_id) {
        const { data: target, error: targetErr } = await supabase
          .from("project_deliverables")
          .select("id, project_id")
          .eq("id", deliverable_id)
          .maybeSingle();
        if (targetErr || !target || target.project_id !== link.project_id) {
          return json({ error: "deliverable_not_in_scope" }, 403);
        }
        // A deliverable-scoped link covers exactly that one deliverable.
        if (link.scope === "deliverable" && link.scope_ref_id && link.scope_ref_id !== deliverable_id) {
          return json({ error: "deliverable_not_in_scope" }, 403);
        }
      }
      if (file_id) {
        const { data: fileRow, error: fileErr } = await supabase
          .from("project_files")
          .select("id, project_id")
          .eq("id", file_id)
          .maybeSingle();
        if (fileErr || !fileRow || fileRow.project_id !== link.project_id) {
          return json({ error: "file_not_in_scope" }, 403);
        }
      }

      // Same project is not the same scope: a folder or deliverable link
      // covers only what list_share_link_files exposes for it. That listing
      // is the one definition of the link's scope, so the target is checked
      // against it rather than against a second copy of the rules.
      let visibleFiles: ShareVisibleFile[] | null = [];
      if (approvalNeedsListing({ scope: link.scope, deliverableId: deliverable_id, fileId: file_id })) {
        const { data: listed, error: listErr } = await supabase.rpc("list_share_link_files", { _token: token });
        visibleFiles = listErr || !Array.isArray(listed)
          ? null
          : (listed as any[]).map((r) => ({ file_id: r.file_id, deliverable_id: r.deliverable_id ?? null }));
      }
      const inScope = decideApprovalTarget({
        scope: link.scope,
        scopeRefId: link.scope_ref_id,
        deliverableId: deliverable_id ?? null,
        fileId: file_id ?? null,
        visibleFiles,
      });
      if (!inScope.ok) return json({ error: inScope.error }, inScope.status);

      // A slow response and a second click must not record the decision twice (and flip the
      // status twice): an identical decision on the same target by the same signer in the last
      // 10 minutes is the same decision.
      let dupQ = supabase
        .from("share_link_approvals")
        .select("id")
        .eq("share_link_id", link.share_link_id)
        .eq("decision", decision)
        .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
        .limit(1);
      dupQ = deliverable_id ? dupQ.eq("deliverable_id", deliverable_id) : dupQ.is("deliverable_id", null);
      dupQ = file_id ? dupQ.eq("file_id", file_id) : dupQ.is("file_id", null);
      dupQ = signerEmail ? dupQ.eq("signer_email", signerEmail) : dupQ.eq("signer_name", signerName);
      const { data: duplicate } = await dupQ;
      if (duplicate?.length) return json({ ok: true, duplicate: true });

      const { error: insErr } = await supabase
        .from("share_link_approvals")
        .insert({
          share_link_id: link.share_link_id,
          deliverable_id: deliverable_id ?? null,
          file_id: file_id ?? null,
          signer_name: signerName,
          signer_email: signerEmail,
          decision,
          note: approvalNote,
        });
      if (insErr) return json({ error: insErr.message }, 500);

      // If approving a deliverable, update its status (service role bypasses RLS).
      if (deliverable_id) {
        await supabase
          .from("project_deliverables")
          .update({
            status: decision === "approved" ? "approved" : "revision_requested",
          })
          .eq("id", deliverable_id)
          .eq("project_id", link.project_id);
      }

      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "unexpected_error" }, 500);
  }
});
