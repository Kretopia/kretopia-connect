import { supabase } from "@/integrations/supabase/client";
import type { PrimaryIntent } from "./intents";
import { escapePostgrestValue } from "./postgrestFilter";

/**
 * After-Claim Engagement Loop — Day 0 in-app nudges.
 * Fires immediately after onboarding completes. Inserts personalized
 * notifications so the user opens the app to actual signal, not silence.
 *
 * Intent-aware: seeds 1-2 extra nudges per selected intent.
 * Idempotent: skips if user already has any of these category notifications.
 */
export async function seedAfterClaimNudges(userId: string, opts: {
  role?: string | null;
  location?: string | null;
  /** Multi-select intents (max 2). Legacy single `intent` still accepted. */
  intents?: PrimaryIntent[] | null;
  intent?: PrimaryIntent | null;
}): Promise<void> {
  try {
    // Idempotency — skip if we've already seeded
    const { count: existing } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("category", "after_claim");

    if ((existing ?? 0) > 0) {
      return;
    }

    const role = (opts.role || "").trim();
    const location = (opts.location || "").trim();
    const intents: PrimaryIntent[] = opts.intents?.length
      ? opts.intents
      : (opts.intent ? [opts.intent] : []);
    const notifications: any[] = [];

    // 1. Matching gigs (by role keyword) — universal but boosted for "gigs" intent
    if (role) {
      const likeRole = escapePostgrestValue(`%${role}%`);
      const { data: gigs } = await supabase
        .from("opportunities")
        .select("id, title")
        .eq("status", "active")
        .or(`title.ilike.${likeRole},description.ilike.${likeRole}`)
        .limit(3);

      if (gigs && gigs.length > 0) {
        notifications.push({
          user_id: userId,
          type: "gig_match",
          category: "after_claim",
          priority: intents.includes("gigs") ? "high" : "normal",
          title: `${gigs.length} gig${gigs.length > 1 ? "s" : ""} match your role`,
          message: `Active opportunities matching "${role}". Apply with one tap using your verified profile.`,
          action_text: "Browse matching gigs",
          action_url: "/opportunities",
          read: false,
        });
      }
    }

    // 2. Creators near you / in your role
    let nearbyQuery = supabase
      .from("profiles")
      .select("user_id, full_name", { count: "exact" })
      .eq("onboarding_completed", true)
      .neq("user_id", userId)
      .not("avatar_url", "is", null);

    if (location) nearbyQuery = nearbyQuery.ilike("location", `%${location}%`);
    else if (role) nearbyQuery = nearbyQuery.ilike("role", `%${role}%`);

    const { data: nearby, count: nearbyCount } = await nearbyQuery.limit(1);

    if ((nearbyCount ?? 0) > 0) {
      notifications.push({
        user_id: userId,
        type: "creator_match",
        category: "after_claim",
        priority: intents.includes("collaborate") ? "high" : "normal",
        title: location
          ? `${nearbyCount} creator${nearbyCount === 1 ? "" : "s"} in ${location}`
          : `${nearbyCount} creator${nearbyCount === 1 ? "" : "s"} like you`,
        message: nearby?.[0]?.full_name
          ? `Including ${nearby[0].full_name}. Tap to introduce yourself.`
          : "Connect, message, and start collaborating today.",
        action_text: "Discover creators",
        action_url: "/circle",
        read: false,
      });
    }

    // 3. Intent-specific power nudges
    for (const intent of intents) {
      if (intent === "gigs") {
        notifications.push({
          user_id: userId,
          type: "intent_nudge",
          category: "after_claim",
          priority: "high",
          title: "🎯 Get hired faster",
          message: "Profiles with 3+ credits get hired 4x more. Add your work history now.",
          action_text: "Add credits",
          action_url: "/profile/edit",
          read: false,
        });
      } else if (intent === "collaborate") {
        notifications.push({
          user_id: userId,
          type: "intent_nudge",
          category: "after_claim",
          priority: "high",
          title: "🤝 Find your circle",
          message: "Message 3 creators this week — collaborations start with hello.",
          action_text: "Browse Match",
          action_url: "/circle",
          read: false,
        });
      } else if (intent === "fund") {
        notifications.push({
          user_id: userId,
          type: "intent_nudge",
          category: "after_claim",
          priority: "high",
          title: "🚀 Launch your campaign",
          message: "Draft your first ThriveFund campaign — no platform fee on first $1k raised.",
          action_text: "Start a campaign",
          action_url: "/thrivefund/new",
          read: false,
        });
      } else if (intent === "hire") {
        notifications.push({
          user_id: userId,
          type: "intent_nudge",
          category: "after_claim",
          priority: "high",
          title: "🧑‍💼 Post your first gig",
          message: "Reach verified creators in minutes. The top profiles are already on Kretopia.",
          action_text: "Post opportunity",
          action_url: "/post-opportunity",
          read: false,
        });
      } else if (intent === "manage") {
        notifications.push({
          user_id: userId,
          type: "intent_nudge",
          category: "after_claim",
          priority: "high",
          title: "🗂️ Set up your workspace",
          message: "Spin up your first project workspace — invoices, files, and tasks in one place.",
          action_text: "Open Studios",
          action_url: "/projects",
          read: false,
        });
      }
    }

    // 4. EPK / share nudge — universal
    notifications.push({
      user_id: userId,
      type: "share_profile",
      category: "after_claim",
      priority: "normal",
      title: "Your verified profile is live",
      message: "Share your one-link EPK so collaborators and clients can find you.",
      action_text: "View my profile",
      action_url: "/profile",
      read: false,
    });

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
  } catch (err) {
    // Non-blocking — never break onboarding flow
    console.error("[afterClaimNudges] seed failed:", err);
  }
}
