import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  describePushFailure,
  disablePush,
  enablePush,
  getPushAvailability,
  syncPushSubscription,
  type PushAvailability,
} from '@/lib/pushSubscription';

/**
 * Notifications for the signed-in member on this device. `isSubscribed` is true only when the browser holds a subscription and the
 * server stored it for this member (see lib/pushSubscription.ts): a toggle never says "on" for a device that would receive nothing.
 * `availability` says why notifications cannot be turned on here, when they cannot.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;
  const [availability, setAvailability] = useState<PushAvailability>(() => getPushAvailability());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setAvailability(getPushAvailability());
    if (!userId) {
      setIsSubscribed(false);
      setLoading(false);
      return;
    }
    try {
      const state = await syncPushSubscription(userId);
      // "unknown": the server could not be asked. Keep what is shown rather than claim a state nobody checked.
      if (state !== 'unknown') setIsSubscribed(state === 'on');
    } catch {
      // keep what is shown
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The push service replaced this device's subscription (see public/push-handlers.js): look again.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') void refresh();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [refresh]);

  const subscribe = async () => {
    if (!userId) {
      toast({ title: 'Sign in first', description: 'Notifications are tied to your account.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // enablePush asks for the permission before anything else, so this must be called straight from the tap.
      const result = await enablePush(userId);
      setAvailability(getPushAvailability());
      if (result.ok) {
        setIsSubscribed(true);
        toast({ title: 'Notifications enabled', description: "You'll be notified on this device." });
      } else {
        setIsSubscribed(false);
        const reason = result.reason ?? 'failed';
        toast({ ...describePushFailure(reason), variant: reason === 'dismissed' ? 'default' : 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (await disablePush(userId)) {
        setIsSubscribed(false);
        toast({ title: 'Notifications disabled', description: 'This device will no longer receive notifications.' });
      } else {
        toast({ title: 'Could not turn notifications off', description: 'Check your connection and try again.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return { isSupported: availability === 'ready', availability, isSubscribed, loading, subscribe, unsubscribe };
}
