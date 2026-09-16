import { Users2, MessageCircle, MessageSquare } from "lucide-react";
import { EventGuestRoster } from "./EventGuestRoster";
import { EventGroupChatCard } from "./EventGroupChatCard";
import { EventInlineChat } from "./EventInlineChat";
import { EventComments } from "./EventComments";
import { ContinueAsCircle } from "./ContinueAsCircle";
import { StudioSectionTabs, type StudioSectionTab } from "@/components/studio-reference/StudioSectionTabs";

interface Props {
  eventId: string;
  eventTitle: string;
  eventCategory?: string;
  eventCoverImageUrl?: string;
  hostId: string;
  isCreator: boolean;
  isAuthenticated: boolean;
  currentUserId: string | null;
  isParticipant: boolean;
  participantCount: number;
  guestMatchingEnabled: boolean;
  isPast: boolean;
  isCompleted: boolean;
  groupChatEnabled: boolean;
  groupChatRoomId: string | null;
  onGroupChatChange: (next: { enabled: boolean; roomId: string | null }) => void;
  circleId?: string | null;
  onCircleLinked: () => void;
}

/**
 * Component 2 — the crew. Who's going, the group chat + event chat, and the
 * comment thread are peer content categories under one shell, switched via
 * tabs (StudioSectionTabs — the same accessible, Radix-based primitive used
 * for Recordings/StageGrid) instead of all stacked and visible at once —
 * previously this meant scrolling past a full guest list, a full chat
 * surface, AND a full comment thread just to reach the bottom of the page.
 * Every condition that gated a section before still gates its tab (or hides
 * the tab entirely) exactly as before; nothing lost, just switched instead
 * of stacked. Once the event has happened, the "continue as a Circle"
 * bridge stays outside the tabs, always visible, since it's a one-time CTA
 * rather than a content category (CEO rule: the event turns into a
 * standing group afterward).
 */
export function EventCommunityHub({
  eventId, eventTitle, eventCategory, eventCoverImageUrl, hostId,
  isCreator, isAuthenticated, currentUserId, isParticipant, participantCount,
  guestMatchingEnabled, isPast, isCompleted, groupChatEnabled, groupChatRoomId, onGroupChatChange,
  circleId, onCircleLinked,
}: Props) {
  const tabs: StudioSectionTab[] = [];

  if (guestMatchingEnabled) {
    tabs.push({
      id: "who",
      label: participantCount > 0 ? `Who's Going (${participantCount})` : "Who's Going",
      icon: Users2,
      content: (
        <EventGuestRoster
          eventId={eventId}
          eventTitle={eventTitle}
          hostId={hostId}
          currentUserId={currentUserId}
          isParticipant={isParticipant}
          isHost={isCreator}
          participantCount={participantCount}
        />
      ),
    });
  }

  if (isAuthenticated) {
    tabs.push({
      id: "chat",
      label: "Chat",
      icon: MessageCircle,
      content: (
        <div className="space-y-4">
          <EventGroupChatCard
            eventId={eventId}
            eventTitle={eventTitle}
            isHost={isCreator}
            isParticipant={isParticipant}
            hostId={hostId}
            groupChatEnabled={groupChatEnabled}
            groupChatRoomId={groupChatRoomId}
            onChange={onGroupChatChange}
          />
          {groupChatEnabled && groupChatRoomId && currentUserId && (isCreator || isParticipant) && (
            <EventInlineChat
              roomId={groupChatRoomId}
              currentUserId={currentUserId}
              archived={isPast || isCompleted}
            />
          )}
        </div>
      ),
    });
  }

  tabs.push({
    id: "comments",
    label: "Comments",
    icon: MessageSquare,
    content: (
      <EventComments
        eventId={eventId}
        isCreator={isCreator}
        creatorId={hostId}
        eventTitle={eventTitle}
        isParticipant={isParticipant}
      />
    ),
  });

  return (
    <section className="relative mb-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-2 rounded-[28px] blur-xl opacity-40 ai-ambient-breathe"
        style={{ background: "radial-gradient(60% 100% at 50% 0%, hsl(var(--energy) / 0.15), transparent 70%)" }}
      />
      <div className="relative rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-3 sm:p-4 space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Users2 className="h-4 w-4 text-energy" />
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">The crew</p>
        </div>

        {tabs.length > 1 ? (
          <StudioSectionTabs tabs={tabs} defaultTabId={tabs[0].id} queryParam="crew" />
        ) : (
          tabs[0]?.content
        )}

        {isPast && (
          <ContinueAsCircle
            eventId={eventId}
            eventTitle={eventTitle}
            isCreator={isCreator}
            circleId={circleId}
            category={eventCategory}
            coverImageUrl={eventCoverImageUrl}
            onLinked={onCircleLinked}
          />
        )}
      </div>
    </section>
  );
}

export default EventCommunityHub;
