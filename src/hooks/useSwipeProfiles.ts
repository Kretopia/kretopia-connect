import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SwipeFiltersState, DEFAULT_SWIPE_FILTERS } from '@/components/circle/SwipeFilters';
import { locationMatchesFilter } from '@/lib/locationGroups';
import { buildMyMatchContext, computeMatchScore, extractSkillsArray, fetchPastCollaboratorIds, type MatchSignals } from '@/lib/matchScoring';
import { interestTokens, isPositivelyRealMember, orderCandidates } from '@/lib/matchRanking';

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
  updated_at?: string | null;
  /** Why this profile ranked where it did — same-sector/city/past-collab/
   *  skill-overlap, computed once here so cards don't need to re-derive it. */
  _matchSignals?: MatchSignals;
}

/** Columns the cross-user safe view (public_profiles_safe) can supply. */
export const SAFE_VIEW_SELECT =
  'user_id, full_name, role, bio, avatar_url, cover_image_url, location, level, professional_skills, badge, onboarding_completed, verification_tier, xp, id_verified, updated_at';

/**
 * A row from public_profiles_safe as a deck candidate. The view does not carry
 * sub_roles, passions, collab intent, social counts, coordinates or claimed
 * state, so those are left empty rather than guessed; ranking and filters
 * treat "unknown" as "no signal", never as a mismatch.
 */
export function fromSafeRow(r: Record<string, any>): SwipeProfile {
  return {
    id: r.user_id,
    user_id: r.user_id,
    full_name: r.full_name ?? '',
    role: r.role ?? '',
    sub_roles: null,
    bio: r.bio ?? null,
    avatar_url: r.avatar_url ?? null,
    cover_image_url: r.cover_image_url ?? null,
    location: r.location ?? null,
    level: r.level ?? 1,
    professional_skills: r.professional_skills ?? null,
    passion_skills: null,
    badge: r.badge ?? null,
    collab_intent: null,
    verification_tier: r.verification_tier ?? null,
    xp: r.xp ?? 0,
    updated_at: r.updated_at ?? null,
  };
}

export function useSwipeProfiles(currentUserId: string | undefined, filters: SwipeFiltersState = DEFAULT_SWIPE_FILTERS) {
  const [profiles, setProfiles] = useState<SwipeProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<SwipeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const lastFetchedAt = useRef(0);

  // `silent` tops the deck up in the background: no spinner, no blank frame, and the
  // current order is kept (see the cached-order branch below).
  const fetchProfiles = useCallback(async (forceRescan = false, silent = false) => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
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

      // Step 3: Candidates, from two tiers.
      //  1. `profiles` directly: full detail (sub-roles, passions, intent,
      //     coordinates, claimed state), but RLS makes it owner-only apart from
      //     the viewer's own connections, so on its own it leaves the deck
      //     empty for almost everyone.
      //  2. `public_profiles_safe`: the sanctioned cross-user view every
      //     member can already read. Only rows it can vouch for as real
      //     members are used (see isPositivelyRealMember).
      // A member present in both keeps the richer tier-1 row. Who already
      // swiped right on you rides along: the "Interested" tab shows the same
      // people, so it exposes nothing new -- here it just ranks them first.
      const [rawRes, safeRes, likedYouRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            id, user_id, full_name, role, sub_roles, bio, avatar_url, cover_image_url, location, level,
            professional_skills, passion_skills, badge, collab_intent,
            onboarding_completed, verification_tier,
            instagram_followers, youtube_subscribers, tiktok_followers,
            twitter_followers, spotify_listeners, xp, is_claimed, imported_from_url,
            latitude, longitude, updated_at
          `)
          .neq('user_id', currentUserId)
          .eq('onboarding_completed', true)
          .limit(1000),
        supabase
          .from('public_profiles_safe')
          .select(SAFE_VIEW_SELECT)
          .neq('user_id', currentUserId)
          .eq('onboarding_completed', true)
          .limit(1000),
        supabase
          .from('swipes')
          .select('user_id')
          .eq('target_id', currentUserId)
          .eq('target_type', 'profile')
          .eq('direction', 'right'),
      ]);

      if (rawRes.error) console.warn('[useSwipeProfiles] profiles tier unavailable:', rawRes.error.message);
      if (safeRes.error) console.warn('[useSwipeProfiles] safe-view tier unavailable:', safeRes.error.message);
      // One tier failing is fine; only both failing is an error worth showing.
      if (rawRes.error && safeRes.error) throw rawRes.error;

      const merged = new Map<string, any>();
      ((safeRes.data as any[]) || []).filter(isPositivelyRealMember).forEach((r) => merged.set(r.user_id, fromSafeRow(r)));
      ((rawRes.data as any[]) || []).forEach((r) => merged.set(r.user_id, r));
      const fetchedProfiles = Array.from(merged.values());
      const likedYouIds = new Set<string>(((likedYouRes.data as any[]) || []).map((r) => r.user_id));

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
        supabase.from('profiles').select('role, sub_roles, location, professional_skills, passion_skills, bio').eq('user_id', currentUserId).maybeSingle(),
        fetchPastCollaboratorIds(currentUserId),
      ]);

      const myContext = buildMyMatchContext(meProfile || {}, pastCollabIds, currentUserId);
      const me = (meProfile || {}) as any;
      const myTokens = interestTokens(me.role, me.sub_roles, me.professional_skills, me.passion_skills, me.bio);

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
        // Shared interests, near or far: any overlapping word between roles,
        // skills, passions and bio counts, so every profile gets a chance.
        const theirs = interestTokens(p.role, p.sub_roles, p.professional_skills, p.passion_skills, p.bio);
        let shared = 0;
        theirs.forEach((t) => { if (myTokens.has(t)) shared++; });
        const interest = Math.min(shared * 4, 24);
        const hasPhoto = p.avatar_url ? 3 : 0;
        return { score: score + socialProof + interest + hasPhoto, _matchSignals: signals };
      };

      const scored = filtered.map(p => ({ ...p, ...scoreProfile(p) }));

      const cacheKey = `swipe_order_${currentUserId}`;
      if (forceRescan) sessionStorage.removeItem(cacheKey);
      const cachedOrder = sessionStorage.getItem(cacheKey);
      let ordered: typeof scored;

      if (cachedOrder) {
        try {
          const orderIds: string[] = JSON.parse(cachedOrder);
          const idSet = new Set(scored.map(p => p.user_id));
          const byId = new Map(scored.map(p => [p.user_id, p]));
          const orderedFromCache = orderIds.filter(id => idSet.has(id)).map(id => byId.get(id)!);
          const known = new Set(orderIds);
          const newProfiles = scored.filter(p => !known.has(p.user_id));
          // The deck keeps its order within a session, new arrivals are ranked
          // and appended, and anyone who has since swiped right on you moves up.
          const stable = [...orderedFromCache, ...orderCandidates(newProfiles, { likedYouIds })];
          ordered = [
            ...stable.filter(p => likedYouIds.has(p.user_id)),
            ...stable.filter(p => !likedYouIds.has(p.user_id)),
          ];
        } catch {
          ordered = orderCandidates(scored, { likedYouIds });
        }
      } else {
        ordered = orderCandidates(scored, { likedYouIds });
      }

      // Cache the order
      sessionStorage.setItem(cacheKey, JSON.stringify(ordered.map(p => p.user_id)));

      setAllProfiles(ordered);
      setHasFetched(true);
      lastFetchedAt.current = Date.now();
    } catch (err: any) {
      console.error('[useSwipeProfiles] Error:', err);
      // A failed background top-up must not replace a working deck with an error.
      if (!silent) setError(err.message || 'Failed to load profiles');
    } finally {
      if (!silent) setLoading(false);
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
    // Coordinates, intent and follower counts only exist on full `profiles` rows. When the
    // pool has none of them (safe-view tier only) these filters cannot apply, and applying
    // them anyway would empty the deck, so they step aside instead.
    const poolHasCoords = allProfiles.some(p => p.latitude != null && p.longitude != null);
    const poolHasIntent = allProfiles.some(p => !!p.collab_intent);
    const poolHasFollowers = allProfiles.some(p =>
      p.instagram_followers != null || p.youtube_subscribers != null || p.tiktok_followers != null ||
      p.twitter_followers != null || p.spotify_listeners != null);

    if (filters.nearMe && poolHasCoords && filters.userLat != null && filters.userLon != null) {
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
    if (filters.collabIntent !== 'all' && poolHasIntent) {
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
    if (filters.minFollowers !== 'all' && poolHasFollowers) {
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

  // Near-real-time without a socket: `profiles` is owner-only under RLS, so there is nothing
  // for Realtime to deliver. Instead the deck re-checks quietly when the tab comes back after
  // a minute away, and tops itself up when only a couple of cards are left.
  useEffect(() => {
    if (!currentUserId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && hasFetched && Date.now() - lastFetchedAt.current > 60_000) {
        void fetchProfiles(false, true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentUserId, hasFetched, fetchProfiles]);

  useEffect(() => {
    if (hasFetched && !loading && profiles.length <= 2 && Date.now() - lastFetchedAt.current > 30_000) {
      void fetchProfiles(false, true);
    }
  }, [hasFetched, loading, profiles.length, fetchProfiles]);

  // Match's Pulse "Scan now" asks every open deck to re-rank from scratch.
  useEffect(() => {
    const onScan = () => { void fetchProfiles(true); };
    window.addEventListener('match:scan', onScan);
    return () => window.removeEventListener('match:scan', onScan);
  }, [fetchProfiles]);

  useEffect(() => {
    if (!loading && hasFetched) {
      window.dispatchEvent(new CustomEvent('match:scanned', { detail: { count: allProfiles.length } }));
    }
  }, [loading, hasFetched, allProfiles.length]);

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
