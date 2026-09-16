import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DraftProfile {
  full_name?: string;
  role?: string;
  bio?: string;
  location?: string;
  skills?: string[];
  avatar_url?: string;
  website?: string;
}

interface ClaimedCredit {
  title: string;
  url?: string;
  type?: string;
  year?: number;
  role_suggestion?: string;
  description?: string;
  thumbnail?: string;
  platform?: string;
  client_brand?: string;
  location?: string;
}

/**
 * Consumes a single-use face_verification_attempts token written by
 * verify-profile-claim under service_role. Returns false for any missing,
 * unrecognized, already-consumed, expired (>15 min), or unverified token —
 * never trusts anything the client asserts about the result.
 */
async function resolveFaceVerification(
  admin: ReturnType<typeof createClient>,
  token: string | null,
): Promise<boolean> {
  if (!token) return false;

  const { data, error } = await admin
    .from("face_verification_attempts")
    .select("verified, consumed_at, created_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return false;
  if (data.consumed_at) return false;

  const ageMs = Date.now() - new Date(data.created_at as string).getTime();
  if (ageMs > 15 * 60 * 1000) return false;

  await admin
    .from("face_verification_attempts")
    .update({ consumed_at: new Date().toISOString() })
    .eq("token", token);

  return data.verified === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { email: rawEmail, profile, credits, redirect_to, skip_magic_link, face_verification_token } = (await req.json()) as {
      email: string;
      profile: DraftProfile;
      credits: ClaimedCredit[];
      redirect_to: string;
      skip_magic_link?: boolean;
      face_verification_token?: string | null;
    };

    const email = (rawEmail || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Valid email required" }, 400);
    }
    if (!profile?.full_name?.trim()) {
      return json({ error: "Profile name required" }, 400);
    }

    // skip_magic_link is meant only for the post-Google-OAuth flow, where the
    // caller is already authenticated as this exact email — previously it was
    // trusted blindly from the request body, letting any unauthenticated
    // caller upsert bio/skills/credits onto any not-yet-onboarded account (or
    // pre-create one) without ever proving ownership of that email. Require a
    // real session whose own email matches before honoring it.
    if (skip_magic_link) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "Unauthorized" }, 401);
      }
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!caller || caller.email?.toLowerCase() !== email) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    // identity_face_verified must reflect a real, server-computed
    // verify-profile-claim result, never a client-supplied number — a bare
    // face_match_score here used to be directly replayable by any caller.
    // See docs/SECURITY_RELEASE_GATE.md C11.
    const faceVerified = await resolveFaceVerification(admin, face_verification_token ?? null);

    const cleanRedirect = redirect_to || `${SUPABASE_URL}/profile?claimed=true`;
    const result = await checkAndProvisionUser(admin, email, profile, credits, cleanRedirect, !!skip_magic_link, faceVerified);

    console.log(
      `[claim] done for ${email}: user=${result.user_id} new_user=${result.is_new_user} ` +
      `profile_saved=${result.profile_saved} credits_saved=${result.credits_saved}/${credits?.length ?? 0} ` +
      `magic_link_sent=${!skip_magic_link}`,
    );

    return json({ success: true, ...result });
  } catch (err) {
    console.error("[claim-and-create-profile] error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

async function checkAndProvisionUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  profile: DraftProfile,
  credits: ClaimedCredit[],
  redirectTo: string,
  skipMagicLink: boolean,
  faceVerified: boolean,
): Promise<{
  user_id: string;
  is_new_user: boolean;
  profile_saved: boolean;
  credits_saved: number;
  conflicts?: Array<{ url: string; role: string; title: string; existing_owner_id?: string }>;
}> {
  // 1. Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId: string;
  let isNewUser = false;
  const conflicts: Array<{ url: string; role: string; title: string; existing_owner_id?: string }> = [];
  let profileSaved = true; // stays true when the write was legitimately skipped (already-onboarded user)
  let creditsSaved = 0;

  if (found) {
    // Existing user — attach claim to their profile if they don't have one yet, then maybe send magic link.
    userId = found.id;
    console.log(`[claim] matched existing auth user ${userId} for ${email}`);

    // If skipMagicLink (Google flow), upsert profile + credits so the claim isn't lost
    if (skipMagicLink) {
      const outcome = await upsertProfileAndCredits(admin, userId, profile, credits, conflicts, faceVerified);
      profileSaved = outcome.profileSaved;
      creditsSaved = outcome.creditsSaved;
    }
  } else {
    // 2. Create new auth user (unconfirmed, magic link will confirm)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: profile.full_name, claimed_via: "universal_flow" },
    });
    if (createErr || !created.user) throw new Error(createErr?.message || "Failed to create user");
    userId = created.user.id;
    isNewUser = true;
    console.log(`[claim] created new auth user ${userId} for ${email}`);

    const outcome = await upsertProfileAndCredits(admin, userId, profile, credits, conflicts, faceVerified);
    profileSaved = outcome.profileSaved;
    creditsSaved = outcome.creditsSaved;

    // The whole point of this flow is "search yourself, confirm, land on a real
    // Passport". If the profile row failed to write, the user would still get
    // a "check your email" success toast and a magic link to an essentially
    // empty account -- exactly the silent drop-off the CEO flagged. Fail loud
    // instead of sending the link for a profile that doesn't actually exist.
    if (!profileSaved) {
      throw new Error("Couldn't save your profile details. Please try again.");
    }
  }

  // 5. Send magic link unless explicitly skipped (Google flow already authenticated)
  if (!skipMagicLink) {
    const { error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkErr) {
      console.error(`[claim] magic link error for ${email}:`, linkErr);
      throw new Error("Couldn't send magic link");
    }
    console.log(`[claim] magic link generated for ${email} -> ${redirectTo}`);
  }

  return {
    user_id: userId,
    is_new_user: isNewUser,
    profile_saved: profileSaved,
    credits_saved: creditsSaved,
    conflicts: conflicts.length ? conflicts : undefined,
  };
}

async function upsertProfileAndCredits(
  admin: ReturnType<typeof createClient>,
  userId: string,
  profile: DraftProfile,
  credits: ClaimedCredit[],
  conflicts: Array<{ url: string; role: string; title: string; existing_owner_id?: string }>,
  faceVerified: boolean,
): Promise<{ profileSaved: boolean; creditsSaved: number }> {
  // Only upsert profile fields for brand-new profiles. Never overwrite a real, onboarded profile
  // with caller-supplied data — that would let any unauth caller silently rewrite a stranger's bio.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id, onboarding_completed")
    .eq("user_id", userId)
    .maybeSingle();

  const safeToWriteProfile = !existingProfile || existingProfile.onboarding_completed === false;
  const verified = faceVerified;
  let profileSaved = true;

  if (safeToWriteProfile) {
    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        full_name: profile.full_name,
        role: profile.role || null,
        bio: profile.bio?.slice(0, 500) || null,
        location: profile.location || null,
        professional_skills: profile.skills?.slice(0, 12) || [],
        avatar_url: profile.avatar_url || null,
        website: profile.website || null,
        onboarding_completed: false,
        identity_face_verified: verified,
        identity_face_verified_at: verified ? new Date().toISOString() : null,
      },
      { onConflict: "user_id" },
    );
    if (profileErr) {
      // This used to be a console.error-and-continue -- the caller would
      // still get success:true and a magic link for a profile that was
      // never actually written. Surface the failure to the caller instead.
      console.error(`[claim] profile upsert FAILED for ${userId}:`, profileErr);
      profileSaved = false;
    } else {
      console.log(`[claim] profile saved for ${userId} (${profile.full_name})`);
    }
  } else {
    console.log(`[claim] skipping profile overwrite for already-onboarded user ${userId}`);
  }

  let creditsSaved = 0;
  if (credits?.length) {
    for (const c of credits.slice(0, 50)) {
      const role = c.role_suggestion?.slice(0, 100) || profile.role || "Creator";
      const row = {
        user_id: userId,
        project_name: c.title.slice(0, 200),
        role,
        project_type: c.type || null,
        year: c.year || null,
        url: c.url || null,
        thumbnail_url: c.thumbnail || null,
        primary_media_url: c.thumbnail || null,
        description: c.description?.slice(0, 500) || null,
        location: c.location || null,
        platform: c.platform || null,
        client_brand: c.client_brand || null,
        source: "web_verified",
        // Caller-supplied credits cannot self-attest as verified. They start as pending
        // and must be confirmed by the real owner after they sign in.
        verification_status: "pending",
      };
      const { error: insErr } = await admin.from("credits").insert(row);
      if (insErr) {
        if ((insErr as { code?: string }).code === "23505" && c.url) {
          const { data: existing } = await admin
            .from("credits")
            .select("user_id")
            .ilike("url", c.url)
            .ilike("role", role)
            .maybeSingle();
          conflicts.push({
            url: c.url,
            role,
            title: c.title,
            existing_owner_id: existing?.user_id as string | undefined,
          });
        } else {
          console.error(`[claim] credit insert error for ${userId} (${c.title}):`, insErr);
        }
      } else {
        creditsSaved++;
      }
    }
    console.log(`[claim] credits saved for ${userId}: ${creditsSaved}/${credits.length}`);
  }

  return { profileSaved, creditsSaved };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
