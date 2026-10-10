import { useNavigate } from "react-router-dom";
import { ArrowRight, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";
import { SceneBanner } from "@/components/brand/SceneBanner";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { MESSAGES_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { useAccountTone } from "@/hooks/useAccountTone";
import type { Conversation } from "./types";

interface Props {
  conversations: Conversation[];
  currentUserId: string;
  onOpen: (userId: string) => void;
  onCreateGroup: () => void;
}

/** The person of the most recent thread, or null when the inbox is empty. */
function latestPartner(conversations: Conversation[], currentUserId: string) {
  const latest = conversations.reduce<Conversation | null>(
    (best, c) => (!best || c.created_at > best.created_at ? c : best),
    null,
  );
  if (!latest) return null;
  const mine = latest.sender_id === currentUserId;
  return {
    id: mine ? latest.receiver_id : latest.sender_id,
    name: (mine ? latest.receiver_name : latest.sender_name) || "",
  };
}

/**
 * What the chat area shows before a conversation is open (md and up; on a
 * phone the list is the page). One Kretopia surface that does one job: get a
 * first message sent. The four steps are static on purpose: the shared
 * FeatureTutorial's orbiting ring read as a loader around the first icon.
 */
export function MessagesEmptyState({ conversations, currentUserId, onOpen, onCreateGroup }: Props) {
  const navigate = useNavigate();
  const { isBusiness } = useAccountTone();
  const partner = latestPartner(conversations, currentUserId);
  const firstName = partner?.name.split(" ")[0] || "them";
  const findRoute = isBusiness ? "/talent-finder" : "/match";
  const threadCount = conversations.length;

  return (
    <WrappedShell
      titleId="messages-empty-title"
      eyebrow="Kretopia · Messages"
      title={<>Start the <span className="k-gradient-text">conversation</span></>}
      subtitle="Every collaboration on Kretopia begins with one message. Yours can be one line."
      status={
        <span>
          {threadCount > 0
            ? `${threadCount} conversation${threadCount === 1 ? "" : "s"} in your inbox.`
            : "Your inbox is empty: the first message is yours to send."}
        </span>
      }
    >
      <SceneBanner scene="match" label="Messages" lazy={false} className="h-28 rounded-2xl border border-border" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {partner ? (
          <CtaButton className="w-full gap-2" onClick={() => onOpen(partner.id)}>
            <Send className="h-4 w-4" aria-hidden />
            Message {firstName}
          </CtaButton>
        ) : (
          <CtaButton className="w-full gap-2" onClick={() => navigate(findRoute)}>
            <Send className="h-4 w-4" aria-hidden />
            Find someone to message
          </CtaButton>
        )}
        {partner ? (
          <Button variant="outline" size="lg" className="w-full gap-2" onClick={() => navigate(findRoute)}>
            Meet someone new
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" size="lg" className="w-full gap-2" onClick={onCreateGroup}>
            <Users className="h-4 w-4" aria-hidden />
            Start a group
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Open with one specific thing from their Passport. It is the easiest first line to write.
      </p>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="How Messages works">
        {MESSAGES_TUTORIAL.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex items-start gap-3 rounded-2xl border border-border bg-background/60 p-3">
              <span className="k-gradient-chip flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card">
                {Icon && <Icon className="k-gradient-icon h-[18px] w-[18px]" aria-hidden />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  <span className="mr-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </WrappedShell>
  );
}

export default MessagesEmptyState;
