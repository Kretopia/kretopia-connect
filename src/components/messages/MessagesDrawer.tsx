import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useConversations } from "@/pages/messages/useConversations";
import { cn } from "@/lib/utils";
import { NAV_ICON, NAV_ICON_BUTTON, NAV_ICON_STROKE } from "@/components/nav/navIcon";

/**
 * Navbar "Messages" entry point — jumps straight to the full-screen
 * /messages page (ConversationListPanel + chat, same UX as the rest of the
 * app) instead of opening a small preview drawer first. Previously this
 * showed a side-drawer list of recent conversations with an "Open full
 * inbox →" link to get to the real page; that middle step is gone, the
 * badge count is all that's left to compute here.
 */
export const MessagesDrawer = ({ triggerClassName }: { triggerClassName?: string }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCounts } = useConversations(user?.id || "");

  const totalUnread = useMemo(
    () => Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0),
    [unreadCounts]
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(NAV_ICON_BUTTON, triggerClassName)}
      aria-label="Messages"
      onClick={() => navigate("/messages")}
    >
      <MessageCircle className={NAV_ICON} strokeWidth={NAV_ICON_STROKE} />
      {totalUnread > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
        >
          {totalUnread > 9 ? "9+" : totalUnread}
        </Badge>
      )}
    </Button>
  );
};

export default MessagesDrawer;
