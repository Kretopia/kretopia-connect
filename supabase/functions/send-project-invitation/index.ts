import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://www.thrivein.io";
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

    const { email, projectId, inviteeUserId }: InvitationRequest = await req.json();

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
    const { data: hasAccess } = await admin.rpc("user_has_project_access", {
      project_id_param: projectId,
      user_id_param: user.id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    if (email) {
      const redirectTo = `${APP_URL}/accept-invite/${projectId}?email=${encodeURIComponent(email)}`;
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
      const { data: existing } = await admin
        .from("guest_studio_tokens")
        .select("token")
        .eq("project_id", projectId)
        .eq("guest_email", email.toLowerCase())
        .is("revoked_at", null)
        .maybeSingle();

      if (existing?.token) {
        guestToken = existing.token;
      } else {
        const { data: minted } = await admin
          .from("guest_studio_tokens")
          .insert({
            project_id: projectId,
            created_by: project.created_by,
            guest_email: email.toLowerCase(),
            label: `Invite for ${email}`,
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
      : `${APP_URL}/accept-invite/${projectId}?email=${encodeURIComponent(email || "")}`;

    console.log(`Sending project invitation: magic=${!!magicLink}, token=${!!guestToken}, url=${projectUrl.slice(0, 80)}...`);

    if (inviteeUserId) {
      console.log(`Skipping duplicate in-app notification for user ${inviteeUserId}`);
    }

    const initial = (inviterName || "T").charAt(0).toUpperCase();

    let emailSent = false;
    let emailError: string | null = null;

    try {
      const emailResponse = await resend.emails.send({
        from: "Kretopia <info@kretopia.com>",
        to: [email],
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
        emailError = String(emailResponse.error);
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
        guestUrl: projectUrl,
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
