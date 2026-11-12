// Stage-ticket and paid-circle fulfillment: called ONLY from the signature-verified
// stripe-marketplace-webhook (checkout.session.completed). Return pages are read-only.
import { canEnterStage, entryWasChecked, isStageTicketSession } from "./stageTicket.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;
const log = (s: string, d?: unknown) =>
  console.log(`[stage-circle-activation] ${s}${d ? " " + JSON.stringify(d) : ""}`);

// deno-lint-ignore no-explicit-any
export async function finalizeStageTicket(admin: Admin, session: any): Promise<"paid" | "skipped" | "invite_required"> {
  const md = (session?.metadata ?? null) as Record<string, string> | null;
  if (session?.payment_status !== "paid" || !isStageTicketSession(md)) return "skipped";
  const stageId = md!.stage_id;
  const buyerId = md!.user_id;
  if (!stageId || !buyerId) return "skipped";

  const { data: stage } = await admin.from("curated_stages")
    .select("id, visibility, invite_token, host_user_id").eq("id", stageId).maybeSingle();
  if (!stage) return "skipped";
  if (!entryWasChecked(md)) {
    const { data: u } = await admin.auth.admin.getUserById(buyerId);
    if (!u?.user || !(await canEnterStage(admin, stage, u.user))) {
      log("paid session without entry check for a private stage", { stageId });
      return "invite_required";
    }
  }

  const paidAt = new Date().toISOString();
  let { data: order, error } = await admin.from("curated_stage_orders")
    .update({ status: "paid", paid_at: paidAt })
    .eq("stripe_session_id", session.id).eq("user_id", buyerId)
    .select("id").maybeSingle();
  if (error) throw new Error("Could not record stage payment");
  if (!order) {
    const ins = await admin.from("curated_stage_orders").insert({
      stage_id: stageId, user_id: buyerId, stripe_session_id: session.id,
      amount_cents: session.amount_total ?? 0,
      currency: (session.currency || "usd").toLowerCase(),
      status: "paid", paid_at: paidAt,
    }).select("id").maybeSingle();
    if (ins.error) throw new Error("Could not record stage payment");
    order = ins.data;
  }
  const { error: rsvpErr } = await admin.from("curated_stage_rsvps").upsert({
    stage_id: stageId, user_id: buyerId, status: "rsvp", ticket_order_id: order?.id ?? null,
  }, { onConflict: "stage_id,user_id" });
  if (rsvpErr) throw new Error("Could not record stage seat");
  return "paid";
}

// deno-lint-ignore no-explicit-any
export async function activateCircleSubscription(admin: Admin, session: any): Promise<"active" | "skipped"> {
  const md = session?.metadata ?? {};
  if (session?.payment_status !== "paid" || md.type !== "circle_subscription") return "skipped";
  const circleId = md.circle_id;
  const buyerId = md.buyer_id;
  if (!circleId || !buyerId) return "skipped";
  await admin.from("circle_subscriptions").update({
    status: "active",
    started_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    stripe_subscription_id: session.id,
  }).eq("circle_id", circleId).eq("user_id", buyerId).eq("status", "pending");
  const { error } = await admin.from("spark_room_members").upsert(
    { room_id: circleId, user_id: buyerId, role: "member" },
    { onConflict: "room_id,user_id" },
  );
  if (error) throw new Error("Could not add circle member");
  return "active";
}
