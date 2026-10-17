/**
 * Spotlight — the hero stays the same cinematic plate every standalone page
 * uses (EditorialPageHero -> CinematicHeaderPlate, the same component
 * FeaturePageHeader wraps, confirmed identical to Studio's own top-level
 * hero in StudioCreateHero.tsx). The body below it, previously two
 * EditorialChapter sections (roman-numeral serif kickers, scroll-triggered
 * reveals — a landing-page convention, not one Studio Room's own body
 * content ever uses), is now Studio's plain flat-card grammar instead, per
 * product decision to prioritize Studio consistency over editorial framing
 * here. See STUDIO_REFERENCE_SURFACE_AUDIT.md.
 */
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { MagazineWall } from "@/components/scene/MagazineWall";
import { PodcastPlayer } from "@/components/scene/PodcastPlayer";
import { APP_URL } from "@/lib/constants";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { spotlightTutorial } from "@/components/features/publicFeatureTutorials";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { SpotlightBoard, type SpotlightTab } from "@/components/kretopia/SpotlightBoard";

const Spotlight = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SpotlightTab>(tabParam === "podcast" ? "podcast" : "magazine");
  const canonicalUrl = `${APP_URL}/spotlight`;

  return (
    <PageTransition>
      <Helmet>
        <title>Spotlight — Stories, Features & Sounds | Kretopia</title>
        <meta name="description" content="Creative stories, interviews, features and podcast episodes to inspire and motivate. Explore the Kretopia Spotlight." />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Spotlight — Stories, Features & Sounds | Kretopia" />
        <meta property="og:description" content="Creative stories, interviews, features and podcast episodes to inspire and motivate." />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Kretopia" />
        <meta property="og:image" content="https://www.kretopia.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Spotlight — Stories, Features & Sounds | Kretopia" />
        <meta name="twitter:description" content="Creative stories, interviews, features and podcast episodes to inspire and motivate." />
        <meta name="twitter:image" content="https://www.kretopia.com/og-image.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Kretopia Spotlight",
            "description": "Creative stories, interviews, features and podcast episodes to inspire and motivate.",
            "url": canonicalUrl,
            "publisher": {
              "@type": "Organization",
              "name": "Kretopia",
              "url": APP_URL,
            },
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <FeaturePageHeader
          compact
          eyebrow="Spotlight"
          tutorial={{ featureKey: "spotlight", label: "How Spotlight works", steps: spotlightTutorial }}
          title="Spotlight"
          accentTitle="Stories worth playing"
          subtitle="Interviews, features and podcast episodes from across the creative universe — the people behind the work, in their own words."
        />

        <StudioFeatureShell wrapped={{ name: "Spotlight" }}>
          <section aria-label="Spotlight stories and episodes">
            <SpotlightBoard
              value={activeTab}
              onValueChange={setActiveTab}
              magazine={<MagazineWall />}
              podcast={<PodcastPlayer />}
            />
          </section>

        </StudioFeatureShell>
      </div>
    </PageTransition>
  );
};

export default Spotlight;
