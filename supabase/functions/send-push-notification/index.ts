import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  tag?: string;
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Step 1: is there a real caller at all? service-role (internal edge
// functions, e.g. notify-swipe's own admin client) is always trusted.
// Anything else must additionally pass the relationship check below.
function parseCallerClaims(req: Request): { role?: string; sub?: string } | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const claims = parseJwtClaims(authHeader.slice("Bearer ".length).trim());
  if (!claims) return null;
  return claims as { role?: string; sub?: string };
}

// Step 2: for a plain authenticated (non-service-role) caller, this used to
// stop at "is this *a* real user" -- any signed-in user could target any
// other user's devices with an arbitrary title/body, a real push-spam/
// phishing vector. Self-notify is always fine; notifying someone else
// requires the two users actually have a real relationship one of the
// app's own legitimate call sites relies on (project collaborator call/
// message notifications, event comment notifications, opportunity
// poster<->applicant status updates, or an accepted connection) -- not
// just "both happen to be signed in."
async function hasRealRelationship(admin: ReturnType<typeof createClient>, callerId: string, targetId: string): Promise<boolean> {
  // 1) Accepted connection, either direction.
  const connectionCheck = admin
    .from("connections")
    .select("id")
    .or(`and(user_id.eq.${callerId},connected_user_id.eq.${targetId}),and(user_id.eq.${targetId},connected_user_id.eq.${callerId})`)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();

  // 2) Same project: caller is an accepted collaborator (or owner) on a
  // project the target owns (or is an accepted collaborator on).
  const projectCheck = (async () => {
    const { data: callerProjects } = await admin
      .from("project_collaborators")
      .select("project_id")
      .eq("user_id", callerId)
      .eq("status", "accepted");
    const { data: ownedByCaller } = await admin
      .from("projects")
      .select("id")
      .eq("created_by", callerId);
    const projectIds = [
      ...(callerProjects ?? []).map((r) => r.project_id),
      ...(ownedByCaller ?? []).map((r) => r.id),
    ];
    if (projectIds.length === 0) return false;
    const { data: targetOwns } = await admin
      .from("projects")
      .select("id")
      .eq("created_by", targetId)
      .in("id", projectIds)
      .limit(1)
      .maybeSingle();
    if (targetOwns) return true;
    const { data: targetCollaborates } = await admin
      .from("project_collaborators")
      .select("id")
      .eq("user_id", targetId)
      .eq("status", "accepted")
      .in("project_id", projectIds)
      .limit(1)
      .maybeSingle();
    return !!targetCollaborates;
  })();

  // 3) Same event: caller is a non-cancelled participant (or host) of an
  // event the target hosts (or also participates in).
  const eventCheck = (async () => {
    const { data: callerJams } = await admin
      .from("jam_participants")
      .select("jam_id")
      .eq("user_id", callerId)
      .neq("status", "cancelled");
    const { data: hostedByCaller } = await admin
      .from("creative_jams")
      .select("id")
      .eq("created_by", callerId);
    const jamIds = [
      ...(callerJams ?? []).map((r) => r.jam_id),
      ...(hostedByCaller ?? []).map((r) => r.id),
    ];
    if (jamIds.length === 0) return false;
    const { data: targetHosts } = await admin
      .from("creative_jams")
      .select("id")
      .eq("created_by", targetId)
      .in("id", jamIds)
      .limit(1)
      .maybeSingle();
    if (targetHosts) return true;
    const { data: targetParticipates } = await admin
      .from("jam_participants")
      .select("id")
      .eq("user_id", targetId)
      .neq("status", "cancelled")
      .in("jam_id", jamIds)
      .limit(1)
      .maybeSingle();
    return !!targetParticipates;
  })();

  // 4) Opportunity poster <-> applicant, either direction.
  const applicationCheck = (async () => {
    const { data: posterApps } = await admin
      .from("opportunities")
      .select("id, applications!inner(applicant_id)")
      .eq("created_by", callerId)
      .eq("applications.applicant_id", targetId)
      .limit(1)
      .maybeSingle();
    if (posterApps) return true;
    const { data: applicantApps } = await admin
      .from("opportunities")
      .select("id, applications!inner(applicant_id)")
      .eq("created_by", targetId)
      .eq("applications.applicant_id", callerId)
      .limit(1)
      .maybeSingle();
    return !!applicantApps;
  })();

  const [conn, proj, evt, app] = await Promise.all([connectionCheck, projectCheck, eventCheck, applicationCheck]);
  return !!conn.data || proj || evt || app;
}

// VAPID helper functions
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const audience = new URL(endpoint).origin;
  
  // Create JWT header
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };
  
  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject
  };

  // Encode header and payload
  const encodedHeader = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import private key for signing
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
  
  // Create JWK for private key
  const privateKeyJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: vapidPublicKey.slice(0, 43), // First 32 bytes of public key after 0x04
    y: vapidPublicKey.slice(43), // Last 32 bytes
    d: vapidPrivateKey
  };

  // For proper VAPID, we need to extract x and y from the full public key
  const publicKeyBytes = base64UrlToUint8Array(vapidPublicKey);
  if (publicKeyBytes.length === 65 && publicKeyBytes[0] === 0x04) {
    privateKeyJwk.x = uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33));
    privateKeyJwk.y = uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65));
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert signature from DER to raw format if needed
  const signatureBytes = new Uint8Array(signature);
  const encodedSignature = uint8ArrayToBase64Url(signatureBytes);
  
  const jwt = `${unsignedToken}.${encodedSignature}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    cryptoKey: vapidPublicKey
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const claims = parseCallerClaims(req);
    if (!claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: PushNotificationPayload = await req.json();
    if (!payload.userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // service-role (internal edge functions) and self-notify are always
    // trusted; anyone else must have a real relationship with the target.
    if (claims.role !== "service_role" && claims.sub !== payload.userId) {
      if (!claims.sub) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const related = await hasRealRelationship(supabaseClient, claims.sub, payload.userId);
      if (!related) {
        return new Response(
          JSON.stringify({ success: false, error: "Not authorized to notify this user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:info@kretopia.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[PUSH] VAPID keys not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "VAPID keys not configured. Please run generate-vapid-keys and add the keys to secrets."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log("[PUSH] Sending push notification to user:", payload.userId);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", payload.userId);

    if (subError) {
      console.error("[PUSH] Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[PUSH] No push subscriptions found for user");
      return new Response(
        JSON.stringify({ success: false, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PUSH] Found ${subscriptions.length} subscription(s)`);

    // Send to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || "/favicon.png",
            badge: payload.badge || "/favicon.png",
            data: payload.data || {},
            tag: payload.tag,
          });

          // Create VAPID authorization header
          const vapidHeaders = await createVapidAuthHeader(
            sub.endpoint,
            vapidPublicKey,
            vapidPrivateKey,
            vapidSubject
          );

          console.log(`[PUSH] Sending to endpoint: ${sub.endpoint.substring(0, 50)}...`);

          const response = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Encoding": "aes128gcm",
              "TTL": "86400",
              "Authorization": vapidHeaders.authorization,
              "Crypto-Key": `p256ecdsa=${vapidHeaders.cryptoKey}`,
            },
            body: pushPayload,
          });

          console.log(`[PUSH] Response status: ${response.status}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[PUSH] Failed to send: ${response.status} - ${errorText}`);
            
            // If subscription is invalid (410 Gone), remove it
            if (response.status === 410 || response.status === 404) {
              console.log("[PUSH] Removing invalid subscription");
              await supabaseClient
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
            }
            return { success: false, endpoint: sub.endpoint, status: response.status };
          }

          return { success: true, endpoint: sub.endpoint };
        } catch (error) {
          console.error("[PUSH] Error sending push:", error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    console.log(`[PUSH] Successfully sent: ${successCount}/${subscriptions.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[PUSH] Error in send-push-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
