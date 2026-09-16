import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SwipeFiltersState, DEFAULT_SWIPE_FILTERS } from '@/components/circle/SwipeFilters';
import { locationMatchesFilter } from '@/lib/locationGroups';
import { buildMyMatchContext, computeMatchScore, extractSkillsArray, fetchPastCollaboratorIds, type MatchSignals } from '@/lib/matchScoring';

export interface SwipeProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  sub_roles?: string[] | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  level: number;
  professional_skills: any;
  passion_skills: any;
  badge: string | null;
  collab_intent: string | null;
  portfolio_count?: number;
  credits_count?: number;
  awards_count?: number;
  verification_tier?: string | null;
  instagram_followers?: number | null;
  youtube_subscribers?: number | null;
  tiktok_followers?: number | null;
  twitter_followers?: number | null;
  spotify_listeners?: number | null;
  xp?: number;
  is_claimed?: boolean;
  imported_from_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Why this profile ranked where it did — same-sector/city/past-collab/
   *  skill-overlap, computed once here so cards don't need to re-derive it. */
  _matchSignals?: MatchSignals;
}

export function useSwipeProfiles(currentUserId: string | undefined, filters: SwipeFiltersState = DEFAULT_SWIPE_FILTERS) {
  const [profiles, setProfiles] = useState<SwipeProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<SwipeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchProfiles = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get users already swiped on
      const { data: swipedData } = await supabase
        .from('swipes')
        .select('target_id')
        .eq('user_id', currentUserId)
        .eq('target_type', 'profile');

      const swipedIds = new Set(swipedData?.map(s => s.target_id) || []);

      // Step 1b: Get blocked users
      const { data: blockedData } = await supabase
        .from('user_blocks')
        .select('blocked_user_id')
        .eq('blocker_id', currentUserId);

      const { data: blockedByData } = await supabase
        .from('user_blocks')
        .select('blocker_id')
        .eq('blocked_user_id', currentUserId);

      const blockedIds = new Set([
        ...(blockedData?.map(b => b.blocked_user_id) || []),
        ...(blockedByData?.map(b => b.blocker_id) || [])
      ]);

      // Step 2: Get accepted connections
      const { data: connectionsOut } = await supabase
        .from('connections')
        .select('connected_user_id')
        .eq('user_id', currentUserId)
        .eq('status', 'accepted');

      const { data: connectionsIn } = await supabase
        .from('connections')
        .select('user_id')
        .eq('connected_user_id', currentUserId)
        .eq('status', 'accepted');

      const connectedIds = new Set([
        ...(connectionsOut?.map(c => c.connected_user_id) || []),
        ...(connectionsIn?.map(c => c.user_id) || [])
      ]);

      // Step 3: Fetch profiles
      const { data: fetchedProfiles, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id, user_id, full_name, role, sub_roles, bio, avatar_url, cover_image_url, location, level,
          professional_skills, passion_skills, badge, collab_intent,
          onboarding_completed, verification_tier,
          instagram_followers, youtube_subscribers, tiktok_followers,
          twitter_followers, spotify_listeners, xp, is_claimed, imported_from_url,
          latitude, longitude
        `)
        .neq('user_id', currentUserId)
        .not('avatar_url', 'is', null)
        .neq('avatar_url', '')
        .eq('onboarding_completed', true)
        .limit(200);

      if (profileError) throw profileError;

      // Step 4: Filter out swiped, connected, blocked. Deliberately NOT
      // filtering on bio length, portfolio/credits/awards count anymore --
      // "no artificial gating" is a hard product requirement (a brand new
      // user with zero credits must still be discoverable), those signals
      // now only affect ranking (see the tie-break score below), never
      // eligibility. What's left here is "is there anything real to show",
      // not "have they done enough to deserve visibility".
      let filtered = (fetchedProfiles || []).filter(p => {
        if (swipedIds.has(p.user_id)) return false;
        if (connectedIds.has(p.user_id)) return false;
        if (blockedIds.has(p.user_id)) return false;
        // Hide non-ODOS unclaimed profiles from discovery
        if (p.is_claimed === false && p.badge !== 'odos') return false;
        // Hide incomplete profiles
        if (!p.full_name || p.full_name === 'New User' || p.full_name === '') return false;
        // Was also excluding role === 'Creator' -- but that's the exact
        // default Onboarding.tsx silently assigns when a user leaves role
        // blank during manual setup (a deliberate friction-reducing
        // default, not a placeholder meaning "never really set up").
        // Directly contradicted this file's own "no artificial gating"
        // stance above: the one friction-reduction meant to get someone
        // through onboarding faster was also the one thing making them
        // invisible to everyone else's deck. Only a genuinely empty role
        // is excluded now.
        if (!p.role || p.role === '') return false;
        return true;
      });

      // Step 5: Portfolio/credits/awards counts — kept as a ranking
      // tie-break signal only (see scoreProfile below), not a filter.
      if (filtered.length > 0) {
        const userIds = filtered.map(p => p.user_id);
        const [portfolioResult, creditsResult, awardsResult] = await Promise.all([
          supabase.from('credits').select('user_id').in('user_id', userIds),
          supabase.from('credits').select('user_id').in('user_id', userIds),
          supabase.from('awards').select('user_id').in('user_id', userIds)
        ]);

        const portfolioCounts = new Map<string, number>();
        portfolioResult.data?.forEach(item => {
          portfolioCounts.set(item.user_id, (portfolioCounts.get(item.user_id) || 0) + 1);
        });
        const creditsCounts = new Map<string, number>();
        creditsResult.data?.forEach(item => {
          creditsCounts.set(item.user_id, (creditsCounts.get(item.user_id) || 0) + 1);
        });
        const awardsCounts = new Map<string, number>();
        awardsResult.data?.forEach(item => {
          awardsCounts.set(item.user_id, (awardsCounts.get(item.user_id) || 0) + 1);
        });

        filtered = filtered.map(p => ({
          ...p,
          portfolio_count: portfolioCounts.get(p.user_id) || 0,
          credits_count: creditsCounts.get(p.user_id) || 0,
          awards_count: awardsCounts.get(p.user_id) || 0
        }));
      }

      // Match scoring — sector > city > past collaboration > shared skills,
      // plus a random-noise term so the deck is never a flat, static
      // ranking. Same algorithm the grid (BrowseCreators) uses, via
      // src/lib/matchScoring.ts, so "who ranks where" agrees everywhere.
      const [{ data: meProfile }, pastCollabIds] = await Promise.all([
        supabase.from('profiles').select('role, sub_roles, location, professional_skills, passion_skills').eq('user_id', currentUserId).maybeSingle(),
        fetchPastCollaboratorIds(currentUserId),
      ]);

      const myContext = buildMyMatchContext(meProfile || {}, pastCollabIds);

      const scoreProfile = (p: typeof filtered[number]): { score: number; _matchSignals: MatchSignals } => {
        const { score, ...signals } = computeMatchScore(myContext, {
          userId: p.user_id,
          role: p.role,
          subRoles: p.sub_roles,
          location: p.location,
          skills: extractSkillsArray(p.professional_skills),
        });
        // Tie-break: a touch of social proof, capped so it never outranks
        // a real sector/city/collab/skills signal on its own.
        const socialProof = Math.min(((p as any).credits_count || 0) + ((p as any).portfolio_count || 0), 10);
        return { score: score + socialProof, _matchSignals: signals };
      };

      const scored = filtered.map(p => ({ ...p, ...scoreProfile(p) }));

      const cacheKey = `swipe_order_${currentUserId}`;
      const cachedOrder = sessionStorage.getItem(cacheKey);
      let ordered: typeof scored;

      if (cachedOrder) {
        try {
          const orderIds: string[] = JSON.parse(cachedOrder);
          const idSet = new Set(scored.map(p => p.user_id));
          const orderedFromCache = orderIds
            .filter(id => idSet.has(id))
            .map(id => scored.find(p => p.user_id === id)!);
          const newProfiles = scored.filter(p => !orderIds.includes(p.user_id));
          ordered = [...orderedFromCache, ...newProfiles.sort((a, b) => b.score - a.score)];
        } catch {
          ordered = scored.sort((a, b) => b.score - a.score);
        }
      } else {
        ordered = scored.sort((a, b) => b.score - a.score);
      }

      // Cache the order
      sessionStorage.setItem(cacheKey, JSON.stringify(ordered.map(p => p.user_id)));

      setAllProfiles(ordered);
      setHasFetched(true);
    } catch (err: any) {
      console.error('[useSwipeProfiles] Error:', err);
      setError(err.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Apply filters
  useEffect(() => {
    if (allProfiles.length === 0) {
      setProfiles([]);
      return;
    }

    let filtered = [...allProfiles];

    // Multi-role filter
    const roles = filters.roles || [];
    if (roles.length > 0) {
      filtered = filtered.filter(p =>
        roles.some(r => p.role?.toLowerCase() === r.toLowerCase())
      );
    } else if (filters.role && filters.role !== 'all') {
      // Legacy single role
      filtered = filtered.filter(p => p.role?.toLowerCase() === filters.role.toLowerCase());
    }

    // Location filter — cascading country/city
    if (filters.locationCountry && filters.locationCountry !== 'all') {
      filtered = filtered.filter(p =>
        locationMatchesFilter(p.location, filters.locationCountry, filters.locationCity)
      );
    } else if (filters.location && filters.location !== 'all') {
      // Legacy
      filtered = filtered.filter(p => locationMatchesFilter(p.location, filters.location));
    }

    // Near Me — sort by distance using user's coordinates
    if (filters.nearMe && filters.userLat != null && filters.userLon != null) {
      const userLat = filters.userLat;
      const userLon = filters.userLon;
      const toRad = (deg: number) => deg * Math.PI / 180;
      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // km
      };
      filtered = filtered
        .filter(p => p.latitude != null && p.longitude != null)
        .map(p => ({ ...p, _distance: haversine(userLat, userLon, p.latitude!, p.longitude!) }))
        .sort((a, b) => (a as any)._distance - (b as any)._distance);
    }

    // Collab intent
    if (filters.collabIntent !== 'all') {
      filtered = filtered.filter(p => p.collab_intent === filters.collabIntent);
    }

    // Verified only (Pro)
    if (filters.verifiedOnly) {
      filtered = filtered.filter(p =>
        p.verification_tier === 'elite' || p.verification_tier === 'industry' || p.verification_tier === 'profile'
      );
    }

    // Skills
    if (filters.skills.length > 0) {
      filtered = filtered.filter(p => {
        const profileSkills = Array.isArray(p.professional_skills)
          ? p.professional_skills.map((s: any) => (typeof s === 'string' ? s : s?.skill || '').toLowerCase())
          : [];
        return filters.skills.some(skill => profileSkills.includes(skill.toLowerCase()));
      });
    }

    // Min followers (Pro)
    if (filters.minFollowers !== 'all') {
      const minCount = parseInt(filters.minFollowers);
      filtered = filtered.filter(p => {
        const total = (p.instagram_followers || 0) + (p.youtube_subscribers || 0) +
          (p.tiktok_followers || 0) + (p.twitter_followers || 0) + (p.spotify_listeners || 0);
        return total >= minCount;
      });
    }

    // Experience level (Pro)
    if (filters.experienceLevel !== 'all') {
      filtered = filtered.filter(p => {
        const level = p.level || 1;
        switch (filters.experienceLevel) {
          case 'beginner': return level <= 5;
          case 'intermediate': return level > 5 && level <= 15;
          case 'experienced': return level > 15 && level <= 30;
          case 'expert': return level > 30;
          default: return true;
        }
      });
    }

    // AI match (Pro)
    if (filters.aiMatchOnly) {
      filtered = filtered
        .filter(p => (p.xp || 0) > 100 || (p.level || 1) > 3)
        .sort((a, b) => ((b.xp || 0) + (b.level || 1) * 100) - ((a.xp || 0) + (a.level || 1) * 100));
    }

    setProfiles(filtered);
  }, [allProfiles, filters]);

  // Auto-fetch
  useEffect(() => {
    if (currentUserId && !hasFetched) {
      fetchProfiles();
    } else if (!currentUserId) {
      setLoading(false);
    }
  }, [currentUserId, hasFetched, fetchProfiles]);

  const removeProfile = useCallback((userId: string) => {
    setProfiles(prev => prev.filter(p => p.user_id !== userId));
    setAllProfiles(prev => {
      const updated = prev.filter(p => p.user_id !== userId);
      // Update cached order
      if (currentUserId) {
        sessionStorage.setItem(`swipe_order_${currentUserId}`, JSON.stringify(updated.map(p => p.user_id)));
      }
      return updated;
    });
  }, [currentUserId]);

  return {
    profiles,
    allProfilesCount: allProfiles.length,
    loading,
    error,
    fetchProfiles,
    removeProfile
  };
}
