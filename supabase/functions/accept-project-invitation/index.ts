import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsFor } from '../_shared/guard.ts';
// Why this exists: an invitation sent to an email address is saved with
// user_id = NULL. The invitee can neither read that row (project_collaborators'
// SELECT rule needs user_id = auth.uid()) nor update it (the "accept own
// invitation" rule needs user_id = auth.uid() too), so accepting from the
// browser silently did nothing and the new member was sent back to /circle.
//
// This function does the claim server-side, and only when it is safe:
//   - the caller is signed in and their email is CONFIRMED (the magic link in
//     the invitation email confirms it), and
//   - the invitation was addressed to exactly that email, or to that user id.
// Nobody can claim an invitation sent to someone else's address. No schema or
// RLS change: it uses the service role for this one narrow, checked write.


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, corsHeaders: Record<string, string>, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Row = {
  id: string;
  user_id: string | null;
  email: string | null;
  status: string | null;
  role: string | null;
  invited_by: string | null;
  invited_at: string | null;
};

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(corsHeaders, { error: "Unauthorized", code: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json(corsHeaders, { error: "Unauthorized", code: "unauthorized" }, 401);

    const { projectId } = await req.json().catch(() => ({ projectId: null }));
    if (typeof projectId !== "string" || !UUID_RE.test(projectId)) {
      return json(corsHeaders, { error: "Missing or invalid projectId", code: "bad_request" }, 400);
    }

    const email = (user.email ?? "").trim().toLowerCase();
    const emailConfirmed = Boolean(user.email_confirmed_at ?? (user as { confirmed_at?: string }).confirmed_at);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const columns = "id, user_id, email, status, role, invited_by, invited_at";

    // Already in? Nothing to claim.
    const { data: mine, error: mineErr } = await admin
      .from("project_collaborators")
      .select(columns)
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (mineErr) throw mineErr;
    const myRows = (mine ?? []) as Row[];
    if (myRows.some((r) => r.status === "accepted")) {
      return json(corsHeaders, { status: "already_member", projectId });
    }

    // Invitations addressed to this user id, or to this (confirmed) email.
    const candidates = new Map<string, Row>();
    for (const r of myRows) if (r.status === "pending") candidates.set(r.id, r);
    if (email && emailConfirmed) {
      const { data: byEmail, error: emailErr } = await admin
        .from("project_collaborators")
        .select(columns)
        .eq("project_id", projectId)
        .eq("status", "pending")
        .eq("email", email);
      if (emailErr) throw emailErr;
      for (const r of (byEmail ?? []) as Row[]) candidates.set(r.id, r);
    }

    if (candidates.size === 0) {
      // Say why when the likely cause is an unconfirmed address, so the page can tell the person.
      if (email && !emailConfirmed) {
        return json(corsHeaders, { error: "Confirm your email address first, then open the invitation again.", code: "email_not_confirmed" }, 403);
      }
      return json(corsHeaders, { error: "No pending invitation for this account.", code: "no_invitation" }, 404);
    }

    // Duplicates for the same person: accept the most recent invitation, close the rest.
    const ordered = [...candidates.values()].sort(
      (a, b) => new Date(b.invited_at ?? 0).getTime() - new Date(a.invited_at ?? 0).getTime(),
    );
    const [chosen, ...extras] = ordered;

    const { data: updated, error: updErr } = await admin
      .from("project_collaborators")
      .update({ status: "accepted", user_id: user.id, accepted_at: new Date().toISOString() })
      .eq("id", chosen.id)
      // Compare-and-swap on the state that was read: an owner who removes or rejects the collaborator while the
      // invitee is accepting must win, not be overwritten back to "accepted".
      .eq("status", "pending")
      .select("id");
    if (updErr) throw updErr;
    if (!updated || updated.length === 0) return json(corsHeaders, { error: "This invitation is no longer valid.", code: "no_invitation" }, 404);

    if (extras.length > 0) {
      await admin
        .from("project_collaborators")
        .update({ status: "rejected" })
        .in("id", extras.map((r) => r.id));
    }

    // Tell the person who invited them (best effort: never fail the join).
    if (chosen.invited_by && chosen.invited_by !== user.id) {
      try {
        const [{ data: project }, { data: joiner }] = await Promise.all([
          admin.from("projects").select("title").eq("id", projectId).maybeSingle(),
          admin.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
        ]);
        await admin.from("notifications").insert({
          user_id: chosen.invited_by,
          type: "project_invite_accepted",
          title: "Invite accepted",
          message: `${joiner?.full_name || "Your invitee"} joined "${project?.title || "your Studio"}".`,
          action_url: `/desk/${projectId}`,
        });
      } catch (e) {
        console.warn("accept-project-invitation: notification failed (non-fatal)", e);
      }
    }

    return json(corsHeaders, { status: "accepted", projectId, role: chosen.role });
  } catch (e) {
    console.error("accept-project-invitation error:", e);
    return json(corsHeaders, { error: e instanceof Error ? e.message : "Failed to accept the invitation", code: "server_error" }, 500);
  }
});
