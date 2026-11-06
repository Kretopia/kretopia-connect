import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { useAuth } from "@/hooks/useAuth";
import { describeTestPush, sendTestPush, type TestPushMessage } from "@/lib/pushTest";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff } from "lucide-react";
import { Link } from "react-router-dom";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { describePushAvailability } from "@/lib/pushSubscription";
import { PushNotificationsInfo } from "@/components/profile/PushNotificationsInfo";

/**
 * Send yourself a test: the way to see, on a real phone, that notifications arrive. It goes to every device where this account has
 * notifications on, so it can be pressed from a laptop while the phone is locked on the table.
 */
function PushTestPanel() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [message, setMessage] = useState<TestPushMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = async () => {
    if (!user?.id) return;
    setSending(true);
    setMessage(null);
    try {
      setMessage(describeTestPush(await sendTestPush(user.id)));
    } finally {
      setSending(false);
      // A short pause, so a second tap cannot stack tests; the next one replaces the first on the device anyway.
      setCooling(true);
      timer.current = setTimeout(() => setCooling(false), 15_000);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={run} disabled={!user?.id || sending || cooling}>
          {sending && <KretopiaSpinner className="mr-2 h-4 w-4" />}
          Send a test notification
        </Button>
        <p className="text-xs text-muted-foreground">
          Goes to every device of yours with notifications on. To test the lock screen, lock your phone first and press this from another device.
        </p>
      </div>
      {message && (
        <p
          role="status"
          className={cn(
            "mt-3 text-sm",
            message.tone === "ok" && "text-foreground",
            message.tone === "warn" && "text-muted-foreground",
            message.tone === "error" && "text-destructive",
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

export function NotificationSettings() {
  const { availability, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  // Say why notifications cannot be turned on here (not installed, blocked, not set up) instead of one vague "not supported".
  if (availability !== "ready") {
    const { title, description } = describePushAvailability(availability);
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-start gap-3 text-muted-foreground">
            <BellOff className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="text-sm">{description}</p>
              {(availability === "install" || availability === "ios-install") && (
                <Link to="/install" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
                  How to install the app
                </Link>
              )}
            </div>
          </div>
        </Card>
        <PushNotificationsInfo />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5" />
            <div>
              <Label htmlFor="push-notifications" className="text-base font-medium">
                Push Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified about matches, messages, and opportunities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="push-notifications"
              checked={isSubscribed}
              onCheckedChange={(checked) => {
                if (checked) subscribe();
                else unsubscribe();
              }}
              disabled={loading}
            />
          </div>
        </div>
        <PushTestPanel />
      </Card>

      <PushNotificationsInfo />
    </div>
  );
}
