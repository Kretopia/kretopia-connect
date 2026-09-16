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

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const { action, phone, code, channel } = await req.json();

    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const TWILIO_PHONE_RAW = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const TWILIO_PHONE = TWILIO_PHONE_RAW.replace(/[^\d+]/g, '');

    if (action === "send") {
      // Strip all non-digit chars except leading +
      const cleanedPhone = phone ? phone.trim().replace(/(?!^\+)\D/g, '') : '';
      
      if (!cleanedPhone || cleanedPhone.length < 8) {
        return new Response(
          JSON.stringify({ error: "Invalid phone number. Use international format e.g. +1234567890" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const deliveryChannel = channel === "whatsapp" ? "whatsapp" : "sms";

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP server-side
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await adminClient
        .from("profiles")
        .update({
          phone_otp: otp,
          phone_otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          phone_number: cleanedPhone,
        })
        .eq("user_id", userId);

      // Send via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;

      // For WhatsApp, prefix both From and To with "whatsapp:"
      const toNumber = deliveryChannel === "whatsapp" 
        ? `whatsapp:${cleanedPhone}` 
        : cleanedPhone;
      const fromNumber = deliveryChannel === "whatsapp" 
        ? `whatsapp:${TWILIO_PHONE}` 
        : TWILIO_PHONE;

      const body = new URLSearchParams({
        To: toNumber,
        From: fromNumber,
        Body: `Your Kretopia verification code is: ${otp}. It expires in 10 minutes.`,
      });

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!twilioRes.ok) {
        const errBody = await twilioRes.text();
        console.error("Twilio error:", errBody);
        const channelLabel = deliveryChannel === "whatsapp" ? "WhatsApp message" : "SMS";
        
        // Parse Twilio error for better user messaging
        let userMessage = `Failed to send ${channelLabel}. Please check the phone number format (e.g. +1234567890).`;
        try {
          const twilioError = JSON.parse(errBody);
          if (twilioError.code === 21408) {
            userMessage = `SMS is not yet available for your region. Please try WhatsApp instead, or contact support.`;
          } else if (twilioError.code === 63007) {
            userMessage = `WhatsApp is not yet configured for this number. Please try SMS instead, or contact support.`;
          } else if (twilioError.code === 21211) {
            userMessage = `Invalid phone number. Please use international format (e.g. +1234567890).`;
          }
        } catch {}
        
        return new Response(
          JSON.stringify({ error: userMessage }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await twilioRes.text();

      return new Response(
        JSON.stringify({ success: true, message: "OTP sent", channel: deliveryChannel }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      if (!code || typeof code !== "string" || code.length !== 6) {
        return new Response(
          JSON.stringify({ error: "Invalid code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: profile, error: fetchErr } = await adminClient
        .from("profiles")
        .select("phone_otp, phone_otp_expires_at, phone_number")
        .eq("user_id", userId)
        .single();

      if (fetchErr || !profile) {
        return new Response(
          JSON.stringify({ error: "Profile not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!profile.phone_otp_expires_at || new Date(profile.phone_otp_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Code expired. Please request a new one." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (profile.phone_otp !== code.trim()) {
        return new Response(
          JSON.stringify({ error: "Invalid code. Please try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient
        .from("profiles")
        .update({
          phone_verified: true,
          phone_otp: null,
          phone_otp_expires_at: null,
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, message: "Phone verified" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'send' or 'verify'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
