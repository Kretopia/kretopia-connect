import { useState, useMemo } from "react";
import { SEO } from "@/components/SEO";
import { ApprovalsHub } from "@/components/agent/ApprovalsHub";
import { HotLeadsStrip } from "@/components/inbox/HotLeadsStrip";
import { useNotifications } from "@/hooks/useNotifications";
import { usePendingAgentActions } from "@/hooks/usePendingAgentActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bell, CheckCheck, ExternalLink, Check, Trash2, Inbox as InboxIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Unified Inbox — split into two clear lanes:
 *  • Needs You — pending approvals + unread actionable notifications
 *    (matches, messages, connections, opportunities, projects, payments)
 *  • FYI      — passive signals (likes, views, system, rewards) + read items
 *
 * Goal: a creator can scan the top of Needs You and know exactly what
 * requires their attention vs. what's just informational noise.
 */

const NEEDS_YOU_CATEGORIES = new Set([
  "match", "message", "connection", "opportunity",
  "project", "payment", "approval", "gig",
]);

const Inbox = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { actions: pendingActions } = usePendingAgentActions();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"needs" | "fyi">("needs");

  const { needsYou, fyi } = useMemo(() => {
    const needs: any[] = [];
    const info: any[] = [];
    for (const n of notifications) {
      const actionable =
        !n.read &&
        (NEEDS_YOU_CATEGORIES.has((n.category || "").toLowerCase()) ||
          n.priority === "high" ||
          !!n.action_url);
      if (actionable) needs.push(n);
      else info.push(n);
    }
    return { needsYou: needs, fyi: info };
  }, [notifications]);

  const needsYouCount = (pendingActions?.length || 0) + needsYou.length;
  const list = tab === "needs" ? needsYou : fyi;

  const handleClick = (notification: any) => {
    if (!notification.read) markAsRead(notification.id);
    const dest = notification.action_url || notification.link;
    if (dest) navigate(dest);
  };

  return (
    <div className="min-h-screen bg-background pb-24 accent-match">
      <SEO title="Inbox - Kretopia" description="What needs you, and what's good to know." />
      <div className="container mx-auto max-w-2xl px-4 pt-6">
        <div className="flex items-center justify-between gap-2 pb-4">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">Your inbox</p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05] flex items-center gap-3">
              <Bell className="h-7 w-7 text-[hsl(var(--energy))]" />
              Inbox
            </h1>
            <p className="text-sm text-muted-foreground">Two lanes — what needs you, and what's good to know.</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5 shrink-0">
              <CheckCheck className="h-4 w-4" />
              Mark read
            </Button>
          )}
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent mb-5" />

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Inbox sections"
          className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card/80 backdrop-blur-sm mb-5"
        >
          <button
            role="tab"
            aria-selected={tab === "needs"}
            onClick={() => setTab("needs")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
              tab === "needs"
                ? "bg-background text-[hsl(var(--energy))] shadow-sm ring-1 ring-[hsl(var(--energy))]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Needs you
            {needsYouCount > 0 && (
              <Badge className="h-4 px-1.5 text-[10px] bg-[hsl(var(--energy))] text-background">
                {needsYouCount}
              </Badge>
            )}
          </button>
          <button
            role="tab"
            aria-selected={tab === "fyi"}
            onClick={() => setTab("fyi")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
              tab === "fyi"
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            FYI
            {fyi.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{fyi.length}</Badge>
            )}
          </button>
        </div>

        {/* Hot leads + Approvals — always at top of Needs You */}
        {tab === "needs" && (
          <>
            <HotLeadsStrip />
            <div className="mb-5">
              <ApprovalsHub limit={6} />
            </div>
          </>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border/60 mb-4">
              <InboxIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold tracking-tight mb-1">
              {tab === "needs" ? "You're clear" : "Nothing to catch up on"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {tab === "needs"
                ? "No replies owed, no approvals waiting. Go make something."
                : "Likes, views, and updates will show up here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((n: any, i: number) => (
              <div key={n.id}>
                <div
                  className={cn(
                    "group relative rounded-xl border p-4 transition-colors cursor-pointer",
                    n.read
                      ? "bg-card/50 border-border/60 hover:bg-muted/40"
                      : "bg-card border-[hsl(var(--energy)/0.35)] hover:bg-muted/20"
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{n.title}</h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {n.priority === "high" && (
                            <Badge variant="destructive" className="text-[10px] h-5">Urgent</Badge>
                          )}
                          {!n.read && <div className="h-2 w-2 rounded-full bg-[hsl(var(--energy))]" />}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{n.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                        {n.action_url && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => {
                            e.stopPropagation();
                            if (!n.read) markAsRead(n.id);
                            navigate(n.action_url);
                          }}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {n.action_text || "Open"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(n.id);
                        }}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                {i < list.length - 1 && <Separator className="my-1" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
