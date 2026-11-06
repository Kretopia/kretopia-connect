import { supabase } from "@/integrations/supabase/client";
import { notifyUser } from "@/lib/notifyUser";
import { sendPushNotification } from "@/lib/pushNotifications";

/** The page that shows one co-sign request and records the answer. It is keyed by the request's own token and needs no account. */
export const cosignRequestPath = (token: string) => `/credit-verify?token=${encodeURIComponent(token)}`;

/**
 * Tells a member they were asked to co-sign a credit. The in-app notification and the push both open that exact request, where
 * they can confirm or decline, instead of the member's own profile (which showed nothing about it). Best-effort: the request
 * itself is already saved, so a failed notification never fails it.
 *
 * The push says who asked and nothing more: no project, no token in the text. The device only shows a title and a line, and
 * the token travels inside the encrypted payload as the link to open.
 */
export async function notifyCosignRequest(params: {
  endorserId: string;
  requesterId: string;
  requesterName?: string | null;
  projectName: string;
  /** `credit_endorsements.token` of the request just created. Without it the link falls back to the profile. */
  token?: string | null;
}): Promise<void> {
  const { endorserId, requesterId, projectName, token } = params;
  try {
    let who = params.requesterName?.trim() || "";
    if (!who) {
      try {
        const { data } = await supabase.from("profiles").select("full_name").eq("user_id", requesterId).maybeSingle();
        who = data?.full_name?.trim() || "";
      } catch {
        // A name that cannot be read must not stop the member being told: it falls back to "Someone".
      }
    }
    const link = token ? cosignRequestPath(token) : "/profile";

    await notifyUser({
      userId: endorserId,
      type: "credit_confirmation_request",
      title: "Can you confirm a credit?",
      message: `${who || "Someone"} says you worked together on ${projectName}. One tap to confirm.`,
      actionUrl: link,
      actionText: "Review request",
      category: "credits",
    });

    // The in-app row above is the record; the push only has to reach the device, so it must not add a second row.
    await sendPushNotification({
      userId: endorserId,
      title: `${who || "Someone"} asked you to co-sign a credit`,
      body: "Open Kretopia to confirm or decline.",
      type: "cosign_request",
      link,
      tag: token ? `cosign:${token}` : "cosign",
      skipInApp: true,
    });
  } catch (error) {
    console.warn("notifyCosignRequest failed", error);
  }
}
