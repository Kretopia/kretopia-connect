import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, CheckCheck, Check, MessageCircle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageTip } from "@/components/PageTip";
import { ConversationListSkeleton } from "@/components/skeletons/MessagesSkeletons";
import { GroupsList, type GroupRoom } from "@/components/messages/GroupsList";
import { MessageRequests } from "@/components/messages/MessageRequests";
import { OnlineDot } from "@/components/messages/OnlinePresence";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { CallHistoryPanel } from "@/components/calls/CallHistoryPanel";
import { QuickCallButton } from "@/components/calls/QuickCallButton";
import { useMissedCallBadge } from "@/hooks/useCallHistory";
import { useAccountTone } from "@/hooks/useAccountTone";
import { useTrinidadVoice } from "@/hooks/useTrinidadVoice";
import type { Conversation } from "./types";

type MessagesTab = 'inbox' | 'groups' | 'calls' | 'requests';

interface Props {
  hidden: boolean;
  activeTab: MessagesTab;
  setActiveTab: (t: MessagesTab) => void;
  requestCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  conversationsLoading: boolean;
  filteredConversations: Conversation[];
  currentUserId: string;
  selectedConversation: string | null;
  setSelectedConversation: (id: string) => void;
  selectedGroupId: string | null;
  onSelectGroup: (g: GroupRoom) => void;
  onCreateGroup: () => void;
  groupsRefreshKey: number;
  onlineUsers: Set<string>;
  unreadCounts: Map<string, number>;
  onAcceptRequest: () => void;
  navigate: (to: string) => void;
}

export const ConversationListPanel = ({
  hidden, activeTab, setActiveTab, requestCount, searchQuery, setSearchQuery,
  conversationsLoading, filteredConversations, currentUserId, selectedConversation,
  setSelectedConversation, selectedGroupId, onSelectGroup, onCreateGroup, groupsRefreshKey,
  onlineUsers, unreadCounts, onAcceptRequest, navigate,
}: Props) => {
  const { count: missedCount } = useMissedCallBadge();
  const { pick, isBusiness } = useAccountTone();
  const { pick: pickVoice } = useTrinidadVoice();
  const getPartner = (conv: Conversation) =>
    conv.sender_id === currentUserId
      ? { id: conv.receiver_id, name: conv.receiver_name, avatar: conv.receiver_avatar }
      : { id: conv.sender_id, name: conv.sender_name, avatar: conv.sender_avatar };

  return (
    <div className={`${hidden ? "hidden md:flex" : "flex"} w-full md:w-[340px] lg:w-96 flex-col border-r border-border bg-card pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0`}>
      <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">Your inbox</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] leading-[1.05]">Messages</h1>
          </div>
          <QuickCallButton label="Start a call" className="rounded-full gap-2 shrink-0 mt-1" />
        </div>
        <PageTip
          id="messages"
          title="Your conversations live here"
          message="Match with creators in Circle first, then come here to chat. Tip: mention something specific from their profile to break the ice!"
        />
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full rounded-full bg-card/80 backdrop-blur-sm border border-border p-1">
            <TabsTrigger value="inbox" className="flex-1 rounded-full text-xs sm:text-sm data-[state=active]:text-match data-[state=active]:ring-1 data-[state=active]:ring-[hsl(var(--accent-match))]/20">Direct</TabsTrigger>
            <TabsTrigger value="groups" className="flex-1 rounded-full text-xs sm:text-sm data-[state=active]:text-match data-[state=active]:ring-1 data-[state=active]:ring-[hsl(var(--accent-match))]/20">Groups</TabsTrigger>
            <TabsTrigger value="calls" className="flex-1 rounded-full text-xs sm:text-sm data-[state=active]:text-match data-[state=active]:ring-1 data-[state=active]:ring-[hsl(var(--accent-match))]/20">
              Calls {missedCount > 0 && <Badge variant="destructive" className="ml-1">{missedCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex-1 rounded-full text-xs sm:text-sm data-[state=active]:text-match data-[state=active]:ring-1 data-[state=active]:ring-[hsl(var(--accent-match))]/20">
              Requests {requestCount > 0 && <Badge variant="destructive" className="ml-1">{requestCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {activeTab === 'inbox' && (
          <div className="relative">
            <Search
              aria-hidden
              className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-[hsl(var(--energy))]"
            />
            <Input
              placeholder="Search messages..."
              aria-label="Search messages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-11 rounded-2xl bg-card/80 backdrop-blur-sm text-sm border-[hsl(var(--energy)/0.25)] focus-visible:ring-1 focus-visible:ring-[hsl(var(--energy))]"
            />
          </div>
        )}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {activeTab === 'calls' ? (
        <CallHistoryPanel />
      ) : (
      <ScrollArea className="flex-1">
        {activeTab === 'groups' ? (
          <GroupsList currentUserId={currentUserId} selectedGroupId={selectedGroupId} onSelect={onSelectGroup} onCreate={onCreateGroup} refreshKey={groupsRefreshKey} />
        ) : activeTab === 'requests' ? (
          <MessageRequests
            currentUserId={currentUserId}
            onAccept={onAcceptRequest}
            onSelectConversation={(userId) => { setActiveTab('inbox'); setSelectedConversation(userId); }}
          />
        ) : conversationsLoading ? (
          <ConversationListSkeleton />
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mb-5 mx-auto w-20 h-20 rounded-2xl bg-energy/10 border-2 border-energy/30 flex items-center justify-center shadow-glow-lime">
              <MessageCircle className="h-10 w-10 text-energy" />
            </div>
            <p className="brand-eyebrow mb-2">{searchQuery ? "No matches" : "Inbox zero"}</p>
            <p className="text-xl font-black tracking-[-0.02em] mb-2">
              {searchQuery ? "Nothing matches that" : pick(pickVoice("No messages yet", "No messages yet, start one"), "No conversations yet")}
            </p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              {searchQuery
                ? "Try a different name or keyword."
                : pick(
                    pickVoice(
                      "Connect with a creative and start a conversation.",
                      "Link up with a creative and start the convo.",
                    ),
                    "Reach out to talent or wait for applicants to reply.",
                  )}
            </p>
            {!searchQuery && (
              <>
                <Button
                  onClick={() => navigate(isBusiness ? "/talent-finder" : "/match")}
                  variant="lime"
                  size="sm"
                  className="gap-2"
                >
                  {pick(pickVoice("Find a match", "Find a vibe"), "Find talent")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <PushNotificationPrompt trigger="message" className="mt-4" />
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredConversations.map((conv) => {
              const partner = getPartner(conv);
              const unreadCount = unreadCounts.get(partner.id) || 0;
              const isOnline = onlineUsers.has(partner.id);
              return (
                <div
                  key={conv.conversation_id}
                  onClick={() => setSelectedConversation(partner.id)}
                  className={`flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 cursor-pointer hover:bg-accent/50 transition-colors active:bg-accent/70 ${
                    selectedConversation === partner.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-11 w-11 sm:h-14 sm:w-14 border-2 border-background">
                      <AvatarImage src={partner.avatar} />
                      <AvatarFallback className="text-base sm:text-lg">
                        {(partner.name || 'U').split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <OnlineDot isOnline={isOnline} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`truncate text-sm sm:text-base ${unreadCount > 0 ? "font-bold" : "font-semibold"}`}>{partner.name || 'Unknown'}</p>
                        {isOnline && <span className="text-[10px] text-success font-medium flex-shrink-0">online</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true }).replace('about ', '')}
                        </span>
                        {unreadCount > 0 && (
                          <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-glow-purple" aria-label={`${unreadCount} unread`} />
                        )}
                      </div>
                    </div>
                    <p className={`text-xs sm:text-sm truncate ${unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {conv.sender_id === currentUserId ? (
                        <span className="inline-flex items-center gap-1">
                          {conv.read ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" />}
                          {conv.content}
                        </span>
                      ) : (
                        conv.content
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
      )}
    </div>
  );
};
