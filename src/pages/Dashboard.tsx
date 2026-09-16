import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PageTransition } from "@/components/PageTransition";
import { ProfileProvider, useProfileContext } from "@/contexts/ProfileContext";
import { useProfileData } from "@/hooks/useProfileData";
import { SkeletonProfile } from "@/components/ui/skeleton-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  DollarSign,
  Edit,
  FileDown,
  Globe,
  QrCode,
  Share2,
  Sparkles,
  Inbox,
  Shield,
  Settings,
  IdCard,
} from "lucide-react";
import { useState } from "react";
import { SubscriptionTier } from "@/lib/subscriptionLimits";
import { ProfileStrengthScore, calculateProfileStrength } from "@/components/profile/ProfileStrengthScore";
import { ProfileVisibilityBanner } from "@/components/ProfileVisibilityBanner";
import { ProTrialBanner } from "@/components/profile/ProTrialBanner";
import { CreditScore } from "@/components/profile/CreditScore";
import { ThriveStatusCard } from "@/components/ThriveStatusCard";
import { calculateStatusFromCredits } from "@/lib/statusEngine";
import { TrustSignals } from "@/components/profile/TrustSignals";
import { CredentialVerificationCard } from "@/components/profile/CredentialVerificationCard";
import { WhoViewedProfile } from "@/components/profile/WhoViewedProfile";
import { SocialStatsSection } from "@/components/profile/SocialStatsSection";
import { DiscoveriesInbox } from "@/components/profile/DiscoveriesInbox";
import { ProfileCompletionProgress } from "@/components/profile/ProfileCompletionProgress";
import { RefreshUniverseButton } from "@/components/profile/RefreshUniverseButton";
import { checkProfileCompletion, getDiscoveryMissingFields } from "@/lib/profileCompletion";
import { ProfileEditDialog } from "@/components/profile/ProfileEditDialog";
import { ProfileQRDialog } from "@/components/profile/ProfileQRDialog";
import { EPKPdfEditor } from "@/components/epk/EPKPdfEditor";
import { ShareableCreatorCard } from "@/components/profile/ShareableCreatorCard";
import { ShareProfileDialog } from "@/components/profile/ShareProfileDialog";

/**
 * Dashboard — private "behind the scenes" hub for the owner.
 *
 * Houses everything the public Passport (/profile) should NOT show:
 *   • KrePay shortcut
 *   • Profile health (completion, strength, visibility)
 *   • Discoveries inbox (auto-found credits)
 *   • Trust & verification controls
 *   • Editing tools (Edit Passport, EPK, QR, Share card, Website)
 *   • Social stats refresh
 */
const DashboardContent = () => {
  const navigate = useNavigate();
  const {
    profile,
    portfolioItems,
    credits,
    awards,
    pressLinks,
    isLoading,
  } = useProfileContext();
  const { fetchData } = useProfileData();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isEPKOpen, setIsEPKOpen] = useState(false);
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 bg-background">
        <div className="container mx-auto max-w-3xl px-3 sm:px-4">
          <SkeletonProfile />
        </div>
      </div>
    );
  }
  if (!profile) return null;

  const userTier: SubscriptionTier = (profile?.subscription_tier as SubscriptionTier) || "free";
  const isPro = userTier === 'pro' || userTier === 'creator_pro' || userTier === 'founder';
  const completion = checkProfileCompletion(profile as any, (portfolioItems?.length || 0) + (credits?.length || 0));
  const missingFields = getDiscoveryMissingFields(profile as any, portfolioItems.length);
  const { score } = calculateProfileStrength(
    profile as any,
    portfolioItems.length,
    credits?.length || 0,
    awards?.length || 0,
    pressLinks?.length || 0,
  );

  const tools: { label: string; icon: typeof Edit; onClick: () => void; hint?: string }[] = [
    { label: "Edit Passport", icon: Edit, onClick: () => setIsEditOpen(true), hint: "Update your details" },
    { label: "EPK Export", icon: FileDown, onClick: () => setIsEPKOpen(true), hint: "Generate press kit PDF" },
    { label: "Share Card", icon: Share2, onClick: () => setIsCardOpen(true), hint: "Shareable creator card" },
    { label: "QR Code", icon: QrCode, onClick: () => setIsQROpen(true), hint: "Scan to view passport" },
    { label: "Share Passport", icon: IdCard, onClick: () => setIsShareOpen(true), hint: "Copy & share link" },
    ...(profile?.site_enabled
      ? [{ label: "My Website", icon: Globe, onClick: () => navigate('/website-builder'), hint: profile?.username ? `kretopia.com/${profile.username}` : 'Open builder' }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background pb-28">
      <SEO title="Dashboard · Kretopia" description="Your private dashboard — money, profile health, tools." />

      {/* Calm Scout-style header */}
      <header className="border-b border-border/60 bg-background pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto max-w-3xl px-4 pt-7 pb-4 sm:pt-9 sm:pb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--signal-teal))] mb-2">
            Dashboard
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-[1.05]">
            Behind the{" "}
            <span className="italic text-[hsl(var(--signal-teal))]">scenes</span>
            <span className="text-foreground/60">, just for you.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2.5 max-w-xl">
            Money, profile health, and the tools to keep your Passport sharp. Only you can see this.
          </p>
        </div>
      </header>

      <div className="container mx-auto max-w-3xl px-4 py-5 space-y-6">

        {/* Banners */}
        <ProTrialBanner
          subscriptionStatus={profile.subscription_status}
          subscriptionEndDate={profile.subscription_end_date}
          subscriptionTier={profile.subscription_tier}
        />
        <ProfileVisibilityBanner
          isVisible={missingFields.length === 0}
          missingFields={missingFields}
        />

        {/* MONEY */}
        <section className="space-y-2">
          <SectionLabel>Money</SectionLabel>
          <Card
            role="button"
            tabIndex={0}
            onClick={() => navigate('/thrivepay')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/thrivepay')}
            className="group p-4 cursor-pointer hover:border-[hsl(var(--signal-teal))]/40 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[hsl(var(--signal-teal))]/10 text-[hsl(var(--signal-teal))] flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">KrePay</p>
                <p className="text-xs text-muted-foreground mt-0.5">Invoices, wallet, earnings & receipts</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--signal-teal))] group-hover:translate-x-0.5 transition-all" />
            </div>
          </Card>
        </section>

        {/* PROFILE HEALTH */}
        <section className="space-y-3">
          <SectionLabel>Profile health</SectionLabel>

          {completion.percentage < 100 && (
            <ProfileCompletionProgress completion={completion} />
          )}

          {score < 100 && (
            <ProfileStrengthScore
              profile={profile as any}
              portfolioCount={portfolioItems.length}
              creditsCount={credits?.length || 0}
              awardsCount={awards?.length || 0}
              pressCount={pressLinks?.length || 0}
            />
          )}

          <RefreshUniverseButton lastScanAt={(profile as any)?.last_universe_scan_at} />

          {profile?.user_id && (
            <DiscoveriesInbox userId={profile.user_id} onApproved={fetchData} />
          )}
        </section>

        {/* TOOLS */}
        <section className="space-y-2">
          <SectionLabel>Tools</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {tools.map(({ label, icon: Icon, onClick, hint }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="btn-glass btn-glass-outline group flex items-start gap-2.5 rounded-xl p-3 text-left"
              >
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--energy))] mt-0.5 shrink-0 transition-colors" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">{label}</p>
                  {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* PROGRESSION */}
        <section className="space-y-2">
          <SectionLabel>Standing</SectionLabel>
          <ThriveStatusCard status={calculateStatusFromCredits(credits || [])} />
          {(credits?.length > 0 || awards?.length > 0) && (
            <CreditScore
              totalCredits={credits?.length || 0}
              verifiedCredits={credits?.filter((c: any) => c.verification_status === 'verified').length || 0}
              awardsCount={awards?.length || 0}
              portfolioCount={portfolioItems?.length || 0}
            />
          )}
        </section>

        {/* TRUST & VERIFICATION */}
        <section className="space-y-3">
          <SectionLabel>Trust & verification</SectionLabel>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
              <h3 className="text-sm font-semibold">Verification signals</h3>
            </div>
            <TrustSignals
              emailVerified={(profile as any).email_verified}
              phoneVerified={(profile as any).phone_verified}
              idVerified={(profile as any).id_verified}
              paymentVerified={(profile as any).payment_verified}
              isOwnProfile
            />
          </Card>

          <CredentialVerificationCard
            userId={profile.user_id}
            fullName={profile.full_name}
            role={profile.role || ''}
            bio={profile.bio || ''}
            socialLinks={{
              spotify: profile.spotify_url || '',
              youtube: profile.youtube_url || '',
              imdb: profile.imdb_url || '',
              instagram: profile.instagram_url || '',
              linkedin: profile.linkedin_url || '',
            }}
            currentTier={profile.verification_tier || undefined}
            currentAchievements={profile.achievement_badges || []}
            verifiedCredentials={(profile as any).verified_credentials || []}
            verificationScore={profile.verification_score || undefined}
            verifiedAt={profile.verified_at || undefined}
            breakdown={(profile as any).verification_breakdown || undefined}
            onVerificationComplete={() => fetchData()}
          />
        </section>

        {/* AUDIENCE */}
        <section className="space-y-3">
          <SectionLabel>Audience</SectionLabel>
          <WhoViewedProfile userId={profile.user_id} isPro={isPro} />
          <SocialStatsSection
            youtubeSubscribers={profile.youtube_subscribers}
            instagramFollowers={profile.instagram_followers}
            tiktokFollowers={profile.tiktok_followers}
            spotifyListeners={profile.spotify_listeners}
            twitterFollowers={profile.twitter_followers}
            linkedinConnections={profile.linkedin_connections}
            youtubeUrl={profile.youtube_url}
            instagramUrl={profile.instagram_url}
            tiktokUrl={profile.tiktok_url}
            spotifyUrl={profile.spotify_url}
            twitterUrl={profile.twitter_url}
            linkedinUrl={profile.linkedin_url}
            verifiedMetrics={profile.social_verified}
            isOwner
            onRefreshed={fetchData}
          />
        </section>

        {/* QUICK LINKS */}
        <section className="space-y-2">
          <SectionLabel>Shortcuts</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <ShortcutCard icon={Inbox} label="Inbox" onClick={() => navigate('/inbox')} />
            <ShortcutCard icon={Sparkles} label="Subscription" onClick={() => navigate('/subscription')} />
            <ShortcutCard icon={Settings} label="Settings" onClick={() => navigate('/settings')} />
            <ShortcutCard icon={IdCard} label="View Passport" onClick={() => navigate('/profile')} />
          </div>
        </section>
      </div>

      {/* Dialogs */}
      <ProfileEditDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        profile={profile}
        onProfileUpdate={() => { fetchData(); }}
      />
      <ProfileQRDialog
        open={isQROpen}
        onOpenChange={setIsQROpen}
        userId={profile.user_id}
        userName={profile.full_name || ''}
        userAvatar={profile.avatar_url || undefined}
      />
      <ShareableCreatorCard
        open={isCardOpen}
        onOpenChange={setIsCardOpen}
        profile={{
          full_name: profile.full_name || "",
          role: profile.role || "",
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          badge: profile.badge,
          level: profile.level,
          xp: profile.xp,
          location: profile.location,
          professional_skills: profile.professional_skills as Array<{ skill: string }> | null,
        }}
      />
      <ShareProfileDialog
        profile={{
          full_name: profile.full_name || '',
          role: profile.role || '',
          bio: profile.bio || '',
          user_id: profile.user_id,
          avatar_url: profile.avatar_url || '',
          verification_tier: profile.verification_tier || undefined,
          professional_skills: Array.isArray(profile.professional_skills) ? profile.professional_skills as string[] : [],
          location: profile.location || '',
        }}
        portfolioItems={portfolioItems.map((item: any) => ({
          id: item.id,
          thumbnail_url: item.thumbnail_url || undefined,
          media_url: item.media_url || undefined,
          title: item.title || undefined,
        }))}
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
      />
      {profile && (
        <EPKPdfEditor
          open={isEPKOpen}
          onClose={() => setIsEPKOpen(false)}
          userId={profile.user_id}
          epkData={{
            profile: {
              full_name: profile.full_name,
              role: profile.role,
              job_title: profile.job_title,
              bio: profile.bio,
              location: profile.location,
              avatar_url: profile.avatar_url,
              website: profile.website,
              calendly_url: profile.calendly_url,
              linkedin_url: profile.linkedin_url,
              instagram_url: profile.instagram_url,
              twitter_url: profile.twitter_url,
              youtube_url: profile.youtube_url,
              spotify_url: profile.spotify_url,
              behance_url: profile.behance_url,
              imdb_url: profile.imdb_url,
              soundcloud_url: profile.soundcloud_url,
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
            industryStats: [],
            reviews: [],
          }}
        />
      )}
    </div>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
    {children}
  </p>
);

const ShortcutCard = ({ icon: Icon, label, onClick }: { icon: typeof Inbox; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="btn-glass btn-glass-outline group flex items-center gap-2.5 rounded-xl p-3 text-left"
  >
    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--energy))] transition-colors" />
    <span className="text-xs font-semibold">{label}</span>
    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 ml-auto group-hover:text-[hsl(var(--energy))] group-hover:translate-x-0.5 transition-all" />
  </button>
);

export default function Dashboard() {
  return (
    <PageTransition>
      <ProfileProvider>
        <DashboardContent />
      </ProfileProvider>
    </PageTransition>
  );
}
