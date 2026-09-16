// Public endpoint — a guest "knocks" on a creator's personal room.
// Inserts a room_knocks row. Owner sees it via Realtime + notification.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  handle?: string;
  owner_id?: string;
  guest_name: string;
  guest_email?: string;
  message?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Body;
    const name = (body.guest_name || "").trim().slice(0, 80);
    if (!name) return json({ error: "Name required" }, 400);

    // Resolve owner
    let ownerId = body.owner_id ?? null;
    if (!ownerId && body.handle) {
      const clean = body.handle.replace(/^@/, "").toLowerCase();
      const { data } = await admin
        .from("public_profiles_safe")
        .select("user_id")
        .ilike("username", clean)
        .maybeSingle();
      ownerId = data?.user_id ?? null;
    }
    if (!ownerId) return json({ error: "Creator not found" }, 404);

    // Optional auth — if signed in, attach guest_user_id
    let guestUserId: string | null = null;
    const auth = req.headers.get("Authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: auth } } },
        );
        const { data } = await userClient.auth.getUser();
        guestUserId = data.user?.id ?? null;
      } catch { /* ignore */ }
    }

    const { data: knock, error } = await admin
      .from("room_knocks")
      .insert({
        owner_id: ownerId,
        guest_user_id: guestUserId,
        guest_name: name,
        guest_email: (body.guest_email || "").trim().slice(0, 200) || null,
        message: (body.message || "").trim().slice(0, 400) || null,
        status: "pending",
      })
      .select("id, guest_token, expires_at")
      .single();
    if (error) throw error;

    // Notification for owner (best-effort)
    try {
      await admin.from("notifications").insert({
        user_id: ownerId,
        type: "room_knock",
        title: `${name} is at your door`,
        body: (body.message || "Wants to hop on a quick call.").slice(0, 200),
        action_url: `/inbox?knock=${knock.id}`,
      });
    } catch { /* ignore */ }

    return json({
      knock_id: knock.id,
      guest_token: knock.guest_token,
      expires_at: knock.expires_at,
    });
  } catch (e) {
    console.error("[knock-personal-room]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
