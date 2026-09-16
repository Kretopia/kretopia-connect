// Redeem a project guest link: creates an accepted project_collaborators row
// (role='guest') for the calling user, increments use count, returns project id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Sign in to join as guest" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey);

    const { data: link, error: linkErr } = await admin
      .from("project_guest_links")
      .select("id, project_id, expires_at, max_uses, uses, revoked_at, permissions, guest_role, created_by")
      .eq("token", token)
      .maybeSingle();
    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.revoked_at) {
      return new Response(JSON.stringify({ error: "This link has been revoked" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "This link has expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (link.max_uses != null && link.uses >= link.max_uses) {
      return new Response(JSON.stringify({ error: "This link is fully redeemed" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already a member?
    const { data: existing } = await admin
      .from("project_collaborators")
      .select("id, status, role")
      .eq("project_id", link.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    // All three guest-link tiers (viewer/commenter/contributor) write
    // role: 'guest' unconditionally -- role is the only column any RLS
    // policy can see, and per STUDIO_CURRENT_STATE_AUDIT.md finding 1's
    // remediation (20260825100000_studio_role_based_money_rls.sql),
    // it now gates money visibility. Previously this mapped
    // contributor -> 'collaborator' and commenter -> 'commenter',
    // which (a) used role values no other code path ever wrote, and
    // (b) meant a guest-link "contributor" became textually
    // indistinguishable from a real, fully-trusted team member once
    // role-based RLS existed -- a real privilege-escalation path
    // (finding 2). The comment/contribute distinction between tiers is
    // still available via project_guest_links.permissions (JSON,
    // already fetched into `link` above) for any UI or RPC that needs
    // it -- that column was always the right place for this
    // distinction, not the same `role` column money-visibility reads.
    const guestRole = (link as any).guest_role || "viewer";
    const collabRole = "guest";

    const isNewJoin = !existing;

    if (!existing) {
      const { error: insertErr } = await admin.from("project_collaborators").insert({
        project_id: link.project_id,
        user_id: user.id,
        role: collabRole,
        status: "accepted",
        invited_by: link.created_by,
        accepted_at: new Date().toISOString(),
      });
      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (existing.status !== "accepted") {
      await admin
        .from("project_collaborators")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", existing.id);
    }

    await admin
      .from("project_guest_links")
      .update({ uses: link.uses + 1 })
      .eq("id", link.id);

    // Notify the link creator (owner/inviter) when a fresh guest joins
    if (isNewJoin && link.created_by && link.created_by !== user.id) {
      const [{ data: project }, { data: joiner }] = await Promise.all([
        admin.from("projects").select("title").eq("id", link.project_id).maybeSingle(),
        admin.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
      ]);
      await admin.from("notifications").insert({
        user_id: link.created_by,
        type: "project_guest_joined",
        title: "Guest joined your Studio",
        message: `${joiner?.full_name || "A guest"} joined "${project?.title || "your Studio"}" as ${guestRole}.`,
        action_url: `/desk/${link.project_id}`,
        metadata: { project_id: link.project_id, joined_user_id: user.id, guest_role: guestRole },
      }).then(() => {}, () => {});
    }

    return new Response(
      JSON.stringify({
        project_id: link.project_id,
        permissions: link.permissions,
        joined: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
