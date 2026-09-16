import { X } from "lucide-react";

interface MessageReplyProps {
  replyTo: {
    id: string;
    content: string;
    senderName: string;
  };
  onCancel: () => void;
}

export const MessageReplyBanner = ({ replyTo, onCancel }: MessageReplyProps) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border-l-2 border-primary">
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-primary truncate">{replyTo.senderName}</p>
      <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
    </div>
    <button onClick={onCancel} className="text-muted-foreground hover:text-foreground flex-shrink-0">
      <X className="h-4 w-4" />
    </button>
  </div>
);

interface InlineReplyProps {
  content: string;
  senderName: string;
  isOwn: boolean;
}

export const InlineReply = ({ content, senderName, isOwn }: InlineReplyProps) => (
  <div
    className={`text-xs px-3 py-1.5 rounded-lg mb-1 border-l-2 ${
      isOwn
        ? "bg-primary/20 border-primary/50 text-primary-foreground/80"
        : "bg-muted/80 border-muted-foreground/30 text-muted-foreground"
    }`}
  >
    <span className="font-medium">{senderName}</span>
    <p className="truncate max-w-[200px]">{content}</p>
  </div>
);
