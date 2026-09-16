import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { PushNotificationsInfo } from "@/components/profile/PushNotificationsInfo";

export function NotificationSettings() {
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <BellOff className="w-5 h-5" />
            <p className="text-sm">Push notifications are not supported on this device. Try Chrome, Edge, or install the app to your home screen on iOS/Android.</p>
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
