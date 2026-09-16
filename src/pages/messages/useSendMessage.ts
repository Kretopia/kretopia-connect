import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Attachment, ReplyTo } from "./types";

interface Args {
  currentUserId: string;
  selectedConversation: string | null;
}

export const useSendMessage = ({ currentUserId, selectedConversation }: Args) => {
  const { toast } = useToast();

  const sendMessage = useCallback(async ({ text, attachment, replyTo }: { text: string; attachment: Attachment | null; replyTo: ReplyTo | null }) => {
    if ((!text.trim() && !attachment) || !selectedConversation) return false;

    const insertData: any = {
      sender_id: currentUserId,
      receiver_id: selectedConversation,
      content: text.trim() || (attachment ? (attachment.type === 'image' ? '📷 Image' : `📎 ${attachment.fileName || 'File'}`) : ''),
      read: false,
    };
    if (attachment) {
      insertData.attachment_url = attachment.url;
      insertData.attachment_type = attachment.type;
      insertData.attachment_name = attachment.fileName;
    }
    if (replyTo) {
      insertData.reply_to_id = replyTo.id;
      insertData.reply_to_content = replyTo.content.substring(0, 200);
      insertData.reply_to_sender_name = replyTo.senderName;
    }

    const { error } = await supabase.from("messages").insert(insertData);
    if (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      return false;
    }

    // Notifications (fire-and-forget)
    (async () => {
      const { data: senderProfile } = await supabase.from('profiles').select('full_name').eq('user_id', currentUserId).single();
      if (senderProfile) {
        const { notifyMessage } = await import("@/lib/pushNotifications");
        const preview = attachment ? (attachment.type === 'image' ? '📷 Sent an image' : '📎 Sent a file') : (text.trim() || 'New message');
        notifyMessage(selectedConversation, senderProfile.full_name || 'Someone', preview).catch(() => {});
        supabase.functions.invoke('send-user-email', {
          body: { type: 'message', recipientId: selectedConversation, data: { messagePreview: preview } },
        }).catch((err) => console.error('[useSendMessage] email failed:', err));
      }
      const { analytics } = await import("@/lib/analytics");
      analytics.messageSent(selectedConversation, 'direct');
    })();

    return true;
  }, [currentUserId, selectedConversation, toast]);

  const sendVoiceNote = useCallback(async (url: string, duration: number) => {
    if (!selectedConversation) return;
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        sender_id: currentUserId,
        receiver_id: selectedConversation,
        content: '🎙️ Voice note',
        attachment_url: url,
        attachment_type: 'voice',
        attachment_duration: duration,
        read: false,
      })
      .select('id')
      .single();

    if (error || !inserted) return;

    // Fire-and-forget transcription (does not block message delivery)
    supabase.functions
      .invoke('transcribe-voice-note', {
        body: { message_id: inserted.id, audio_url: url },
      })
      .catch((err) => console.error('[transcribe-voice-note] failed:', err));
  }, [currentUserId, selectedConversation]);

  return { sendMessage, sendVoiceNote };
};
