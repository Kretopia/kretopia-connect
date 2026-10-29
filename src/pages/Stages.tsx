import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType, type LazyExoticComponent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { InviteDialog } from "@/components/InviteDialog";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { LiveCallsPanel } from "@/components/circle/LiveCallsPanel";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { SOUNDSTAGES_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { PageTransition } from "@/components/PageTransition";
import { ProfileActivationGate } from "@/components/ProfileActivationGate";
import { SEO } from "@/components/SEO";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getDiscoveryMissingFields } from "@/lib/profileCompletion";
import { legacyTabTarget, stagesViewFor, type StagesView } from "@/lib/stagesRoutes";

// The other views were pages of their own. They stay the same components, now mounted inside this one surface.
const CuratedStage = lazy(() => import("./CuratedStage"));
const SpeedIndex = lazy(() => import("./SpeedIndex"));
const SpeedSession = lazy(() => import("./SpeedSession"));
const SpeedRecap = lazy(() => import("./SpeedRecap"));
const EventBackstage = lazy(() => import("./EventBackstage"));

const VIEWS: Record<Exclude<StagesView, "sound">, LazyExoticComponent<ComponentType<{ embedded?: boolean }>>> = {
  curated: CuratedStage,
  speed: SpeedIndex,
  "speed-session": SpeedSession,
  "speed-recap": SpeedRecap,
  backstage: EventBackstage,
};

/**
 * Stages: the one surface for live rooms. Sound Stages is the default view; curated stages, the speed nights and the
 * event backstage are views of this same component, chosen by `view` or, when it is not given, by the URL. There are
 * no tabs: Match, Browse and the accepted-connections list live on /match, and the old /circle?tab= links lead there.
 */
export default function Stages({ view }: { view?: StagesView }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [searchParams] = useSearchParams();
  const [showInvite, setShowInvite] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<{ isVisible: boolean; missingFields: string[] }>({ isVisible: true, missingFields: [] });

  const active = view ?? stagesViewFor(pathname);
  const legacy = active === "sound" ? legacyTabTarget(search) : null;

  const refreshProfileVisibility = useCallback(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("avatar_url, bio")
      .eq("user_id", user.id)
      .single()
      .then(async ({ data: profile }) => {
        if (!profile) return;
        const { count } = await supabase.from("credits").select("id", { count: "exact", head: true }).eq("user_id", user.id);
        const missingFields = getDiscoveryMissingFields(profile as never, count || 0);
        setProfileVisibility({ isVisible: missingFields.length === 0, missingFields });
      }, () => {});
  }, [user?.id]);

  useEffect(() => {
    if (active !== "sound") return;
    refreshProfileVisibility();
    window.addEventListener("focus", refreshProfileVisibility);
    window.addEventListener("kretopia:profile-updated", refreshProfileVisibility);
    return () => {
      window.removeEventListener("focus", refreshProfileVisibility);
      window.removeEventListener("kretopia:profile-updated", refreshProfileVisibility);
    };
  }, [active, refreshProfileVisibility]);

  if (legacy) return <Navigate to={legacy} replace />;

  const Embedded = active === "sound" ? null : VIEWS[active];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background accent-match">
        {active === "sound" && (
          <SEO
            title="Stages — Where creators meet, live | Kretopia"
            description="Join creative sessions, discover people you can work with, and grow meaningful professional connections."
          />
        )}

        <FeaturePageHeader
          scene="coworking"
          eyebrow="Stages"
          title="Stages."
          accentTitle="Where creators meet, live."
          subtitle="Join creative sessions, discover people you can work with, and grow meaningful professional connections."
          tutorial={{ featureKey: "stages", label: "How this works", steps: SOUNDSTAGES_TUTORIAL }}
          compact={active !== "sound"}
        />

        <StudioFeatureShell wrapped={{ name: "Stages" }}>
          {Embedded ? (
            <Suspense fallback={<div className="flex justify-center py-16"><KretopiaLoader label="Loading" size="sm" /></div>}>
              <Embedded embedded />
            </Suspense>
          ) : (
            <>
              <ProfileActivationGate
                isVisible={profileVisibility.isVisible}
                missingFields={profileVisibility.missingFields}
                surfaceLabel="Stage"
              >
                {user ? (
                  <LiveCallsPanel joinStageId={searchParams.get("join")} onFindCollaborator={() => navigate("/match")} />
                ) : (
                  <AuthGate>
                    <div className="h-[40vh] bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl" />
                  </AuthGate>
                )}
              </ProfileActivationGate>

              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="btn-glass btn-glass-outline w-full text-left rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[hsl(var(--energy))]/15 text-[hsl(var(--energy))] flex items-center justify-center shrink-0">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--energy))]">Kreto-powered</p>
                    <p className="font-semibold text-sm">Grow your circle</p>
                    <p className="text-xs text-muted-foreground">Kreto drafts the invite and picks who's worth reaching out to first.</p>
                  </div>
                </div>
              </button>
            </>
          )}
        </StudioFeatureShell>

        <InviteDialog open={showInvite} onOpenChange={setShowInvite} />
      </div>
    </PageTransition>
  );
}
