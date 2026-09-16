import { supabase } from "@/integrations/supabase/client";

/**
 * Creates an in-app notification for ANOTHER user.
 *
 * A direct insert into `notifications` from the browser is blocked by RLS
 * (the insert policy only allows rows where user_id = auth.uid()). The
 * `create_notification` SECURITY DEFINER RPC is the supported path for
 * cross-user notifications (connection requests, matches, project invites).
 *
 * Best-effort: never throws, so the calling flow (connect / match / invite)
 * still succeeds if notification delivery fails.
 */
export async function notifyUser(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  actionUrl?: string | null;
  actionText?: string | null;
  imageUrl?: string | null;
  priority?: string;
  category?: string;
}): Promise<void> {
  try {
    const { error } = await supabase.rpc("create_notification", {
      p_user_id: params.userId,
      p_title: params.title,
      p_message: params.message,
      p_type: params.type,
      p_link: params.link ?? null,
      p_action_url: params.actionUrl ?? null,
      p_action_text: params.actionText ?? null,
      p_image_url: params.imageUrl ?? null,
      p_priority: params.priority ?? "normal",
      p_category: params.category ?? "general",
    } as never);
    if (error) console.warn("notifyUser failed", error.message);
  } catch (e) {
    console.warn("notifyUser threw", e);
  }
}
