import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

export interface ReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface MessageReactionsProps {
  messageId: string;
  currentUserId: string;
  reactions: ReactionRow[];
  isOwn: boolean;
}

export const MessageReactions = ({ messageId, currentUserId, reactions, isOwn }: MessageReactionsProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Group by emoji
  const grouped = reactions.reduce<Record<string, ReactionRow[]>>((acc, r) => {
    (acc[r.emoji] ||= []).push(r);
    return acc;
  }, {});

  const toggleReaction = async (emoji: string) => {
    const existing = reactions.find(r => r.user_id === currentUserId && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
    setPickerOpen(false);
  };

  if (Object.keys(grouped).length === 0) return null;

  return (
    <div className={`flex items-center gap-1 mt-1 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}>
      {Object.entries(grouped).map(([emoji, rows]) => {
        const mine = rows.some(r => r.user_id === currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all ${
              mine
                ? "bg-primary/20 border-primary/50 text-foreground"
                : "bg-muted border-border hover:bg-muted/80"
            }`}
          >
            <span>{emoji}</span>
            {rows.length > 1 && <span className="font-medium">{rows.length}</span>}
          </button>
        );
      })}
    </div>
  );
};

interface ReactionPickerProps {
  messageId: string;
  currentUserId: string;
  reactions: ReactionRow[];
  align?: "start" | "end";
  trigger?: React.ReactNode;
}

export const ReactionPicker = ({ messageId, currentUserId, reactions, align = "start", trigger }: ReactionPickerProps) => {
  const [open, setOpen] = useState(false);

  const addReaction = async (emoji: string) => {
    const existing = reactions.find(r => r.user_id === currentUserId && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
            title="React"
          >
            <Smile className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-1.5 rounded-full" align={align} side="top">
        <div className="flex items-center gap-0.5">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => addReaction(emoji)}
              className="text-xl hover:scale-125 transition-transform p-1 rounded-full hover:bg-muted"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
