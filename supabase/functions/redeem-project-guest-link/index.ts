// Redeem a project guest link: creates an accepted project_collaborators row
// (role='guest') for the calling user, increments use count, returns project id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


import { corsFor } from '../_shared/guard.ts';
import { publicPerimeter } from '../_shared/publicPerimeter.ts';
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await publicPerimeter(req, "redeem-project-guest-link", 10);
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

    const LINK_COLUMNS = "id, project_id, expires_at, max_uses, uses, revoked_at, permissions, guest_role, created_by";
    const { data: firstRead, error: linkErr } = await admin
      .from("project_guest_links")
      .select(LINK_COLUMNS)
      .eq("token", token)
      .maybeSingle();
    if (linkErr || !firstRead) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reserve the use BEFORE granting anything. The limit used to be checked on a read and the counter written
    // afterwards from that same read, so people redeeming at once all passed the check (a single-use link admitted
    // everyone who opened it together), the counter lost updates, and a link revoked in between still let the person
    // in. Now one conditional update takes the use only if the counter and the revocation are still what was read; a
    // loser re-reads and re-checks (bounded), so an unlimited link still admits everyone and counts every use.
    const gone = (message: string) =>
      new Response(JSON.stringify({ error: message }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    let link = firstRead;
    let reserved = false;
    // Each lost compare-and-swap means someone else took a use, so a limited link needs at most (uses left + 1)
    // attempts before it is either won or fully redeemed; an unlimited link gets a generous fixed bound.
    const maxAttempts = firstRead.max_uses != null ? Math.min(100, Math.max(2, firstRead.max_uses - firstRead.uses + 2)) : 40;
    for (let attempt = 0; attempt < maxAttempts && !reserved; attempt++) {
      if (link.revoked_at) return gone("This link has been revoked");
      if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return gone("This link has expired");
      if (link.max_uses != null && link.uses >= link.max_uses) return gone("This link is fully redeemed");

      const { data: won, error: reserveErr } = await admin
        .from("project_guest_links")
        .update({ uses: link.uses + 1 })
        .eq("id", link.id)
        .eq("uses", link.uses)
        .is("revoked_at", null)
        .select("id");
      if (reserveErr) throw reserveErr;
      if (won && won.length > 0) {
        reserved = true;
        break;
      }

      const { data: fresh } = await admin.from("project_guest_links").select(LINK_COLUMNS).eq("id", link.id).maybeSingle();
      if (!fresh) {
        return new Response(JSON.stringify({ error: "Link not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      link = fresh;
    }
    if (!reserved) {
      return new Response(JSON.stringify({ error: "This link is busy right now. Try again in a moment." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Gives the reserved use back if the person could not be added (best effort: only if nobody else moved the counter).
    const releaseUse = () =>
      admin.from("project_guest_links").update({ uses: link.uses }).eq("id", link.id).eq("uses", link.uses + 1).then(() => {}, () => {});

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
        await releaseUse();
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
