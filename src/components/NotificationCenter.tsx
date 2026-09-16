import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, Check, CheckCheck, Trash2, ExternalLink, MessageCircle, ThumbsUp, X, Sparkles } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

export const NotificationCenter = ({ triggerClassName }: { triggerClassName?: string } = {}) => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification, vouchOnCredit } = useNotifications();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [vouchingId, setVouchingId] = useState<string | null>(null);
  // This quick panel shows only what still needs attention -- once
  // "Mark all read" (or reading them one by one) clears the unread set, they
  // disappear from here rather than lingering read-but-visible. Full history
  // stays on /notifications via "View all notifications" below.
  const unreadNotifications = notifications.filter((n) => !n.read);

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    // Prefer action_url (more specific) over link
    const destination = notification.action_url || notification.link;
    if (destination) {
      setIsOpen(false);
      setTimeout(() => navigate(destination), 100);
    }
  };

  const handleActionClick = (e: React.MouseEvent, notification: any) => {
    e.stopPropagation();
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      setIsOpen(false); // Close sheet before navigating
      setTimeout(() => navigate(notification.action_url), 100);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'normal': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

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

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative h-8 w-8 sm:h-10 sm:w-10", triggerClassName)} aria-label="Open notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            // Positioned inside the button's own edges (not overflowing past
            // them via negative insets) -- the shared .btn-glass button
            // styling clips overflow to contain its decorative sheen, which
            // was silently cutting off part of this badge when it extended
            // past the trigger's box, collapsing "1"/"9+" to an unreadable
            // sliver. min-w instead of a fixed w- so two-character "9+"
            // never gets squeezed narrower than its own text.
            <Badge
              variant="destructive"
              className="absolute top-0.5 right-0.5 min-w-[16px] h-4 flex items-center justify-center px-0.5 text-[9px] leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="text-left">
          <BrandLogo size="sm" showBeta />
          <SheetTitle className="font-serif text-2xl font-normal mt-1 flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 text-xs font-sans"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </SheetTitle>
          <SheetDescription>
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </SheetDescription>
          <Button variant="link" size="sm" className="w-fit p-0 h-auto text-xs" onClick={() => { setIsOpen(false); navigate("/notifications"); }}>
            View all notifications →
          </Button>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : unreadNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {notifications.length === 0 ? "No notifications yet" : "You're all caught up!"}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {notifications.length === 0
                  ? "We'll notify you when something important happens"
                  : "Nothing new to review right now."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {unreadNotifications.map((notification, index) => (
                <div key={notification.id}>
                  <div
                    className={`group relative rounded-lg p-4 transition-all cursor-pointer ${
                      notification.read 
                        ? 'bg-muted/30 hover:bg-muted/50' 
                        : 'bg-primary/5 hover:bg-primary/10 border border-primary/20'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">
                        {getCategoryIcon(notification.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{notification.title}</h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {notification.priority === 'high' && (
                              <Badge variant={getPriorityColor(notification.priority)} className="text-[10px] h-5">
                                High
                              </Badge>
                            )}
                            {!notification.read && (
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {notification.category === 'vouch_request' ? (
                              (() => {
                                const creditId = notification.action_url?.split('credit=')[1];
                                const acted = (notification as any)._vouchAction;
                                if (acted) {
                                  return (
                                    <Badge
                                      variant={acted === 'vouched' ? 'default' : 'secondary'}
                                      className="h-7 px-2 text-xs"
                                    >
                                      {acted === 'vouched' ? (
                                        <><Sparkles className="h-3 w-3 mr-1" /> Vouched</>
                                      ) : (
                                        <><X className="h-3 w-3 mr-1" /> Marked not yours</>
                                      )}
                                    </Badge>
                                  );
                                }
                                if (!creditId) return null;
                                const isLoading = vouchingId === notification.id;
                                return (
                                  <>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={isLoading}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setVouchingId(notification.id);
                                        await vouchOnCredit(notification.id, creditId, 'vouched');
                                        setVouchingId(null);
                                      }}
                                    >
                                      <ThumbsUp className="h-3 w-3 mr-1" />
                                      Yes, I worked on this
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={isLoading}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setVouchingId(notification.id);
                                        await vouchOnCredit(notification.id, creditId, 'rejected');
                                        setVouchingId(null);
                                      }}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Not me
                                    </Button>
                                  </>
                                );
                              })()
                            ) : (
                              <>
                                {notification.link && notification.link.includes('/profile/') && (
                                  <Button variant="outline" size="sm" className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!notification.read) markAsRead(notification.id);
                                      setIsOpen(false);
                                      setTimeout(() => navigate(notification.link!), 100);
                                    }}>
                                    View Profile
                                  </Button>
                                )}
                                {notification.action_url && notification.action_url.includes('/messages') && (
                                  <Button variant="default" size="sm" className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!notification.read) markAsRead(notification.id);
                                      setIsOpen(false);
                                      setTimeout(() => navigate(notification.action_url!), 100);
                                    }}>
                                    <MessageCircle className="h-3 w-3 mr-1" />
                                    Message
                                  </Button>
                                )}
                                {notification.link && notification.link === '/circle' &&
                                  !notification.action_url?.includes('/messages') && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!notification.read) markAsRead(notification.id);
                                        setIsOpen(false);
                                        setTimeout(() => navigate('/circle?tab=network'), 100);
                                      }}>
                                      View Connections
                                    </Button>
                                  )}
                                {notification.action_url && notification.action_url.includes('/desk/') && (
                                  <Button variant="default" size="sm" className="h-7 text-xs"
                                    onClick={(e) => handleActionClick(e, notification)}>
                                    {notification.action_url.includes('tab=messages') ? (
                                      <><MessageCircle className="h-3 w-3 mr-1" />{notification.action_text || 'View Messages'}</>
                                    ) : (
                                      <><ExternalLink className="h-3 w-3 mr-1" />{notification.action_text || 'Open Project'}</>
                                    )}
                                  </Button>
                                )}
                                {notification.action_url &&
                                  !notification.action_url.includes('/messages') &&
                                  !notification.action_url.includes('/circle') &&
                                  !notification.action_url.includes('/desk/') &&
                                  !(notification.link && notification.link.includes('/profile/') && notification.action_url.includes('/profile/')) && (
                                    <Button variant="default" size="sm" className="h-7 text-xs"
                                      onClick={(e) => handleActionClick(e, notification)}>
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      {notification.action_text || 'View'}
                                    </Button>
                                  )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            aria-label={`Mark "${notification.title}" as read`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          aria-label={`Delete notification: ${notification.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < unreadNotifications.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};