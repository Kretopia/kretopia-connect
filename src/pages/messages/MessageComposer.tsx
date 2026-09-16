import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { MessageAttachments, AttachmentPreview } from "@/components/messages/MessageAttachments";
import { VoiceNoteRecorder } from "@/components/messages/VoiceNoteRecorder";
import { MessageReplyBanner } from "@/components/messages/MessageReply";
import type { Attachment, ReplyTo } from "./types";

interface Props {
  newMessage: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  attachment: Attachment | null;
  setAttachment: (a: Attachment | null) => void;
  replyTo: ReplyTo | null;
  clearReply: () => void;
  onSendVoice: (url: string, duration: number) => void;
}

export const MessageComposer = forwardRef<HTMLInputElement, Props>(
  ({ newMessage, onChange, onSubmit, attachment, setAttachment, replyTo, clearReply, onSendVoice }, ref) => (
    <div className="p-3 sm:p-4 border-t border-border bg-card/95 backdrop-blur-sm space-y-2">
      {replyTo && <MessageReplyBanner replyTo={replyTo} onCancel={clearReply} />}
      {attachment && (
        <AttachmentPreview
          url={attachment.url}
          type={attachment.type}
          fileName={attachment.fileName}
          onRemove={() => setAttachment(null)}
        />
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="flex items-center gap-2"
      >
        <MessageAttachments
          onAttach={(url, type, fileName) => setAttachment({ url, type, fileName })}
          disabled={!!attachment}
        />
        <VoiceNoteRecorder onSend={onSendVoice} disabled={!!attachment} />
        <div className="flex-1 relative">
          <Input
            ref={ref}
            value={newMessage}
            onChange={onChange}
            placeholder={replyTo ? "Reply..." : "Type a message..."}
            className="flex-1 rounded-2xl pr-4 bg-card/80 backdrop-blur-sm border-[hsl(var(--energy)/0.25)] focus-visible:ring-1 focus-visible:ring-[hsl(var(--energy))]"
          />
        </div>
        <button
          type="submit"
          disabled={!newMessage.trim() && !attachment}
          aria-label="Send message"
          className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-colors bg-[hsl(var(--energy))] hover:bg-[hsl(var(--energy)/0.9)]"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
);
MessageComposer.displayName = "MessageComposer";
