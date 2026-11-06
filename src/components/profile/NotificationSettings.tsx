import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff } from "lucide-react";
import { Link } from "react-router-dom";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { describePushAvailability } from "@/lib/pushSubscription";
import { PushNotificationsInfo } from "@/components/profile/PushNotificationsInfo";

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
      </Card>

      <PushNotificationsInfo />
    </div>
  );
}
