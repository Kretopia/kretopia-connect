import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";


import { isAllowedPushEndpoint } from "../_shared/pushEndpoint.ts";
// constantTimeEqual was called below but never imported, so every request failed with a ReferenceError (a 500) before it was
// authenticated: no caller, internal or member, could ever send a push.
import { constantTimeEqual, corsFor } from '../_shared/guard.ts';
import {
  buildPushMessage,
  classifyPushStatus,
  createVapidAuthHeader,
  encryptWebPushPayload,
  pushTopic,
} from "../_shared/webPush.ts";

// What a caller may ask for. A device only ever receives what buildPushMessage keeps of it (a title, a short body, a deep
// link into the app, a tag and a type): `data` is read for its link and type, never forwarded, and icon/badge are ignored
// because the service worker owns how a notification looks.
interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  tag?: string;
}

// Step 1: who is calling? Internal callers authenticate with the
// service-role key itself (constant-time compare); everyone else gets their
// token verified against the auth server. A decoded-but-unverified JWT
// claims nothing — anyone can mint one with role=service_role.
type VerifiedCaller = { id: string | null; isServiceRole: boolean };

async function resolveCaller(req: Request): Promise<VerifiedCaller | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && (await constantTimeEqual(token, serviceKey))) {
    return { id: null, isServiceRole: true };
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { id: data.user.id, isServiceRole: false };
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

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload: PushNotificationPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!payload || typeof payload.userId !== "string" || !payload.userId) {
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
    if (!caller.isServiceRole && caller.id !== payload.userId) {
      if (!caller.id) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const related = await hasRealRelationship(supabaseClient, caller.id, payload.userId);
      if (!related) {
        return new Response(
          JSON.stringify({ success: false, error: "Not authorized to notify this user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@kretopia.com";

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

    // Get the user's push subscriptions: only the columns a send needs.
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", payload.userId);

    if (subError) {
      console.error("[PUSH] Error fetching subscriptions:", subError);
      throw subError;
    }

    // One device can be registered twice (an older subscription, a retried sign-up): each endpoint is sent to once.
    const seenEndpoints = new Set<string>();
    const targets = (subscriptions ?? []).filter((sub) => !seenEndpoints.has(sub.endpoint) && !!seenEndpoints.add(sub.endpoint));

    if (targets.length === 0) {
      console.log("[PUSH] No push subscriptions found for user");
      return new Response(
        JSON.stringify({ success: false, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PUSH] Found ${targets.length} subscription(s)`);

    // The same message for every device of the member, encrypted separately for each one below.
    const message = buildPushMessage({ title: payload.title, body: payload.body, tag: payload.tag, url: payload.url, data: payload.data });
    const plaintext = new TextEncoder().encode(JSON.stringify(message));
    // The push service keeps one undelivered message per topic, so the same request sent twice reaches a phone once.
    const topic = await pushTopic(message.tag);
    // Messages and co-sign requests are worth waking a phone for; everything else can wait for its next wake-up.
    const urgency = message.type === "message" || message.type === "cosign_request" ? "high" : "normal";

    // Send to all user's devices
    const results = await Promise.allSettled(
      targets.map(async (sub) => {
        try {
          // The endpoint was reported by the member's own browser and stored as typed: only a browser vendor's push service
          // is ever called (_shared/pushEndpoint.ts). Anything else is skipped, not fetched.
          if (!isAllowedPushEndpoint(sub.endpoint)) {
            console.warn("[PUSH] Skipping a subscription whose endpoint is not a push service", sub.id);
            return { success: false, reason: "endpoint_not_allowed" };
          }

          // Create VAPID authorization header
          const vapidHeaders = await createVapidAuthHeader(
            sub.endpoint,
            vapidPublicKey,
            vapidPrivateKey,
            vapidSubject
          );

          // The body is encrypted to this subscription's own keys (RFC 8291): the push service only relays it, and only this
          // browser can read it. Sent as plain JSON it can never be displayed.
          const body = await encryptWebPushPayload(plaintext, { p256dh: sub.p256dh, auth: sub.auth });

          const response = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Encoding": "aes128gcm",
              "TTL": "86400",
              "Urgency": urgency,
              ...(topic ? { "Topic": topic } : {}),
              "Authorization": vapidHeaders.authorization,
            },
            body,
            // A push service answers directly; a redirect would be the way to reach somewhere else.
            redirect: "manual",
            signal: AbortSignal.timeout(10_000),
          });

          const outcome = classifyPushStatus(response.status);
          if (outcome !== "delivered") {
            const errorText = (await response.text()).slice(0, 200);
            console.error(`[PUSH] Not delivered (${outcome}): ${response.status} - ${errorText}`, sub.id);

            // 404/410: the browser no longer has this subscription, so it is dropped. A 401/403 is the sender being refused
            // (a VAPID key that does not match what the browser subscribed with): that must never delete subscriptions.
            if (outcome === "gone") {
              console.log("[PUSH] Removing invalid subscription", sub.id);
              await supabaseClient
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
              return { success: false, status: response.status, removed: true };
            }
            return { success: false, status: response.status };
          }

          return { success: true };
        } catch (error) {
          console.error("[PUSH] Error sending push:", error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const removedCount = results.filter(
      (r) => r.status === "fulfilled" && (r.value as { removed?: boolean }).removed
    ).length;

    console.log(`[PUSH] Successfully sent: ${successCount}/${targets.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: targets.length,
        removed: removedCount,
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
