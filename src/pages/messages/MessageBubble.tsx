import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCheck, Check, Reply, FileText, ImageOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { InlineReply } from "@/components/messages/MessageReply";
import { MessageReactions, ReactionPicker, type ReactionRow } from "@/components/messages/MessageReactions";
import { VoiceNotePlayer } from "@/components/messages/VoiceNoteRecorder";
import { SharedContentCard, type SharedContentType } from "@/components/messages/SharedContentCard";
import type { Message, OtherUser } from "./types";

interface Props {
  msg: Message;
  isOwn: boolean;
  showAvatar: boolean;
  reactions: ReactionRow[];
  currentUserId: string;
  otherUser: OtherUser | null;
  onReply: (msg: Message) => void;
  onOpenLightbox: (url: string) => void;
}

export const MessageBubble = ({ msg, isOwn, showAvatar, reactions, currentUserId, otherUser, onReply, onOpenLightbox }: Props) => {
  const [imageFailed, setImageFailed] = useState(false);
  let lastTap = 0;
  const handleDoubleTap = async () => {
    const now = Date.now();
    if (now - lastTap < 350) {
      const existing = reactions.find((r) => r.user_id === currentUserId && r.emoji === "❤️");
      if (!existing) {
        await supabase.from("message_reactions").insert({ message_id: msg.id, user_id: currentUserId, emoji: "❤️" });
      }
    }
    lastTap = now;
  };

  const nativeImage = msg.attachment_type === 'image' && msg.attachment_url;
  const nativeFile = msg.attachment_type === 'file' && msg.attachment_url;
  const nativeVoice = msg.attachment_type === 'voice' && msg.attachment_url;
  const legacyImageMatch = !nativeImage && !nativeFile && msg.content.match(/\[📷 Image\]\((https?:\/\/[^\)]+)\)/);
  const legacyFileMatch = !nativeImage && !nativeFile && msg.content.match(/\[📎 ([^\]]+)\]\((https?:\/\/[^\)]+)\)/);
  const cleanText = msg.content
    .replace(/\[📷 Image\]\([^\)]+\)/, '')
    .replace(/\[📎 [^\]]+\]\([^\)]+\)/, '')
    .trim();
  const showText = !nativeVoice && cleanText && cleanText !== '📷 Image' && !cleanText.startsWith('📎 ') && cleanText !== '🎙️ Voice note';

  return (
    <div className={`flex gap-2 group ${isOwn ? "justify-end" : "justify-start"}`}>
      {!isOwn && showAvatar && (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={otherUser?.avatar} />
          <AvatarFallback className="text-xs">
            {(otherUser?.name || 'U').split(" ").map((n) => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
      )}
      {!isOwn && !showAvatar && <div className="w-8" />}

      <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[75%]`}>
        {msg.reply_to_content && (
          <InlineReply content={msg.reply_to_content} senderName={msg.reply_to_sender_name || 'Unknown'} isOwn={isOwn} />
        )}

        <div className="space-y-1.5 cursor-pointer select-none" onClick={handleDoubleTap}>
          {msg.shared_content_type && msg.shared_content_id && (
            <SharedContentCard
              type={msg.shared_content_type as SharedContentType}
              id={msg.shared_content_id}
              meta={msg.shared_content_meta}
              isOwn={isOwn}
            />
          )}

          {nativeVoice && (
            <div className="flex flex-col gap-1">
              <VoiceNotePlayer url={msg.attachment_url!} duration={msg.attachment_duration || undefined} isOwn={isOwn} />
              {msg.voice_note_transcript === null || msg.voice_note_transcript === undefined ? (
                <span className={`text-xs italic ${isOwn ? "text-primary-foreground/60 self-end" : "text-muted-foreground"} px-2`}>
                  Transcribing…
                </span>
              ) : msg.voice_note_transcript.trim() ? (
                <details className="group/transcript px-2 max-w-[260px]">
                  <summary className={`text-xs italic cursor-pointer ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"} list-none select-none hover:underline`}>
                    Show transcript
                  </summary>
                  <p className={`text-xs italic mt-1 whitespace-pre-wrap break-words ${isOwn ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {msg.voice_note_transcript}
                  </p>
                </details>
              ) : null}
            </div>
          )}

          {nativeImage && (
            imageFailed ? (
              <div className="flex items-center gap-2 max-w-[240px] rounded-2xl border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                <ImageOff className="h-3.5 w-3.5 shrink-0" /> Image unavailable
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onOpenLightbox(msg.attachment_url!); }} className="block">
                <img
                  src={msg.attachment_url!}
                  alt="Shared image"
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                  className="max-w-[240px] max-h-[280px] min-h-[80px] rounded-2xl object-cover border border-border bg-muted/30"
                />
              </button>
            )
          )}

          {nativeFile && (
            <a
              href={msg.attachment_url!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl ${isOwn ? "bg-primary/80 text-primary-foreground" : "bg-muted"}`}
            >
              <FileText className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate underline">{msg.attachment_name || 'Download file'}</p>
              </div>
            </a>
          )}

          {legacyImageMatch && (
            imageFailed ? (
              <div className="flex items-center gap-2 max-w-[240px] rounded-2xl border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                <ImageOff className="h-3.5 w-3.5 shrink-0" /> Image unavailable
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); onOpenLightbox(legacyImageMatch[1]); }} className="block">
                <img
                  src={legacyImageMatch[1]}
                  alt="Shared image"
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                  className="max-w-[240px] max-h-[280px] min-h-[80px] rounded-2xl object-cover border border-border bg-muted/30"
                />
              </button>
            )
          )}

          {legacyFileMatch && (
            <a href={legacyFileMatch[2]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${isOwn ? "bg-primary/80 text-primary-foreground" : "bg-muted"}`}>
              <FileText className="h-4 w-4" />
              <span className="text-sm underline">{legacyFileMatch[1]}</span>
            </a>
          )}

          {showText && (
            <div className={`rounded-2xl px-4 py-2.5 ${isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"}`}>
              <p className="text-sm break-words whitespace-pre-wrap">{cleanText}</p>
            </div>
          )}
        </div>

        <MessageReactions messageId={msg.id} currentUserId={currentUserId} reactions={reactions} isOwn={isOwn} />

        <div className="flex items-center gap-1 mt-1 px-1">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true }).replace('about ', '')}
          </span>
          {isOwn && (msg.read ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3 text-muted-foreground" />)}
          <div className="flex items-center gap-0.5 ml-1">
            <ReactionPicker messageId={msg.id} currentUserId={currentUserId} reactions={reactions} align={isOwn ? "end" : "start"} />
            <button
              onClick={() => onReply(msg)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
              title="Reply"
            >
              <Reply className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
