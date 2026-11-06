import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getPushAvailability, syncPushSubscription } from "@/lib/pushSubscription";

/**
 * Mounted once in the app shell. Whenever the app opens for a member who turned notifications on, this device's subscription is
 * checked against the server and registered again if the push service rotated it or the server dropped it. Without this, a
 * subscription replaced while the app was closed stayed unregistered until the member happened to open Settings.
 * It never asks for a permission and never subscribes a device the member did not enable themselves.
 */
export function usePushSubscriptionSync() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || getPushAvailability() !== "ready") return;
    let active = true;
    const run = () => {
      if (active) void syncPushSubscription(userId).catch(() => undefined);
    };
    run();

    // The worker re-subscribed on its own (public/push-handlers.js) and tells open windows, which hold the session it lacks.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") run();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [userId]);
}
