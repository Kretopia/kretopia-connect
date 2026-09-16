import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

interface PushNotificationPromptProps {
  trigger?: "match" | "message" | "default";
  className?: string;
}

const DISMISS_KEY = "push_prompt_dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

const COPY: Record<string, { title: string; desc: string }> = {
  match: {
    title: "Don't miss new matches",
    desc: "Get notified when creators want to collaborate with you.",
  },
  message: {
    title: "Stay in the loop",
    desc: "Get notified when someone messages you so you never miss an opportunity.",
  },
  default: {
    title: "Enable notifications",
    desc: "Get notified about matches, messages, and gig opportunities.",
  },
};

export const PushNotificationPrompt = ({
  trigger = "default",
  className,
}: PushNotificationPromptProps) => {
  const { isSupported, isSubscribed, loading, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (Date.now() - ts < DISMISS_DURATION) return;
    }
    setDismissed(false);
  }, []);

  if (!isSupported || isSubscribed || dismissed || loading) return null;

  const { title, desc } = COPY[trigger] || COPY.default;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  const handleEnable = async () => {
    await subscribe();
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 animate-slide-up",
        className
      )}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-muted/80 transition-colors touch-manipulation"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-0.5">{title}</p>
          <p className="text-xs text-muted-foreground mb-3">{desc}</p>
          <Button size="sm" onClick={handleEnable} className="h-8 text-xs">
            Enable Notifications
          </Button>
        </div>
      </div>
    </div>
  );
};
