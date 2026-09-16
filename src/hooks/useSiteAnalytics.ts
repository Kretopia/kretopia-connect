import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const getDeviceType = (): string => {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
};

const getVisitorId = (): string => {
  let id = localStorage.getItem('_ti_vid');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('_ti_vid', id);
  }
  return id;
};

export const trackSiteView = async (userId: string) => {
  try {
    await supabase.from('site_analytics').insert({
      user_id: userId,
      visitor_id: getVisitorId(),
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      event_type: 'view',
      device_type: getDeviceType(),
    });
  } catch {
    // silent fail
  }
};

export const trackSiteClick = async (userId: string, target: string) => {
  try {
    await supabase.from('site_analytics').insert({
      user_id: userId,
      visitor_id: getVisitorId(),
      page_path: window.location.pathname,
      event_type: 'click',
      event_target: target,
      device_type: getDeviceType(),
    });
  } catch {
    // silent fail
  }
};

export const useSiteViewTracker = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;
    trackSiteView(userId);
  }, [userId]);
};
