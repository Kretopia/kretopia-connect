import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { action, ...params } = await req.json();

    if (action === "send-verification") {
      // Create guest opportunity and send verification email
      const { email, company_name, logo_url, title, description, type, compensation, skills, requirements, deliverables, location, location_city, location_country, image_url,
        image_data, logo_data,
        casting_gender, casting_min_height_cm, casting_max_height_cm, casting_age_min, casting_age_max, casting_categories, casting_fitting_date, casting_shoot_date, casting_usage_summary } = params;

      if (!email || !title || !description || !company_name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate verification token
      const token = crypto.randomUUID().replace(/-/g, "");

      // If the guest uploaded a cover image and/or logo (cropped client-side,
      // sent as a base64 data URL), upload it to storage now and use the
      // resulting public URL instead of the empty/typed-in one. Previously
      // image_data/logo_data were sent by the client but never destructured
      // here, so an uploaded file was silently dropped and the opportunity
      // was saved with no image at all.
      const uploadDataUrl = async (dataUrl: string, pathPrefix: string): Promise<string | null> => {
        const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
        if (!match) return null;
        const [, contentType, base64Data] = match;
        const ext = contentType.split("/")[1] || "jpg";
        const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const filePath = `${pathPrefix}/${token}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await adminClient.storage
          .from("media")
          .upload(filePath, bytes, { contentType, upsert: true });
        if (uploadErr) {
          console.error(`Failed to upload ${pathPrefix}:`, uploadErr);
          return null;
        }
        const { data: urlData } = adminClient.storage.from("media").getPublicUrl(filePath);
        return urlData.publicUrl;
      };

      const uploadedImageUrl = typeof image_data === "string" ? await uploadDataUrl(image_data, "guest-opportunities/covers") : null;
      const uploadedLogoUrl = typeof logo_data === "string" ? await uploadDataUrl(logo_data, "guest-opportunities/logos") : null;
      const finalImageUrl = uploadedImageUrl || image_url || null;
      const finalLogoUrl = uploadedLogoUrl || logo_url || null;

      // Insert opportunity as pending (not active until verified)
      const { data: opp, error: oppError } = await adminClient
        .from("opportunities")
        .insert({
          title,
          description,
          type: type || "collaboration",
          compensation: compensation || null,
          skills: skills || [],
          requirements: requirements || null,
          deliverables: deliverables || null,
          location: location || "remote",
          location_city: location_city || null,
          location_country: location_country || null,
          image_url: finalImageUrl,
          status: "pending_verification",
          is_guest_post: true,
          guest_email: email,
          guest_company_name: company_name,
          guest_logo_url: finalLogoUrl,
          verification_token: token,
          created_by: null, // guest post - no auth user
          casting_gender: casting_gender || null,
          casting_min_height_cm: casting_min_height_cm ?? null,
          casting_max_height_cm: casting_max_height_cm ?? null,
          casting_age_min: casting_age_min ?? null,
          casting_age_max: casting_age_max ?? null,
          casting_categories: casting_categories || [],
          casting_fitting_date: casting_fitting_date || null,
          casting_shoot_date: casting_shoot_date || null,
          casting_usage_summary: casting_usage_summary || null,
        })
        .select()
        .single();

      if (oppError) {
        console.error("Error creating opportunity:", oppError);
        return new Response(
          JSON.stringify({ error: "Failed to create opportunity" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send verification email
      const siteUrl = Deno.env.get("SITE_URL") || "https://www.kretopia.com";
      const verifyUrl = `${siteUrl}/verify-opportunity?token=${token}`;

      // Send verification email via Resend
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Kretopia <info@kretopia.com>",
            to: [email],
            subject: `Verify your opportunity: ${title}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #1a1a1a; font-size: 24px;">Almost there, ${company_name}! 🎉</h1>
                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                  Click below to verify your email and publish <strong>"${title}"</strong> on Kretopia's Discover page where thousands of creatives will see it.
                </p>
                <a href="${verifyUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 20px 0;">
                  Verify & Publish
                </a>
                <p style="color: #888; font-size: 14px;">
                  This link expires in 48 hours. If you didn't post this, you can safely ignore this email.
                </p>
              </div>
            `,
          }),
        });

        const emailBody = await emailRes.text();
        if (!emailRes.ok) {
          console.error("Resend API error:", emailRes.status, emailBody);
        } else {
          console.log("Verification email sent successfully:", emailBody);
        }
      } else {
        console.error("RESEND_API_KEY not configured");
      }

      return new Response(
        JSON.stringify({ success: true, opportunityId: opp.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      const { token } = params;

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Missing token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the opportunity
      const { data: opp, error: findError } = await adminClient
        .from("opportunities")
        .select("*")
        .eq("verification_token", token)
        .eq("is_guest_post", true)
        .is("verified_at", null)
        .single();

      if (findError || !opp) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired verification link" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Activate the opportunity
      const { error: updateError } = await adminClient
        .from("opportunities")
        .update({
          status: "active",
          verified_at: new Date().toISOString(),
        })
        .eq("id", opp.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to verify" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create an unclaimed brand profile using existing function
      const { data: profileId } = await adminClient.rpc("create_unclaimed_profile", {
        p_full_name: opp.guest_company_name,
        p_role: "Company",
        p_bio: `${opp.guest_company_name} is hiring on Kretopia`,
        p_avatar_url: opp.guest_logo_url,
        p_source: "guest_opportunity",
        p_imported_data: JSON.stringify({ guest_email: opp.guest_email }),
      });

      // Link the profile to the opportunity
      if (profileId) {
        await adminClient
          .from("opportunities")
          .update({ guest_profile_id: profileId })
          .eq("id", opp.id);
        
        // Update the profile account_type to company
        await adminClient
          .from("profiles")
          .update({ account_type: "company" })
          .eq("user_id", profileId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          opportunityId: opp.id,
          companyName: opp.guest_company_name,
          claimToken: profileId ? (await adminClient.from("profiles").select("claim_token").eq("user_id", profileId).single()).data?.claim_token : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
