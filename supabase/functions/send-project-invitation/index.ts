import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ProjectAccessError, requireProjectAccess, type ProjectRole } from "../_shared/projectAccess.ts";
import { cleanRecipientEmail } from "../_shared/outboundText.ts";
import { hashInviteSecret, INVITE_PREVIEW_TOKEN_DAYS, newInviteSecret } from "../_shared/inviteSecret.ts";
import {
  PROJECT_INVITES_PER_ACTOR_PER_HOUR,
  PROJECT_INVITES_PER_RECIPIENT_PER_HOUR,
  PROJECT_INVITE_TEMPLATE,
  countActorSends,
  countRecipientSends,
  decideSendBudget,
  recordActorSend,
} from "../_shared/outboundBudget.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://www.kretopia.com";

// Who may invite: the owner and accepted collaborators, creatives and clients.
// Not an accepted guest (a viewer-link visitor): a guest must not be able to
// mint sign-in links or bring new accounts into a project.
const INVITER_ROLES: ProjectRole[] = ["owner", "collaborator", "creative", "client"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Escapes user-controlled text before it's interpolated into the email HTML —
// the two values below (project title, inviter name) are now DB-verified
// rather than client-supplied, but this stays as defense-in-depth in case
// either legitimately contains HTML-special characters (e.g. a project
// titled "Q&A shoot").
const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));

interface InvitationRequest {
  email: string;
  projectId: string;
  inviteeUserId?: string; // Optional, for existing users
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Caller must be authenticated and must actually have access to the
    // project they're inviting people into — previously anyone with any
    // Kretopia account could call this with an arbitrary projectId and
    // fully client-controlled projectTitle/inviterName, minting a real
    // magic sign-in link and sending a real branded email to any address.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email: rawEmail, projectId, inviteeUserId }: InvitationRequest = await req.json();

    // One plain address: it ends up in a mail header, a sign-in link request and
    // a stored label.
    const email = typeof rawEmail === "string" && rawEmail.trim() ? cleanRecipientEmail(rawEmail) : null;
    if (typeof rawEmail === "string" && rawEmail.trim() && !email) {
      return new Response(JSON.stringify({ error: "A valid email address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!projectId || typeof projectId !== "string" || !UUID_RE.test(projectId)) {
      throw new Error("Missing or invalid projectId");
    }
    if (!email && !inviteeUserId) {
      throw new Error("Either email or inviteeUserId must be provided");
    }

    const admin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // Look up the inviting user (creator) so we can attribute the guest token
    // — also the DB-verified source of truth for the project title, and the
    // same access boundary already enforced on project_collaborators INSERT
    // (owner or accepted collaborator), checked here before anything fires.
    const { data: project } = await admin
      .from("projects")
      .select("created_by, title")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Access from the canonical records, accepted members only (not a pending
    // invitee, not a guest): the SQL helper counted any accepted role.
    try {
      await requireProjectAccess(admin, projectId, user.id, { allowRoles: INVITER_ROLES });
    } catch (e) {
      const status = e instanceof ProjectAccessError ? e.status : 503;
      return new Response(
        JSON.stringify({ error: status === 503 ? "Could not verify project access" : "Forbidden" }),
        {
          status: status === 401 ? 401 : status === 503 ? 503 : 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // A budget before anything is created or sent: an invitation mints a
    // sign-in link and, for an unknown address, creates a passwordless account.
    // The count is read first; a count that failed is not zero.
    if (email) {
      const [actorCount, recipientCount] = await Promise.all([
        countActorSends(admin, user.id, PROJECT_INVITE_TEMPLATE),
        countRecipientSends(admin, email, PROJECT_INVITE_TEMPLATE),
      ]);
      const budget = decideSendBudget({
        actorCount,
        recipientCount,
        actorLimit: PROJECT_INVITES_PER_ACTOR_PER_HOUR,
        recipientLimit: PROJECT_INVITES_PER_RECIPIENT_PER_HOUR,
      });
      if (!budget.ok) {
        return new Response(JSON.stringify({ error: budget.error }), {
          status: budget.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await recordActorSend(admin, {
        template: PROJECT_INVITE_TEMPLATE,
        actorId: user.id,
        recipientEmail: email,
        status: "pending",
      });
    }

    const projectTitle = project.title || "a Kretopia workspace";
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const inviterName = callerProfile?.full_name || "A Kretopia user";

    // Magic-link first: try to mint a one-tap sign-in link so the invitee lands
    // INSIDE the real Studio, already authenticated, with no password.
    // - Existing users → type: 'magiclink'
    // - New users     → type: 'invite' (creates a passwordless account)
    // Falls back to the public guest preview if neither can be issued.
    let magicLink: string | null = null;

    // A secret travels in the link and only its hash is stored on the pending invitation, so the
    // signed-out preview fallback cannot be opened with just a project id and an address. If it cannot
    // be stored the link goes out without one and the invitation keeps the older address-only check.
    let secretQuery = "";
    if (email) {
      try {
        const { data: pending, error: pendingErr } = await admin
          .from("project_collaborators")
          .select("id, email")
          .eq("project_id", projectId)
          .eq("status", "pending");
        if (pendingErr) throw pendingErr;
        const ids = (pending ?? [])
          .filter((row: { id: string; email: string | null }) => (row.email ?? "").toLowerCase() === email.toLowerCase())
          .map((row: { id: string }) => row.id);
        if (ids.length) {
          const secret = newInviteSecret();
          const { error: storeErr } = await admin
            .from("project_collaborators")
            .update({ invite_secret_hash: await hashInviteSecret(secret) })
            .in("id", ids);
          if (storeErr) throw storeErr;
          secretQuery = `&t=${encodeURIComponent(secret)}`;
        }
      } catch (e: any) {
        console.warn("invite secret not stored (non-fatal):", e?.message);
      }
    }

    if (email) {
      const redirectTo = `${APP_URL}/accept-invite/${projectId}?email=${encodeURIComponent(email)}${secretQuery}`;
      const tryGenerate = async (type: "magiclink" | "invite") => {
        const { data, error } = await admin.auth.admin.generateLink({
          type,
          email: email.toLowerCase(),
          options: { redirectTo },
        } as any);
        if (error) throw error;
        return data?.properties?.action_link ?? null;
      };
      try {
        magicLink = await tryGenerate("magiclink");
      } catch (e: any) {
        try {
          magicLink = await tryGenerate("invite");
        } catch (e2: any) {
          console.warn("magiclink+invite both failed (non-fatal):", e?.message, e2?.message);
        }
      }
    }

    // Read-only guest preview as a fallback (existing flow)
    let guestToken: string | null = null;
    if (!magicLink && email && project?.created_by) {
      const { data: existingTokens } = await admin
        .from("guest_studio_tokens")
        .select("token, expires_at")
        .eq("project_id", projectId)
        .eq("guest_email", email.toLowerCase())
        .is("revoked_at", null);
      const live = (existingTokens ?? []).find(
        (row: { token: string; expires_at: string | null }) => !row.expires_at || new Date(row.expires_at).getTime() > Date.now(),
      );

      if (live?.token) {
        guestToken = live.token;
      } else {
        const { data: minted } = await admin
          .from("guest_studio_tokens")
          .insert({
            project_id: projectId,
            created_by: project.created_by,
            guest_email: email.toLowerCase(),
            label: `Invite for ${email}`,
            expires_at: new Date(Date.now() + INVITE_PREVIEW_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select("token")
          .single();
        guestToken = minted?.token ?? null;
      }
    }

    // Magic link → real Studio (one-tap, authenticated)
    // Guest token → read-only preview
    // Existing user with no email → /accept-invite (auto-accept on sign-in)
    const projectUrl = magicLink
      ? magicLink
      : guestToken
      ? `${APP_URL}/guest/${encodeURIComponent(guestToken)}`
      : `${APP_URL}/accept-invite/${projectId}?email=${encodeURIComponent(email || "")}${secretQuery}`;

    console.log(`Sending project invitation: magic=${!!magicLink}, token=${!!guestToken}, url=${projectUrl.slice(0, 80)}...`);

    if (inviteeUserId) {
      console.log(`Skipping duplicate in-app notification for user ${inviteeUserId}`);
    }

    const initial = (inviterName || "T").charAt(0).toUpperCase();

    let emailSent = false;
    let emailError: string | null = null;

    try {
      const emailResponse = await resend.emails.send({
        from: "Kretopia <noreply@kretopia.com>",
        to: email ? [email] : [],
        subject: `${inviterName} invited you to "${projectTitle}" on Kretopia`,
        html: `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F8FAFC;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-block;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
          <span style="color:#F8FAFC;">kre</span><span style="color:#17D9D4;">to</span><span style="color:#F8FAFC;">pia</span>
        </div>
      </div>

      <div style="background:#1E293B;border-radius:16px;padding:32px 24px;border:1px solid #334155;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:40px;height:40px;border-radius:50%;background:#5B6BF5;color:white;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-size:16px;">${initial}</div>
          <div>
            <div style="font-size:13px;color:#94A3B8;">${escapeHtml(inviterName)} invited you to a workspace</div>
          </div>
        </div>

        <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#F8FAFC;line-height:1.2;">${escapeHtml(projectTitle)}</h1>
        <p style="margin:0 0 24px 0;color:#94A3B8;font-size:14px;line-height:1.5;">
          Open the workspace to see the brief, drop files, leave notes, and chat with the team. One tap signs you in — no password required.
        </p>

        <div style="text-align:center;margin:24px 0;">
          <a href="${projectUrl}" style="display:inline-block;padding:14px 28px;background:#5B6BF5;color:#FFFFFF;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
            Open the workspace →
          </a>
        </div>

        <p style="margin:16px 0 0 0;color:#64748B;font-size:12px;text-align:center;">
          ${magicLink ? "This link signs you in for 24 hours." : "You can claim a free profile later if you want to keep working together."}
        </p>
      </div>

      <p style="margin:24px 0 0 0;color:#475569;font-size:11px;text-align:center;line-height:1.5;">
        This invitation was sent by ${escapeHtml(inviterName)} via Kretopia. If you weren't expecting this, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>
        `,
      });

      if (emailResponse.error) {
        console.warn("Resend error (non-fatal):", emailResponse.error);
        // Resend answers with an object, and String(object) is "[object Object]": keep the reason readable.
        emailError = emailResponse.error.message || JSON.stringify(emailResponse.error);
      } else {
        emailSent = true;
      }
    } catch (e: any) {
      console.warn("Email send failed (non-fatal):", e.message);
      emailError = e.message;
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        emailError,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("send-project-invitation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send invitation" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
