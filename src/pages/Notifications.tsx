import { SEO } from "@/components/SEO";
import { useNotifications } from "@/hooks/useNotifications";
import { useAccountTone } from "@/hooks/useAccountTone";
import { useTrinidadVoice } from "@/hooks/useTrinidadVoice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, Check, CheckCheck, Trash2, ExternalLink, MessageCircle, Loader2, Sparkles, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'match': return '';
    case 'message': return '';
    case 'project': return '';
    case 'opportunity': return '';
    case 'social': return '';
    case 'connection': return '';
    case 'reward': return '';
    default: return '';
  }
};

const Notifications = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { pick, isBusiness } = useAccountTone();
  const { pick: pickVoice } = useTrinidadVoice();
  const navigate = useNavigate();

  const handleClick = (notification: any) => {
    if (!notification.read) markAsRead(notification.id);
    const dest = notification.action_url || notification.link;
    if (dest) navigate(dest);
  };

  return (
    <div className="min-h-screen bg-background pb-20 accent-match">
      <SEO title="Inbox - Kretopia" description="Notifications and approvals in one place" />
      <div className="container mx-auto max-w-2xl px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold tracking-[0.22em] text-[hsl(var(--energy))] uppercase">Your inbox</p>
            {unreadCount > 0 && (
              <span className="inline-flex items-center gap-1.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm bg-[hsl(var(--energy)/0.15)] text-[hsl(var(--energy))] border-[hsl(var(--energy)/0.35)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--energy))]" />
                {unreadCount} unread
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-[1.05] flex items-center gap-3 mt-1">
            <Bell className="h-7 w-7 text-[hsl(var(--energy))]" />
            Inbox
          </h1>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-sm text-muted-foreground">Notifications and Kreto approvals — all in one place.</p>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5 shrink-0">
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-energy/10 border-2 border-energy/30 mb-5 shadow-glow-lime">
              <Bell className="h-10 w-10 text-energy" />
            </div>
            <p className="brand-eyebrow mb-2">All clear</p>
            <h3 className="text-xl font-black tracking-[-0.02em] mb-2">{pick(pickVoice("You're all caught up", "Yuh all caught up"), "You're all caught up")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
              {pick(
                pickVoice(
                  "When matches, messages, or new gigs land — they'll show up right here.",
                  "When matches, messages or new gigs drop, dey go show up right here.",
                ),
                "When applicants apply, talent replies, or invoices move — you'll see it here.",
              )}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                variant="lime"
                size="sm"
                className="gap-2 rounded-full"
                onClick={() => navigate(isBusiness ? "/talent-finder" : "/match")}
              >
                {isBusiness ? <Search className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {pick("Find a match", "Find talent")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => navigate(isBusiness ? "/gigs/new" : "/desk")}
              >
                {pick("Open Studios", "Post a gig")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification, index) => (
              <div key={notification.id}>
                <div
                  className={`group relative rounded-xl border p-4 transition-colors cursor-pointer ${
                    notification.read
                      ? 'bg-card/50 border-border/60 hover:bg-muted/40'
                      : 'bg-card border-[hsl(var(--energy)/0.35)] hover:bg-muted/20'
                  }`}
                  onClick={() => handleClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0 mt-0.5">
                      {getCategoryIcon(notification.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {notification.priority === 'high' && (
                            <Badge variant="destructive" className="text-[10px] h-5">Urgent</Badge>
                          )}
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-[hsl(var(--energy))]" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                        <div className="flex gap-1.5">
                          {notification.action_url && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => {
                              e.stopPropagation();
                              if (!notification.read) markAsRead(notification.id);
                              navigate(notification.action_url);
                            }}>
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {notification.action_text || "View"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.read && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                {index < notifications.length - 1 && <Separator className="my-1" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
