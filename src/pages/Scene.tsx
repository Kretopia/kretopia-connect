import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Flame, BookOpen, Headphones, Users, ArrowRight } from "lucide-react";
import Events from "./Events";

import { SparkWall } from "@/components/scene/SparkWall";
import { MagazineWall } from "@/components/scene/MagazineWall";
import { PodcastPlayer } from "@/components/scene/PodcastPlayer";
import { SceneHero } from "@/components/scene/SceneHero";
import { SceneContentPreviews } from "@/components/scene/SceneContentPreviews";
import { GetStartedChecklist } from "@/components/onboarding/GetStartedChecklist";
import { SmartNudgeBanner } from "@/components/notifications/SmartNudgeBanner";
import { ProfileVisibilityBanner } from "@/components/ProfileVisibilityBanner";
import { getDiscoveryMissingFields } from "@/lib/profileCompletion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTransition } from "@/components/PageTransition";
import { LiveActivityTicker } from "@/components/scene/LiveActivityTicker";
import { useTranslation } from "react-i18next";
import { useAccountTone } from "@/hooks/useAccountTone";
import { useTrinidadVoice } from "@/hooks/useTrinidadVoice";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";

const Scene = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { pick: pickTone } = useAccountTone();
  const { pick: pickVoice } = useTrinidadVoice();
  const isEventsRoute = location.pathname === "/events";
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam || (isEventsRoute ? "events" : "magazine"));
  const { user } = useAuth();
  const [visibility, setVisibility] = useState<{ isVisible: boolean; missingFields: string[] }>({ isVisible: true, missingFields: [] });

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const [profileRes, creditsRes, portfolioRes] = await Promise.all([
        supabase.from("profiles").select(PROFILE_SELECT).eq("user_id", user.id).single(),
        supabase.from("credits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("credits").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("source", "portfolio"),
      ]);
      if (profileRes.data) {
        const workCount = (creditsRes.count || 0) + (portfolioRes.count || 0);
        const missing = getDiscoveryMissingFields(profileRes.data as any, workCount);
        setVisibility({ isVisible: missing.length === 0, missingFields: missing });
      }
    };
    check();
  }, [user]);

  const handleNavigate = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  return (
    <PageTransition>
      <Helmet>
        <title>{t("scene.title")} | Kretopia</title>
        <meta name="description" content="Your creative community hub — browse events, discover work, and join conversations." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
          {user && <ProfileVisibilityBanner isVisible={visibility.isVisible} missingFields={visibility.missingFields} />}

          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3 border-b-2 border-primary/20 pb-3">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="brand-eyebrow">For you</p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] flex items-center gap-2 leading-[1.05]">
                <Flame className="h-6 w-6 text-energy shrink-0" />
                <span className="min-w-0 break-words">{t("scene.title")}</span>
              </h1>
              <p className="text-xs text-muted-foreground">{t("scene.subtitle")}</p>
            </div>
            
          </div>

          {/* Live Activity */}
          <LiveActivityTicker />

          {/* Hero Carousel */}
          <SceneHero onNavigate={handleNavigate} />

          {/* Match CTA */}
          {user && (
            <Link
              to="/circle"
              className="flex items-center gap-3 p-3 mb-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 hover:border-primary/40 transition-all group"
            >
              <div className="h-9 w-9 rounded-lg bg-energy/15 flex items-center justify-center shrink-0">
                <Users className="h-4.5 w-4.5 text-energy" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {pickTone(
                    pickVoice(t("scene.findMatch"), "Link up with creatives"),
                    "Find talent for your brief",
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {pickTone(
                    pickVoice(t("scene.findMatchDesc"), "See who movin' near you"),
                    "Browse vetted creatives by skill, location, and rate",
                  )}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-energy opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          )}

          {/* Content Previews */}
          {activeTab === "spark" && (
            <SceneContentPreviews onNavigate={handleNavigate} />
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-4 grid grid-cols-4 h-10 rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="spark" className="gap-1.5 text-[11px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-energy">
                <Flame className="h-3.5 w-3.5" />
                {t("scene.spark")}
              </TabsTrigger>
              <TabsTrigger value="magazine" className="gap-1.5 text-[11px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-energy">
                <BookOpen className="h-3.5 w-3.5" />
                {t("scene.magazine")}
              </TabsTrigger>
              <TabsTrigger value="podcast" className="gap-1.5 text-[11px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-energy">
                <Headphones className="h-3.5 w-3.5" />
                {t("scene.podcast")}
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-1.5 text-[11px] rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-energy">
                <CalendarDays className="h-3.5 w-3.5" />
                {t("scene.events")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="spark" className="mt-0">
              {user && <SmartNudgeBanner />}
              {user && <GetStartedChecklist />}
              <SparkWall />
            </TabsContent>

            <TabsContent value="magazine" className="mt-0">
              <MagazineWall />
            </TabsContent>

            <TabsContent value="podcast" className="mt-0">
              <PodcastPlayer />
            </TabsContent>

            <TabsContent value="events" className="mt-0">
              <Events embedded />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageTransition>
  );
};

export default Scene;
