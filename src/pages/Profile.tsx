import { useState, useRef, useEffect } from "react";
import { PageTip } from "@/components/PageTip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { updateOwnProfile } from "@/lib/ownProfileWrite";
import { planProfileImport } from "@/lib/importMerge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useRestoreReturnScroll } from "@/hooks/usePassportReturn";
import jsPDF from 'jspdf';
import { SkeletonProfile } from "@/components/ui/skeleton-card";
import { PageTransition } from "@/components/PageTransition";

// Context & Hooks
import { ProfileProvider, useProfileContext } from "@/contexts/ProfileContext";
import { useProfileData } from "@/hooks/useProfileData";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";

// Components
import { PublicPassportView } from "@/components/passport/PublicPassportView";
import { PressLinksSection } from "@/components/profile/PressLinksSection";
import { SocialStatsInline } from "@/components/profile/SocialStatsInline";
import type { PublicPassportOwner } from "@/components/passport/PublicPassportHero";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { FinishProfileBanner } from "@/components/profile/FinishProfileBanner";
import { useOnboarding } from "@/hooks/useOnboarding";
import { PASSPORT_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { FeatureTutorialDialogContent } from "@/components/features/FeatureTutorialDialogContent";
import { PassportWelcomeCard } from "@/components/passport/PassportWelcomeCard";
import { CompanyProfileView } from "@/components/profile/CompanyProfileView";
import { CompanyProfileEditDialog } from "@/components/profile/CompanyProfileEditDialog";
import { ShareProfileDialog } from "@/components/profile/ShareProfileDialog";
import { ProfileDashboardDrawer } from "@/components/profile/ProfileDashboardDrawer";


// Refactored sections
import { ProfileDialogs } from "@/pages/profile/ProfileDialogs";
import { InviteCircleCard } from "@/components/InviteCircleCard";
import { ClaimContinueBanner } from "@/components/profile/ClaimContinueBanner";
import { ScoutDiscoveryBanner } from "@/components/profile/ScoutDiscoveryBanner";
import { DiscoveriesInbox } from "@/components/profile/DiscoveriesInbox";
import { ClaimedProfileGlow } from "@/components/onboarding/claim-flow/ClaimedProfileGlow";
import { ProfileCompletionProgress } from "@/components/profile/ProfileCompletionProgress";
import { ProfileStrengthBar } from "@/components/profile/ProfileStrengthBar";
import { checkProfileCompletion } from "@/lib/profileCompletion";
import { PassportAnchorStrip } from "@/components/passport/PassportAnchorStrip";
import { PassportKretoEntry } from "@/components/passport/PassportKretoEntry";
import { EPKPdfEditor } from "@/components/epk/EPKPdfEditor";
import { PassportOriginalEPK } from "@/components/epk/PassportOriginalEPK";
import { PassportShareSheet } from "@/components/passport/PassportShareSheet";
import { PassportOverview } from "@/components/passport/PassportOverview";
import { PassportCollaborationCta } from "@/components/passport/PassportCollaborationCta";
import { KretoPassportBuilder } from "@/components/passport/KretoPassportBuilder";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { computeStanding } from "@/lib/passport/standing";
import { useTaggedCredits } from "@/hooks/useTaggedCredits";


import { getTierLimits, SubscriptionTier } from "@/lib/subscriptionLimits";

const ProfileContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    profile,
    portfolioItems,
    reviews,
    companyReviews,
    partnerDiscounts,
    industryStats,
    credits,
    awards,
    pressLinks,
    userBadge,
    stats,
    currentUserId,
    isLoading,
  } = useProfileContext();

  // A reload of the owner's own data (after a save, an import or a confirmed credit) reloads the shared Passport as well.
  const firstProfileLoad = useRef(true);
  useEffect(() => {
    if (firstProfileLoad.current) { firstProfileLoad.current = false; return; }
    setPassportRev((r) => r + 1);
  }, [profile, credits, awards, pressLinks]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const trackView = async () => {
      const { analytics } = await import("@/lib/analytics");
      analytics.pageView("profile");
    };
    trackView();
  }, []);

  const userTier: SubscriptionTier = (profile?.subscription_tier as SubscriptionTier) || "free";
  const hasAdvancedProfile = getTierLimits(userTier).hasAdvancedProfile;

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Bumped whenever the owner's data reloads, so the shared Passport document below reloads with it.
  const [passportRev, setPassportRev] = useState(0);
  const { isComplete: onboardingComplete, loading: onboardingLoading } = useOnboarding();
  const { fetchData } = useProfileData();
  const { uploadAvatar, isUploading: isUploadingAvatar } = useAvatarUpload();
  const { count: taggedCount } = useTaggedCredits(profile?.user_id);


  const [isEditOpen, setIsEditOpen] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [builderCredits, setBuilderCredits] = useState<{ project_name: string; role: string; year?: number | null }[] | null>(null);
  const [justRevealed, setJustRevealed] = useState<{ bioDrafted: boolean } | null>(null);
  // Arriving from the end of onboarding (see Onboarding.tsx): one congratulations, then the state is cleared so a refresh or a later
  // visit never shows it again.
  const [showWelcome, setShowWelcome] = useState(() => (location.state as { passportWelcome?: boolean } | null)?.passportWelcome === true);
  const [welcomeTourOpen, setWelcomeTourOpen] = useState(false);
  useEffect(() => {
    if ((location.state as { passportWelcome?: boolean } | null)?.passportWelcome) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Read once on mount: ClaimedProfileGlow also reads ?claimed=true and strips
  // it shortly after, but every component reading the un-stripped param on its
  // own first render still sees "true" regardless of strip order.
  const [searchParams] = useSearchParams();
  useRestoreReturnScroll();
  const [justClaimed] = useState(() => searchParams.get("claimed") === "true");
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isCreatorCardOpen, setIsCreatorCardOpen] = useState(false);
  const [isEPKEditorOpen, setIsEPKEditorOpen] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState("");

  const [editForm, setEditForm] = useState({
    full_name: "",
    role: "",
    bio: "",
    location: "",
    avatar_url: "",
    company_size: "",
    collab_intent: "seeking_collaborators",
    company_tagline: "",
    cover_image_url: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Applies Kreto's drafted bio/skills only after the user explicitly
  // confirms them in KretoPassportBuilder — never auto-published.
  const applyBuilderResult = async ({ bio, skills }: { bio: string | null; skills: string[] }) => {
    if (!profile?.user_id) { setBuilderCredits(null); return; }
    const existingSkills: string[] = Array.isArray(profile.professional_skills)
      ? (profile.professional_skills as any[]).map((s) => (typeof s === "string" ? s : s?.skill)).filter(Boolean)
      : [];
    const mergedSkills = Array.from(new Set([...existingSkills, ...skills]));
    const update: Record<string, any> = {};
    if (bio) update.bio = bio;
    if (skills.length > 0) update.professional_skills = mergedSkills;
    if (Object.keys(update).length > 0) {
      const saved = await updateOwnProfile(profile.user_id, update);
      if (!saved.ok) {
        toast({ title: "Couldn't save Passport", description: saved.message, variant: "destructive" });
      } else {
        fetchData();
        const { analytics } = await import("@/lib/analytics");
        analytics.passportRevealed(!!bio);
        setJustRevealed({ bioDrafted: !!bio });
      }
    }
    setBuilderCredits(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share") === "true" && profile) {
      setIsCreatorCardOpen(true);
      window.history.replaceState({}, "", "/profile");
    }
  }, [profile]);

  // "Edit" links from Credits, the starter checklist and claim nudges arrive as /profile/edit (-> ?edit=true) and open
  // the same edit dialog the Passport's own Edit button opens. The query is read once the profile has loaded.
  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") !== "true") return;
    const company = profile.account_type === "company";
    setEditForm({
      full_name: (company && profile.company_name) || profile.full_name || "",
      role: (company && profile.company_industry) || profile.role || "",
      bio: (company && profile.company_about) || profile.bio || "",
      location: (company && profile.company_address) || profile.location || "",
      avatar_url: (company && profile.company_logo_url) || profile.avatar_url || "",
      company_size: profile.company_size || "",
      collab_intent: company ? "seeking_collaborators" : (profile as any).collab_intent || "seeking_collaborators",
      company_tagline: company ? profile.company_tagline || "" : "",
      cover_image_url: company ? profile.cover_image_url || "" : "",
    });
    setIsEditOpen(true);
    window.history.replaceState({}, "", "/profile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleShare = async () => {
    const { analytics } = await import("@/lib/analytics");
    analytics.featureUsed("profile_shared");
    setIsShareDialogOpen(true);
  };
  
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setTempImageUrl(imageUrl);
    setShowCropDialog(true);
    event.target.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const file = new File([croppedBlob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
    await uploadAvatar(file, editForm, setEditForm, fetchData);
    setShowCropDialog(false);
    setTempImageUrl("");
  };

  const handleImportData = async (data: any) => {
    if (!user) return;
    
    // An import fills what is empty and never replaces what the member already wrote. The values go into the edit form,
    // not the database: nothing is saved until the member presses Save.
    // A field counts as written when either the edit form or the saved profile holds text for it.
    const written = (field: string) => String((editForm as Record<string, unknown>)[field] ?? "").trim() || String((profile as Record<string, unknown> | null)?.[field] ?? "").trim();
    const current = Object.fromEntries(["full_name", "role", "bio", "location"].map((f) => [f, written(f)]));
    const { fill: updates, kept } = planProfileImport(current, data);
    const keptFields: string[] = kept;

    setEditForm(prev => ({ ...prev, ...updates }));

    let importedCount = 0;
    if (data.portfolio_items && data.portfolio_items.length > 0) {
      const portfolioInserts = data.portfolio_items
        .filter((item: any) => item.title && item.media_url)
        .map((item: any) => ({
          user_id: user.id,
          project_name: item.title,
          role: 'Creator',
          source: 'portfolio',
          description: item.description || null,
          primary_media_url: item.media_url,
          media_type: item.media_type || 'image',
          thumbnail_url: item.thumbnail_url || null,
          tags: item.tags || null,
          credit_category: 'imported',
          // Where it came from; the row's created_at is the import date. Imported items stay self-declared.
          source_url: typeof data.source_url === 'string' ? data.source_url : null,
        }));

      if (portfolioInserts.length > 0) {
        const { error: portfolioError, data: inserted } = await supabase
          .from('credits')
          .insert(portfolioInserts)
          .select('id');

        if (portfolioError) {
          console.error('Error importing portfolio items:', portfolioError);
        } else {
          importedCount = inserted?.length || 0;
        }
      }
    }

    if (data.skills && data.skills.length > 0) {
      const skillNames = data.skills.map((s: any) => typeof s === 'string' ? s : s.skill || s);
      const existingSkills = (profile?.professional_skills as any[]) || [];
      const existingNames = existingSkills.map((s: any) => typeof s === 'string' ? s : s.skill || s.name || '');
      const newSkills = skillNames.filter((s: string) => !existingNames.includes(s));
      
      if (newSkills.length > 0) {
        const mergedSkills = [
          ...existingSkills,
          ...newSkills.map((s: string) => ({ skill: s, level: 3, category: 'General' }))
        ];
        
        await supabase
          .from('profiles')
          .update({ professional_skills: mergedSkills as any })
          .eq('user_id', user.id);
      }
    }

    await fetchData();
    
    const parts = [];
    if (Object.keys(updates).length > 0) parts.push(`${Object.keys(updates).length} empty field(s) filled in the editor, not saved yet`);
    if (keptFields.length > 0) parts.push(`${keptFields.length} existing field(s) kept as you wrote them`);
    if (importedCount > 0) parts.push(`${importedCount} portfolio items added as self-declared`);
    if (data.skills?.length > 0) parts.push(`${data.skills.length} skills added`);
    
    toast({
      title: "Import Complete",
      description: parts.length > 0 ? parts.join(", ") + ". Review, then save your profile." : "No data to import.",
    });
  };

  const handleEditSave = async (directData?: Record<string, any>) => {
    if (!user) return;

    const formData = directData || editForm;
    const isCompany = profile?.account_type === 'company';
    
    let updateData = isCompany ? {
      company_name: formData.full_name,
      company_industry: formData.role,
      company_about: formData.bio,
      company_address: formData.location,
      company_size: formData.company_size,
      company_logo_url: formData.avatar_url || editForm.avatar_url,
      company_tagline: formData.company_tagline || null,
      cover_image_url: formData.cover_image_url || null,
      full_name: formData.full_name,
    } : {
      full_name: formData.full_name,
      role: formData.role,
      bio: formData.bio,
      location: formData.location,
      avatar_url: formData.avatar_url || editForm.avatar_url,
      collab_intent: formData.collab_intent,
    };

    if (isCompany && galleryFiles.length > 0) {
      const existingImages = (profile?.company_images as string[]) || [];

      // Was a sequential for...of, each file awaited one at a time --
      // uploads are independent storage round trips, no reason not to run
      // them concurrently. Same continue-on-error behavior preserved: a
      // failed upload is dropped (null), never blocks the others.
      const uploadResults = await Promise.all(
        galleryFiles.map(async (file) => {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-gallery-${Date.now()}-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if (uploadError) return null;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            return publicUrl;
          } catch (err) {
            console.error('Error uploading gallery image:', err);
            return null;
          }
        })
      );
      const newImageUrls = uploadResults.filter((url): url is string => url !== null);

      updateData = { ...updateData, company_images: [...existingImages, ...newImageUrls] as any } as any;
    }

    const saved = await updateOwnProfile(user.id, updateData as Record<string, unknown>);

    if (!saved.ok) {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
      return;
    }

    await fetchData();
    // Other surfaces read the account mode and profile from shared queries; refresh them from the saved row.
    void queryClient.invalidateQueries({ queryKey: ["account-tone", user.id] });
    setIsEditOpen(false);
    // Bump profile_update streak (fire-and-forget)
    supabase.rpc('bump_streak', { _streak_type: 'profile_update' }).then(() => {}, () => {});
    setGalleryFiles([]);
    setGalleryPreviews([]);
    
    const { analytics } = await import("@/lib/analytics");
    analytics.profileUpdate("profile_fields");
    
    toast({ title: "Success", description: "Profile updated successfully" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 md:pb-6 bg-background">
        <div className="container mx-auto px-3 sm:px-4 max-w-3xl">
          <SkeletonProfile />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Profile not found</p>
        </div>
      </div>
    );
  }

  // Company profile view
  if (profile.account_type === 'company') {
    return (
      <>
        <CompanyProfileView
          profile={profile}
          reviews={companyReviews}
          partnerDiscounts={partnerDiscounts}
          isOwnProfile={true}
          isPro={userTier === 'pro' || userTier === 'creator_pro' || userTier === 'founder'}
          onRefresh={fetchData}
          onEdit={() => {
            setEditForm({
              full_name: profile.company_name || profile.full_name || "",
              role: profile.company_industry || profile.role || "",
              bio: profile.company_about || profile.bio || "",
              location: profile.company_address || profile.location || "",
              avatar_url: profile.company_logo_url || profile.avatar_url || "",
              company_size: profile.company_size || "",
              collab_intent: "seeking_collaborators",
              company_tagline: profile.company_tagline || "",
              cover_image_url: profile.cover_image_url || "",
            });
            setIsEditOpen(true);
          }}
          onShare={handleShare}
        />
        <CompanyProfileEditDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          editForm={editForm}
          onFormChange={setEditForm}
          onSave={handleEditSave}
          onAvatarUpload={handleAvatarUpload}
          isUploadingAvatar={isUploadingAvatar}
          galleryPreviews={galleryPreviews}
          onGalleryChange={(e) => {
            const files = Array.from(e.target.files || []);
            setGalleryFiles(prev => [...prev, ...files]);
            files.forEach(f => {
              const reader = new FileReader();
              reader.onload = (ev) => setGalleryPreviews(prev => [...prev, ev.target?.result as string]);
              reader.readAsDataURL(f);
            });
          }}
          onRemoveGalleryImage={(index) => {
            setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
            setGalleryFiles(prev => prev.filter((_, i) => i !== index));
          }}
        />
        <ShareProfileDialog
          profile={{
            full_name: profile.company_name || profile.full_name || '',
            role: profile.company_industry || profile.role || '',
            bio: profile.company_about || profile.bio || '',
            user_id: profile.user_id,
            avatar_url: profile.company_logo_url || profile.avatar_url || '',
            location: profile.company_address || profile.location || '',
          }}
          portfolioItems={[]}
          open={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
        />
      </>
    );
  }

  // The owner's controls are drawn on the Passport card itself (the shared document owns the card; see PublicPassportOwner). What they
  // need comes from the owner's own data and handlers, which live here, so it is worked out here and handed to the document.
  const passportOwner: PublicPassportOwner | undefined = (() => {
    if (!profile?.user_id) return undefined;
    const verifiedCreditsList = credits?.filter((c: any) => c.verification_status === 'verified') || [];
    const verified = verifiedCreditsList.length;
    const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
    const recent90 = verifiedCreditsList.filter((c: any) => {
      const t = c.created_at ? new Date(c.created_at).getTime() : 0;
      return t > ninetyDaysAgo;
    }).length;
    const completion = checkProfileCompletion(profile, portfolioItems?.length || 0).percentage;
    const cosigns = reviews?.filter((r: any) => r.status === 'approved').length || 0;
    const lastCreditAt = verifiedCreditsList
      .map((c: any) => c.created_at)
      .filter(Boolean)
      .sort()
      .pop() as string | undefined;
    const lastActivityAt = lastCreditAt || (profile as any).updated_at || null;
    const standing = computeStanding({
      verifiedCredits: verified,
      recentCredits90d: recent90,
      cosignsReceived: cosigns,
      profileCompletionPct: completion,
      activeProjects90d: stats?.projects || 0,
      lastActivityAt,
      verificationScore: (profile as any).verification_score ?? 0,
      unclaimed: !(profile as any).user_id,
    });
    return {
      onEdit: () => {
        setEditForm({
          full_name: profile.full_name || "",
          role: profile.role || "",
          bio: profile.bio || "",
          location: profile.location || "",
          avatar_url: profile.avatar_url || "",
          company_size: profile.company_size || "",
          collab_intent: (profile as any).collab_intent || "seeking_collaborators",
          company_tagline: "",
          cover_image_url: "",
        });
        setIsEditOpen(true);
      },
      onShare: handleShare,
      onShowQR: () => setIsQRDialogOpen(true),
      onDownloadEPK: () => setIsEPKEditorOpen(true),
      onChangePhoto: () => fileInputRef.current?.click(),
      isUploadingAvatar,
      taggedCount,
      // The owner's band under the document: Kreto, the Passport intelligence and the press to confirm side by side. The reach sits
      // under Kreto's entry, the two shortest blocks sharing a column.
      privateBand: (
        <>
          <div className="space-y-6">
            <PassportKretoEntry />
            <div className="empty:hidden"><SocialStatsInline userId={profile.user_id} /></div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <PassportOverview
              embedded
              userId={profile.user_id}
              credits={credits || []}
              verified={verified}
              cosigns={cosigns}
              standing={standing}
              onReviewCredits={() => navigate('/credits')}
            />
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <PressLinksSection userId={profile.user_id} isOwnProfile onRefresh={() => setPassportRev((r) => r + 1)} />
          </div>
        </>
      ),
    };
  })();

  return (
    <div className="accent-passport min-h-screen pb-24 sm:pb-20 md:pb-6 bg-background">
      <ClaimedProfileGlow />
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      <div className="relative">

        <FeaturePageHeader
          eyebrow="Passport"
          title="Passport."
          accentTitle="Your work, verified."
          subtitle="Your identity, your strongest credits, and every co-sign — one card you actually control."
          tutorial={{ featureKey: "passport", label: "How Passport works", steps: PASSPORT_TUTORIAL }}
        />
      </div>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 max-w-3xl">
        {/* New members land here right after confirming their email. */}
        {!onboardingLoading && !onboardingComplete && <FinishProfileBanner />}

        {showWelcome && profile && (
          <PassportWelcomeCard
            firstName={(profile as { full_name?: string | null }).full_name?.split(" ")[0]}
            onTour={() => setWelcomeTourOpen(true)}
            onDismiss={() => setShowWelcome(false)}
          />
        )}
        <Dialog open={welcomeTourOpen} onOpenChange={setWelcomeTourOpen}>
          <FeatureTutorialDialogContent label="How Passport works" steps={PASSPORT_TUTORIAL} onDismiss={() => setWelcomeTourOpen(false)} />
        </Dialog>

        {/* Passport reveal — the reward moment right after Kreto builds the
            Passport. Uses the real Passport UI below it, doesn't replace it. */}
        {justRevealed && (
          <div className="mb-4 rounded-2xl border border-border bg-card p-5">
            <p className="text-lg font-semibold text-foreground">Your Creative Passport is ready.</p>
            {justRevealed.bioDrafted && (
              <p className="text-xs text-muted-foreground mt-1">
                Kreto drafted parts of this from your Creative Record — review it below.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                type="button"
                onClick={() => setJustRevealed(null)}
                size="sm"
              >
                Looks good
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsEditOpen(true); setJustRevealed(null); }}
                size="sm"
              >
                Edit Passport
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { navigate('/credits'); setJustRevealed(null); }}
                size="sm"
              >
                Review credit evidence
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsShareDialogOpen(true); setJustRevealed(null); }}
                size="sm"
              >
                Share Passport
              </Button>
            </div>
          </div>
        )}

        {/* Post-claim "we found X credits" nudge — was built, never mounted.
            Also now the "Your Passport is ready" prompt for the magic-link
            return trip (?claimed=true), since sessionStorage's claimInfo
            doesn't survive the link being opened on another device/tab. */}
        <ClaimContinueBanner onRefresh={fetchData} justClaimed={justClaimed} />
        <ScoutDiscoveryBanner show={justClaimed} />

        {/* Discovered credit candidates — the real Phase 3 confirm screen.
            Was built but never mounted; this is the actual entry point. */}
        {profile?.user_id && (
          <DiscoveriesInbox
            userId={profile.user_id}
            onApproved={fetchData}
            onBulkConfirmed={setBuilderCredits}
          />
        )}

        {/* Identity section — who you are */}
        <section id="identity" className="scroll-mt-20">

        {profile && <PassportOriginalEPK userId={profile.user_id} />}
        </section>
        {/* /Identity */}
      </div>


      {/* The Passport itself: the very document visitors see. The owner's controls are on its card, nowhere else. */}
      {profile?.user_id && <PublicPassportView userId={profile.user_id} embedded refreshKey={passportRev} owner={passportOwner} />}

      {/* Kreto builds the Passport — shown right after a batch credit confirm */}
      <Dialog open={!!builderCredits} onOpenChange={(open) => !open && setBuilderCredits(null)}>
        <DialogContent className="max-w-md">
          {builderCredits && (
            <KretoPassportBuilder
              role={profile?.role || undefined}
              existingBio={profile?.bio || undefined}
              confirmedCredits={builderCredits}
              onConfirm={applyBuilderResult}
              onCancel={() => setBuilderCredits(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* All Dialogs */}
      <ProfileDialogs
        profile={profile}
        portfolioItems={portfolioItems}
        isMessageDialogOpen={isMessageDialogOpen}
        setIsMessageDialogOpen={setIsMessageDialogOpen}
        isImportDialogOpen={isImportDialogOpen}
        setIsImportDialogOpen={setIsImportDialogOpen}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        isShareDialogOpen={isShareDialogOpen}
        setIsShareDialogOpen={setIsShareDialogOpen}
        isQRDialogOpen={isQRDialogOpen}
        setIsQRDialogOpen={setIsQRDialogOpen}
        isCreatorCardOpen={isCreatorCardOpen}
        setIsCreatorCardOpen={setIsCreatorCardOpen}
        showCropDialog={showCropDialog}
        setShowCropDialog={setShowCropDialog}
        tempImageUrl={tempImageUrl}
        setTempImageUrl={setTempImageUrl}
        onImportData={handleImportData}
        onCropComplete={handleCropComplete}
        isUploadingAvatar={isUploadingAvatar}
        onProfileUpdate={fetchData}
      />

      {/* EPK PDF Editor */}
      {profile && (
        <EPKPdfEditor
          open={isEPKEditorOpen}
          onClose={() => setIsEPKEditorOpen(false)}
          userId={profile.user_id}
          epkData={{
            profile: {
              full_name: profile.full_name,
              user_id: profile.user_id,
              role: profile.role,
              job_title: profile.job_title,
              bio: profile.bio,
              location: profile.location,
              avatar_url: profile.avatar_url,
              average_rating: profile.average_rating,
              total_reviews: profile.total_reviews,
              professional_skills: profile.professional_skills,
              passion_skills: profile.passion_skills,
              collab_intent: profile.collab_intent,
              rate_range: profile.rate_range,
              cover_image_url: profile.cover_image_url,
              verification_tier: profile.verification_tier,
              verification_status: profile.verification_status,
            },
            credits: (credits || []).map((c: any) => ({
              id: c.id,
              project_name: c.project_name,
              role: c.role,
              year: c.year,
              platform: c.platform,
              isVerified: c.verification_status === 'verified',
            })),
            awards: (awards || []).map((a: any) => ({
              title: a.title,
              organization: a.organization,
              year: a.year,
            })),
            pressLinks: (pressLinks || []).map((p: any) => ({
              title: p.title,
              publication: p.publication,
              url: p.url,
            })),
            industryStats: (industryStats || []).map((s: any) => ({
              title: s.title,
              value: s.value,
              issuer: s.issuer,
            })),
            reviews: (reviews || []).map((r: any) => ({
              reviewer_name: r.reviewer_name || 'Verified Client',
              rating: r.rating,
              review_text: r.review_text,
            })),
          }}
        />
      )}
    </div>
  );
};

export default function Profile() {
  return (
    <PageTransition>
      <ProfileProvider>
        <ProfileContent />
      </ProfileProvider>
    </PageTransition>
  );
}
