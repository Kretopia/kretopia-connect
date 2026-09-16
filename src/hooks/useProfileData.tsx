import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, type Profile } from "@/lib/profile/profileService";

export const useProfileData = () => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const {
    setProfile,
    setUserBadge,
    setStats,
    setPortfolioItems,
    setReviews,
    setIndustryStats,
    setCredits,
    setAwards,
    setPressLinks,
    setCompanyReviews,
    setPartnerDiscounts,
    setCurrentUserId,
    setIsLoading,
  } = useProfileContext();

  const fetchData = async (userId?: string) => {
    try {
      setIsLoading(true);
      
      // Get user only if not provided
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('[Profile] Error getting user:', userError);
          setIsLoading(false);
          return;
        }
        currentUserId = user.id;
      }
      
      setCurrentUserId(currentUserId);

      // Load core profile data first (fast). Profile is read through profileService,
      // which merges the normalized profile_* tables and falls back to legacy `profiles`.
      const [profileResult, connectionsResult, portfolioResult] = await Promise.all([
        getProfile(currentUserId).then(
          (data): { data: Profile | null; error: Error | null } => ({ data, error: null }),
          (error: unknown): { data: Profile | null; error: Error | null } => ({ data: null, error: error as Error }),
        ),
        supabase.from('connections').select('*', { count: 'exact', head: true }).eq('user_id', currentUserId).eq('status', 'accepted'),
        supabase.from('credits').select('*').eq('user_id', currentUserId).eq('source', 'portfolio').order('created_at', { ascending: false }).limit(6)
      ]);

      let { data, error } = profileResult;

      if (error) {
        console.error('[Profile] Error loading profile:', error);
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!data) {
        console.warn('[Profile] Profile row missing, attempting auto-provision for user:', currentUserId);

        const { data: authData } = await supabase.auth.getUser();
        const metadata = authData?.user?.user_metadata as Record<string, any> | undefined;
        const fallbackName = (metadata?.full_name || authData?.user?.email?.split('@')[0] || 'New User').trim();

        const { error: createError } = await supabase.from('profiles').upsert(
          {
            user_id: currentUserId,
            full_name: fallbackName || 'New User',
            role: 'Creator',
            onboarding_completed: false,
            is_claimed: true,
            account_type: metadata?.account_type === 'company' ? 'company' : 'individual',
          },
          { onConflict: 'user_id' }
        );

        if (createError) {
          console.error('[Profile] Failed to auto-provision profile:', createError);
          toast({
            title: 'Error',
            description: 'Profile not found. Please complete onboarding to create your profile.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        const createdProfile = await getProfile(currentUserId).catch((refetchError) => {
          console.error('[Profile] Profile still missing after auto-provision:', refetchError);
          return null;
        });

        if (!createdProfile) {
          toast({
            title: 'Error',
            description: 'Unable to load your profile right now.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        data = createdProfile;
      }

      setProfile({ ...data, section_order: data.section_order });
      setUserBadge(data.badge || null);
      
      // Track profile page view
      import("@/lib/analytics").then(({ analytics }) => {
        analytics.pageView("profile");
      });

      setStats(prev => ({
        ...prev,
        circle: connectionsResult.count || 0,
        projects: portfolioResult.data?.length || 0,
      }));
      setPortfolioItems(portfolioResult.data || []);

      // Also count credits for unified "Work" count (updated after background fetch)

      
      // Stop loading - show UI immediately
      setIsLoading(false);

      // Load remaining data in background (non-blocking) with individual error handling
      const backgroundPromises = [
        supabase.from('reviews').select('id, profile_id, reviewer_id, reviewer_name, reviewer_role, reviewer_company, reviewer_avatar_url, rating, review_text, project_name, collaboration_type, is_endorsed, is_verified, status, created_at, updated_at').eq('profile_id', currentUserId).order('created_at', { ascending: false }).limit(10),
        supabase.from('industry_stats').select('*').eq('user_id', currentUserId).order('display_order', { ascending: true }).limit(20),
        // Unbounded select on a table that legitimately grows with a
        // prolific creator's career -- capped generously (well above any
        // real user's credit count) rather than pagination-tight, purely
        // as a payload-size backstop, matching the .limit() every sibling
        // query in this same array already has.
        supabase.from('credits').select('*').eq('user_id', currentUserId).order('year', { ascending: false }).limit(500),
        supabase.from('awards').select('*').eq('user_id', currentUserId).order('year', { ascending: false }).limit(10),
        supabase.from('press_links').select('*').eq('user_id', currentUserId).order('published_date', { ascending: false }).limit(10)
      ];
      
      Promise.allSettled(backgroundPromises).then((results) => {
        const [reviewsResult, statsResult, creditsResult, awardsResult, pressResult] = results;
        if (reviewsResult.status === 'fulfilled') setReviews(reviewsResult.value.data || []);
        if (statsResult.status === 'fulfilled') setIndustryStats(statsResult.value.data || []);
        if (creditsResult.status === 'fulfilled') setCredits(creditsResult.value.data || []);
        if (awardsResult.status === 'fulfilled') setAwards(awardsResult.value.data || []);
        if (pressResult.status === 'fulfilled') setPressLinks(pressResult.value.data || []);

        // Auto-enrich profile ONLY for own profile, with a 24h cooldown
        const isOwnProfile = currentUserId === user?.id;
        const enrichCooldownKey = `enrich_last_${currentUserId}`;
        const lastEnrich = localStorage.getItem(enrichCooldownKey);
        const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
        const canEnrich = isOwnProfile && (!lastEnrich || Date.now() - parseInt(lastEnrich) > cooldownMs);

        if (canEnrich) {
          const pressData = pressResult.status === 'fulfilled' ? pressResult.value.data || [] : [];
          const awardsData = awardsResult.status === 'fulfilled' ? awardsResult.value.data || [] : [];
          const creditsData = creditsResult.status === 'fulfilled' ? creditsResult.value.data || [] : [];
          const needsEnrichment = 
            pressData.some((p: any) => !p.publication || !p.image_url) ||
            (awardsData.length === 0 && creditsData.length >= 3) ||
            !Array.isArray(data?.professional_skills) || (data.professional_skills as any[]).length === 0 ||
            !data?.job_title;
            
          if (needsEnrichment) {
            localStorage.setItem(enrichCooldownKey, Date.now().toString());
            supabase.functions.invoke('enrich-creator-profile', {
              body: { user_id: currentUserId, scrape_website: true, skip_credits: true },
            }).then(async () => {
              const [refreshedProfile, awardsRefresh, pressRefresh] = await Promise.all([
                getProfile(currentUserId!).catch(() => null),
                supabase.from('awards').select('*').eq('user_id', currentUserId!).order('year', { ascending: false }).limit(10),
                supabase.from('press_links').select('*').eq('user_id', currentUserId!).order('published_date', { ascending: false }).limit(10),
              ]);
              if (refreshedProfile) {
                setProfile({ ...refreshedProfile, section_order: refreshedProfile.section_order });
              }
              if (awardsRefresh.data) setAwards(awardsRefresh.data);
              if (pressRefresh.data) setPressLinks(pressRefresh.data);
            }).catch(() => {});
          }
        }
      });

      // Fetch company-specific data in background if needed
      if (data?.account_type === 'company') {
        Promise.all([
          supabase.from('company_reviews').select('*, reviewer:profiles!company_reviews_reviewer_id_fkey(full_name, avatar_url)')
            .eq('company_id', currentUserId).eq('status', 'published').order('created_at', { ascending: false }).limit(10),
          supabase.from('partner_discounts').select('*').eq('partner_name', data.company_name).eq('is_active', true)
        ]).then(([reviewsResult, discountsResult]) => {
          const companyReviewsData = reviewsResult.data?.map(review => ({
            ...review,
            reviewer_name: review.reviewer?.full_name || 'Anonymous',
            reviewer_avatar: review.reviewer?.avatar_url || '',
          })) || [];
          
          setCompanyReviews(companyReviewsData);
          setPartnerDiscounts(discountsResult.data || []);
        }).catch(err => console.error('[Profile] Error loading company data:', err));
      }
    } catch (error) {
      console.error('[Profile] Unexpected error:', error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    if (authLoading) {
      return () => {
        mounted = false;
      };
    }

    if (!user?.id) {
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (mounted) {
      fetchData(user.id);
    }

    // Set up lightweight real-time subscriptions - only for portfolio
    let updateTimeout: NodeJS.Timeout;
    
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        // Was unfiltered -- every open profile tab across the whole app
        // refetched on ANY user's credit insert, anywhere, not just the
        // viewer's own. Scoped to this user's own rows, same pattern
        // NotificationBell.tsx's channel already uses correctly.
        { event: 'INSERT', schema: 'public', table: 'credits', filter: `user_id=eq.${user.id}` },
        () => {
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(() => fetchData(), 2000);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearTimeout(updateTimeout);
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id]);

  return { fetchData };
};
