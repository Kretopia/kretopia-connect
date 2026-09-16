import { supabase } from "@/integrations/supabase/client";

export type NotificationType = 'match' | 'message' | 'opportunity' | 'milestone' | 'general';

interface SendPushNotificationParams {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
  icon?: string;
  data?: Record<string, any>;
  /** When true, skip creating the in-app notification row (use this when a DB trigger already creates it). */
  skipInApp?: boolean;
}

/**
 * Send a push notification to a user
 * This creates an in-app notification and triggers a push notification if they're subscribed
 */
export async function sendPushNotification(params: SendPushNotificationParams) {
  const { userId, title, body, type, link, icon, data, skipInApp } = params;

  let inAppError: unknown = null;

  try {
    // Create in-app notification (skip if a DB trigger/RPC already handles
    // it — most cross-user cases now do, see the SECURITY DEFINER RPCs in
    // 20260823150000_hire_loop_notification_fix.sql). A direct client
    // insert only succeeds when userId is the caller's own id; notifying a
    // *different* user this way is silently rejected by RLS — still worth
    // attempting the push leg below even when this fails, so track rather
    // than bail.
    if (!skipInApp) {
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          title,
          message: body,
          type,
          link: link || null,
          action_url: link || null,
          action_text: type === 'match' ? 'Send Message' : type === 'message' ? 'View Message' : type === 'opportunity' ? 'View Applicants' : 'View',
          image_url: icon || null,
          priority: type === 'match' || type === 'message' ? 'high' : 'normal',
          category: type,
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
        inAppError = notifError;
      }
    }

    // Trigger push notification via edge function
    const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
      body: {
        userId,
        title,
        body,
        icon: icon || "/logo.png",
        data: {
          type,
          link,
          ...data,
        },
        tag: type, // Group notifications by type
      },
    });

    if (pushError) {
      console.error("Error sending push notification:", pushError);
    }

    if (inAppError) {
      return { success: false, error: inAppError };
    }
    return { success: true };
  } catch (error) {
    console.error("Error in sendPushNotification:", error);
    return { success: false, error };
  }
}

/**
 * Send match notification to both users
 */
export async function notifyMatch(user1Id: string, user2Id: string, user1Name: string, user2Name: string) {
  await Promise.all([
    sendPushNotification({
      userId: user1Id,
      title: "New Match! 🎉",
      body: `You matched with ${user2Name}`,
      type: "match",
      link: `/messages?user=${user2Id}`,
      data: { matchedUserId: user2Id },
    }),
    sendPushNotification({
      userId: user2Id,
      title: "New Match! 🎉",
      body: `You matched with ${user1Name}`,
      type: "match",
      link: `/messages?user=${user1Id}`,
      data: { matchedUserId: user1Id },
    }),
  ]);
}

/**
 * Send message notification
 */
export async function notifyMessage(receiverId: string, senderName: string, messagePreview: string) {
  await sendPushNotification({
    userId: receiverId,
    title: `New message from ${senderName}`,
    body: messagePreview,
    type: "message",
    link: "/messages",
  });
}

/**
 * Send opportunity notification
 */
export async function notifyOpportunity(
  userId: string,
  opportunityTitle: string,
  opportunityId: string,
  skipInApp?: boolean,
) {
  await sendPushNotification({
    userId,
    title: "New Application Received!",
    body: `Someone applied to: ${opportunityTitle}`,
    type: "opportunity",
    link: `/opportunity-dashboard?opportunity=${opportunityId}`,
    skipInApp,
  });
}

/**
 * Send milestone notification
 */
export async function notifyMilestone(userId: string, projectTitle: string, milestoneTitle: string, projectId?: string) {
  await sendPushNotification({
    userId,
    title: "Milestone Update",
    body: `${milestoneTitle} in ${projectTitle}`,
    type: "milestone",
    link: projectId ? `/desk/${projectId}` : "/projects",
  });
}
