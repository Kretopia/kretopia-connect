import { supabase } from "@/integrations/supabase/client";

export interface ProfileViewStats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  trend: number;
}

/**
 * Track a profile view event
 */
export async function trackProfileView(
  profileUserId: string, 
  source: 'match' | 'public' | 'search' | 'message' | 'circle' = 'public'
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Don't track self-views
    if (user?.id === profileUserId) return;
    
    // Get session ID from sessionStorage or generate one
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    
    await supabase.from('analytics_events').insert({
      user_id: user?.id || null,
      session_id: sessionId,
      event_name: 'profile_viewed',
      event_category: 'profile',
      event_properties: { 
        profile_user_id: profileUserId, 
        source 
      },
      page_path: window.location.pathname,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Error tracking profile view:', error);
  }
}

/**
 * Fetch profile view statistics for a user
 */
export async function getProfileViewStats(userId: string): Promise<ProfileViewStats> {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    // Get total views
    const { count: totalViews } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'profile_viewed')
      .eq('event_properties->>profile_user_id', userId);
    
    // Get this week's views
    const { count: weekViews } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'profile_viewed')
      .eq('event_properties->>profile_user_id', userId)
      .gte('created_at', weekAgo.toISOString());
    
    // Get this month's views
    const { count: monthViews } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'profile_viewed')
      .eq('event_properties->>profile_user_id', userId)
      .gte('created_at', monthAgo.toISOString());
    
    // Get last week's views for trend calculation
    const { count: lastWeekViews } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'profile_viewed')
      .eq('event_properties->>profile_user_id', userId)
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString());
    
    // Calculate trend percentage
    const currentWeek = weekViews || 0;
    const previousWeek = lastWeekViews || 0;
    let trend = 0;
    if (previousWeek > 0) {
      trend = Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
    } else if (currentWeek > 0) {
      trend = 100; // Infinite growth from 0
    }
    
    return {
      total: totalViews || 0,
      thisWeek: weekViews || 0,
      thisMonth: monthViews || 0,
      trend
    };
  } catch (error) {
    console.error('Error fetching profile view stats:', error);
    return { total: 0, thisWeek: 0, thisMonth: 0, trend: 0 };
  }
}
