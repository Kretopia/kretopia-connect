import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMyCredits } from "@/hooks/useMyCredits";
import { CreditsPermissionState } from "@/components/credits/CreditsPermissionState";
import { CreditsOverviewCard } from "@/components/credits/CreditsOverviewCard";
import { PersonalCreditsSearch } from "@/components/credits/PersonalCreditsSearch";
import { CreditsIdentityPanel, type IdentityProfile } from "@/components/credits/CreditsIdentityPanel";
import { CreditsStampsPanel } from "@/components/credits/CreditsStampsPanel";
import { CreditsHireMePanel, type HireMeProfile } from "@/components/credits/CreditsHireMePanel";
import { CreditsActivityTimeline } from "@/components/credits/CreditsActivityTimeline";
import { CreditsAIInsights } from "@/components/credits/CreditsAIInsights";
import { CreditsErrorState } from "@/components/credits/CreditsPrimitives";
import { AttachEvidenceDialog } from "@/components/credits/AttachEvidenceDialog";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { StudioSectionTabs, type StudioSectionTab } from "@/components/studio-reference/StudioSectionTabs";
import { User, Briefcase, Award, Activity, Sparkles as SparklesIcon } from "lucide-react";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";

type OwnProfile = IdentityProfile & HireMeProfile;

/**
 * /credits — the personal Credit Intelligence Dashboard.
 *
 * Everything on this page belongs to the signed-in person: their identity,
 * their stamps, their Hire Me profile, their activity and Kreto's review of
 * all of it. There is no public directory and no cross-user search here —
 * public discovery lives at /search.
 */
export default function CreditsDashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachFocusId, setAttachFocusId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setUserId(data?.user?.id ?? null))
      .catch(() => setUserId(null));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(rawQuery.trim()), 250);
    return () => window.clearTimeout(t);
  }, [rawQuery]);

  const loadProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "full_name, role, bio, avatar_url, location, is_discoverable, verification_score, icdb_creator_id, availability_status, availability_note, collab_intent, hourly_rate, project_rate, rate_currency, professional_skills, site_headline",
      )
      .eq("user_id", uid)
      .maybeSingle();
    if (error) {
      setProfileError(true);
      return;
    }
    setProfileError(false);
    if (!data) {
      setProfile(null);
      return;
    }
    // profiles has no `skills` column (CreditsHireMePanel's prop name, not a
    // real column -- confirmed via types.ts and a full migration grep,
    // exactly the same "column doesn't exist" failure as is_discoverable
    // above, just fixed in code instead of schema since the real data
    // already lives elsewhere under a different name/shape).
    // professional_skills is Json, either a string array or a keyed
    // object (matching src/lib/profileCompletion.ts's own handling of the
    // same field) -- normalize either shape to the flat string[] the panel
    // already renders.
    const { professional_skills, ...rest } = data as Record<string, unknown>;
    const skills = Array.isArray(professional_skills)
      ? professional_skills.filter((s): s is string => typeof s === "string")
      : professional_skills && typeof professional_skills === "object"
        ? Object.keys(professional_skills as Record<string, unknown>)
        : [];
    setProfile({ ...rest, skills } as unknown as OwnProfile);
  };

  useEffect(() => {
    if (!userId) return;
    loadProfile(userId).catch(() => setProfileError(true));
  }, [userId]);

  const { credits, overview, loading, searching, error, refresh } = useMyCredits(query);

  // A co-sign suggestion or "ask a collaborator" link arrives as /credits?action=co_sign. The place to ask is each
  // stamp's "Ask for a co-sign" in the Stamps section, so open the page there once the stamps have loaded.
  const [searchParams] = useSearchParams();
  const wantsCoSign = searchParams.get("action") === "co_sign";
  useEffect(() => {
    if (wantsCoSign && !loading) document.getElementById("stamps")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [wantsCoSign, loading]);

  const record = useMemo(() => {
    const checks = [
      Boolean(profile?.full_name),
      Boolean(profile?.role),
      Boolean(profile?.bio),
      Boolean(profile?.avatar_url),
      Boolean(profile?.availability_status || profile?.collab_intent),
      (overview?.total_credits ?? 0) > 0,
      (overview?.verified_credits ?? 0) > 0,
      (overview?.missing_evidence ?? 0) === 0,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
  }, [profile, overview]);

  const nextAction = useMemo(() => {
    if (!overview || overview.total_credits === 0)
      return { label: "Add your first credit", onClick: () => navigate("/profile?add=credit") };
    if (overview.missing_evidence > 0)
      return {
        label: `Attach evidence to ${overview.missing_evidence} credit${overview.missing_evidence > 1 ? "s" : ""}`,
        onClick: () => {
          setAttachFocusId(null);
          setAttachOpen(true);
        },
      };
    if (overview.pending_credits > 0)
      return {
        label: "Ask for a co-sign",
        onClick: () => document.getElementById("stamps")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      };
    if (!profile?.bio) return { label: "Write your bio", onClick: () => navigate("/profile/edit") };
    return null;
  }, [overview, profile, navigate]);

  if (userId === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <KretopiaSpinner className="h-6 w-6 text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (userId === null) return <CreditsPermissionState />;

  const identityErrorState = (
    <CreditsErrorState
      message="We couldn't load your identity details."
      onRetry={() => userId && loadProfile(userId)}
    />
  );

  const creditsTabs: StudioSectionTab[] = [
    {
      id: "identity",
      label: "Identity",
      icon: User,
      content: profileError ? identityErrorState : <CreditsIdentityPanel profile={profile} />,
    },
    {
      id: "hire-me",
      label: "Hire Me",
      icon: Briefcase,
      content: profileError ? identityErrorState : <CreditsHireMePanel profile={profile} />,
    },
    {
      id: "stamps",
      label: "Stamps",
      icon: Award,
      content: (
        <CreditsStampsPanel
          credits={credits}
          loading={loading}
          query={query}
          missingEvidenceCount={overview?.missing_evidence ?? 0}
          onAttachEvidence={(creditId) => {
            setAttachFocusId(creditId ?? null);
            setAttachOpen(true);
          }}
        />
      ),
    },
    { id: "activity", label: "Activity", icon: Activity, content: <CreditsActivityTimeline credits={credits} loading={loading} /> },
    {
      id: "insights",
      label: "Next Steps",
      icon: SparklesIcon,
      content: (
        <CreditsAIInsights
          userId={userId}
          onApplied={() => {
            loadProfile(userId).catch(() => setProfileError(true));
          }}
        />
      ),
    },
  ];

  return (
    <>
      <Helmet>
        <title>Credits — Your Verified Creative Record | Kretopia</title>
        <meta
          name="description"
          content="Your private Credits dashboard: identity, verified stamps, Hire Me profile, activity and what to do next."
        />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="accent-passport relative min-h-screen bg-background">
        <FeaturePageHeader
          scene="workspace"
          eyebrow="Credits"
          title="Credits."
          accentTitle="Your record, verified."
          subtitle="Your professional identity and the verified creative work behind it — in one private place."
        />

        <StudioFeatureShell className="relative" wrapped={{ name: "Credits" }}>
          {error === "auth" ? (
            <CreditsErrorState
              message="Your session expired. Sign in again to see your record."
              onRetry={() => navigate("/auth?redirect=/credits")}
            />
          ) : error === "network" ? (
            <CreditsErrorState message="We couldn't load your credits just now." onRetry={() => refresh()} />
          ) : (
            <div className="space-y-4">
              <CreditsOverviewCard
                overview={overview}
                completeness={record.percent}
                steps={{ done: record.done, total: record.total }}
                nextAction={nextAction}
                loading={loading}
              />

              <PersonalCreditsSearch
                value={rawQuery}
                onChange={setRawQuery}
                searching={searching}
                resultCount={credits.length}
              />

              <StudioSectionTabs queryParam="tab" defaultTabId="identity" tabs={creditsTabs} />
            </div>
          )}
        </StudioFeatureShell>

        <AttachEvidenceDialog
          open={attachOpen}
          onOpenChange={setAttachOpen}
          credits={credits.filter((c) => !c.url && !c.primary_media_url)}
          focusCreditId={attachFocusId}
          onAttached={() => refresh()}
        />
      </div>
    </>
  );
}
