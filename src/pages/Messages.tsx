import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StartProjectFromMatchDialog } from "@/components/project/StartProjectFromMatchDialog";
import { IceBreakers } from "@/components/messages/IceBreakers";
import { TypingIndicator, useTypingStatus } from "@/components/messages/TypingIndicator";
import { GroupChatPanel } from "@/components/messages/GroupChatPanel";
import { CreateGroupDialog } from "@/components/messages/CreateGroupDialog";
import { useOnlinePresence } from "@/components/messages/OnlinePresence";
import { ImageLightbox } from "@/components/messages/ImageLightbox";
import { PageTransition } from "@/components/PageTransition";
import type { GroupRoom } from "@/components/messages/GroupsList";

import { useConversations } from "./messages/useConversations";
import { useChatMessages } from "./messages/useChatMessages";
import { useSendMessage } from "./messages/useSendMessage";
import { ConversationListPanel } from "./messages/ConversationListPanel";
import { ChatHeader } from "./messages/ChatHeader";
import { MessageBubble } from "./messages/MessageBubble";
import { MessageComposer } from "./messages/MessageComposer";
import { EmptyChatState } from "./messages/EmptyChatState";
import { VibeCheckPrompt } from "@/components/calls/VibeCheckPrompt";
import { FeatureTutorial } from "@/components/landing/kretopia/FeatureTutorial";
import { MESSAGES_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import type { Attachment, ReplyTo, Message } from "./messages/types";

const Messages = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const navigationState = location.state as { receiverId?: string; receiverName?: string } | null;
  const [selectedConversation, setSelectedConversation] = useState<string | null>(
    navigationState?.receiverId || searchParams.get("user") || searchParams.get("userId")
  );
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'inbox' | 'groups' | 'calls' | 'requests'>('inbox');
  const [requestCount] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<GroupRoom | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupsRefreshKey, setGroupsRefreshKey] = useState(0);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [matchId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onlineUsers = useOnlinePresence(currentUserId);
  const { setTyping } = useTypingStatus(selectedConversation || '', currentUserId);

  const {
    conversations, conversationsLoading, unreadCounts, connections,
    fetchConnections, fetchConversations, clearUnread,
  } = useConversations(currentUserId);

  const { messages, otherUser, reactionsByMsg } = useChatMessages({
    currentUserId,
    selectedConversation,
    onConversationsRefresh: fetchConversations,
    onClearUnread: clearUnread,
  });

  const { sendMessage, sendVoiceNote } = useSendMessage({ currentUserId, selectedConversation });

  // Sync URL params
  useEffect(() => {
    const userIdFromUrl = navigationState?.receiverId || searchParams.get("user") || searchParams.get("userId");
    if (userIdFromUrl && userIdFromUrl !== selectedConversation) {
      setSelectedConversation(userIdFromUrl);
    }
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl === 'calls' || tabFromUrl === 'groups' || tabFromUrl === 'requests' || tabFromUrl === 'inbox') {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams, navigationState]);

  useEffect(() => {
    const trackPageView = async () => {
      const { analytics } = await import("@/lib/analytics");
      analytics.pageView("messages");
    };
    trackPageView();
  }, []);

  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
      supabase
        .from('profiles')
        .select('role, full_name')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setCurrentUserRole(data.role);
            setCurrentUserName(data.full_name || 'You');
          }
        }, () => {});
    }
  }, [user]);

  // Auto-join group via invite
  useEffect(() => {
    const code = searchParams.get("groupInvite");
    if (!code || !currentUserId) return;
    (async () => {
      const { data, error } = await supabase.rpc("join_group_by_invite", { _invite_code: code });
      if (error) {
        toast({ title: "Couldn't join group", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Joined group", description: "You're in! Welcome." });
      setActiveTab('groups');
      setGroupsRefreshKey((k) => k + 1);
      const url = new URL(window.location.href);
      url.searchParams.delete("groupInvite");
      window.history.replaceState({}, "", url.toString());
      if (data) {
        const { data: room } = await supabase
          .from("spark_rooms")
          .select("id,title,icon_emoji,member_count,message_count,updated_at,created_by,circle_type")
          .eq("id", data as string)
          .maybeSingle();
        if (room) setSelectedGroup(room as GroupRoom);
      }
    })();
  }, [searchParams, currentUserId, toast]);

  useEffect(() => {
    if (selectedConversation && currentUserId) {
      setReplyTo(null);
      const trackConversation = async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.featureUsed("conversation_opened", { partner_id: selectedConversation });
      };
      trackConversation();

      // Prefill greeting when arriving from a fresh match — removes blank-page friction
      const fromMatch = searchParams.get("from") === "match";
      if (fromMatch && !newMessage) {
        const firstName = otherUser?.name?.split(" ")[0] || "there";
        setNewMessage(`Hey ${firstName}! Excited we matched 👋 `);
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    }
  }, [selectedConversation, currentUserId, otherUser?.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredConversations = conversations.filter((conv) => {
    const partnerId = conv.sender_id === currentUserId ? conv.receiver_id : conv.sender_id;
    const partnerName = (conv.sender_id === currentUserId ? conv.receiver_name : conv.sender_name) || '';
    return partnerName.toLowerCase().includes(searchQuery.toLowerCase()) && connections.has(partnerId);
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    setTyping(true);
    if (typingTimeout) clearTimeout(typingTimeout);
    const timeout = setTimeout(() => setTyping(false), 2000);
    setTypingTimeout(timeout);
  };

  const handleReply = (msg: Message) => {
    const senderName = msg.sender_id === currentUserId ? currentUserName : (otherUser?.name || 'Unknown');
    setReplyTo({ id: msg.id, content: msg.content, senderName });
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    setTyping(false);
    const ok = await sendMessage({ text: newMessage, attachment, replyTo });
    if (ok) {
      setNewMessage("");
      setAttachment(null);
      setReplyTo(null);
    }
  };

  return (
    <PageTransition>
      {/* No bottom padding on this outer row itself: KretopiaBottomNav/ThriveBar
          are both lg:hidden (visible below 1024px, gone at lg:), so a bare
          "lg:pb-24" here was backwards -- it added clearance only at the
          width where nothing needs clearing. Each child (conversation list,
          chat panel) already reserves its own bottom space correctly for
          the <lg case; the outer row doesn't need to duplicate it. */}
      <div className="accent-match flex h-[calc(100dvh-4rem)] overflow-hidden">
        <ConversationListPanel
          hidden={!!(selectedConversation || selectedGroup)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          requestCount={requestCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          conversationsLoading={conversationsLoading}
          filteredConversations={filteredConversations}
          currentUserId={currentUserId}
          selectedConversation={selectedConversation}
          setSelectedConversation={setSelectedConversation}
          selectedGroupId={selectedGroup?.id || null}
          onSelectGroup={setSelectedGroup}
          onCreateGroup={() => setCreateGroupOpen(true)}
          groupsRefreshKey={groupsRefreshKey}
          onlineUsers={onlineUsers}
          unreadCounts={unreadCounts}
          onAcceptRequest={() => { fetchConnections(); fetchConversations(); }}
          navigate={navigate}
        />

        {selectedGroup ? (
          <GroupChatPanel
            group={selectedGroup}
            currentUserId={currentUserId}
            onBack={() => setSelectedGroup(null)}
          />
        ) : selectedConversation && otherUser ? (
          <div className="flex-1 flex flex-col bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-24">
            <ChatHeader
              otherUser={otherUser}
              isOnline={onlineUsers.has(otherUser.id)}
              onBack={() => setSelectedConversation(null)}
              onViewProfile={() => navigate(`/profile/${otherUser.id}`)}
              onStartProject={() => setShowProjectDialog(true)}
            />

            {messages.length === 0 && (
              <IceBreakers
                recipientId={otherUser.id}
                recipientName={otherUser.name || 'Creator'}
                recipientRole={otherUser.role}
                currentUserRole={currentUserRole}
                onSelectIceBreaker={(message) => setNewMessage(message)}
              />
            )}

            {messages.length >= 3 && selectedConversation && (
              <VibeCheckPrompt
                conversationId={selectedConversation}
                recipientId={otherUser.id}
                recipientName={otherUser.name || 'Creator'}
              />
            )}

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <EmptyChatState
                    otherUser={otherUser}
                    isOnline={onlineUsers.has(otherUser.id)}
                    onViewProfile={() => navigate(`/profile/${otherUser.id}`)}
                    onStartProject={() => setShowProjectDialog(true)}
                  />
                ) : (
                  messages.map((msg, index) => {
                    const isOwn = msg.sender_id === currentUserId;
                    const showAvatar =
                      index === messages.length - 1 || messages[index + 1]?.sender_id !== msg.sender_id;
                    const reactions = reactionsByMsg.get(msg.id) || [];
                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isOwn={isOwn}
                        showAvatar={showAvatar}
                        reactions={reactions}
                        currentUserId={currentUserId}
                        otherUser={otherUser}
                        onReply={handleReply}
                        onOpenLightbox={setLightboxUrl}
                      />
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {selectedConversation && currentUserId && (
                <TypingIndicator recipientId={selectedConversation} currentUserId={currentUserId} />
              )}
            </ScrollArea>

            <MessageComposer
              ref={inputRef}
              newMessage={newMessage}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              attachment={attachment}
              setAttachment={setAttachment}
              replyTo={replyTo}
              clearReply={() => setReplyTo(null)}
              onSendVoice={sendVoiceNote}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8 bg-background">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase mb-2">
                  Messages
                </p>
                <h2 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05] mb-2">
                  Your Conversations
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Send messages to creators you've connected with</p>
              </div>
              <div className="dark-surface rounded-2xl p-1" style={{ backgroundColor: "#05070D" }}>
                <FeatureTutorial steps={MESSAGES_TUTORIAL} label="Messages tutorial" />
              </div>
            </div>
          </div>
        )}

        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

        {otherUser && (
          <StartProjectFromMatchDialog
            open={showProjectDialog}
            onOpenChange={setShowProjectDialog}
            matchedUser={{
              id: otherUser.id,
              name: otherUser.name || 'Unknown',
              role: otherUser.role || 'Creator',
              avatar: otherUser.avatar,
            }}
            matchId={matchId}
            currentUserRole={currentUserRole}
          />
        )}

        <CreateGroupDialog
          open={createGroupOpen}
          onOpenChange={setCreateGroupOpen}
          currentUserId={currentUserId}
          onCreated={() => {
            setActiveTab('groups');
            setGroupsRefreshKey((k) => k + 1);
          }}
        />
      </div>
    </PageTransition>
  );
};

export default Messages;
