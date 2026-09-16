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
import { Link, useLocation } from "react-router-dom";
import { Mic, BookOpen, Quote, Radio } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { MagazineWall } from "@/components/scene/MagazineWall";
import { PodcastPlayer } from "@/components/scene/PodcastPlayer";
import { APP_URL } from "@/lib/constants";
import { EditorialPageHero } from "@/components/kretopia/EditorialPageHero";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { SpotlightBoard, type SpotlightTab } from "@/components/kretopia/SpotlightBoard";

const NOTES = [
  { icon: BookOpen, title: "The Magazine", body: "Long-form features and interviews with the people behind the work." },
  { icon: Mic, title: "The Podcast", body: "Conversations in their own words — process, setbacks, the real numbers." },
  { icon: Quote, title: "Straight from the source", body: "No press releases. Creatives telling their own story, unfiltered." },
  { icon: Radio, title: "Always on", body: "New stories and episodes drop as the community makes them." },
];

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
        <EditorialPageHero
          kicker="The Spotlight"
          oneLine
          title="Spotlight."
          accentTitle="Stories worth playing."
          subtitle="Interviews, features and podcast episodes from across the creative universe — the people behind the work, in their own words."
        />

        <StudioFeatureShell>
          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1.5">The desk</p>
            <h2 className="text-xl font-bold text-foreground mb-4">Read it, or hear it.</h2>
            <SpotlightBoard
              value={activeTab}
              onValueChange={setActiveTab}
              magazine={<MagazineWall />}
              podcast={<PodcastPlayer />}
            />
          </section>

          <section>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1.5">Why it matters</p>
            <h2 className="text-xl font-bold text-foreground mb-4">Proof is the record. Story is the reason.</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {NOTES.map((n) => (
                <div key={n.title} className="h-full rounded-2xl border border-border bg-card p-5 transition-colors hover:border-[hsl(var(--energy)/0.35)]">
                  <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--energy)/0.1)]">
                    <n.icon className="h-4 w-4 text-[hsl(var(--energy))]" />
                  </span>
                  <p className="text-foreground font-semibold text-sm mb-1.5">{n.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
              "Credits show what you did. Spotlight shows how you did it — and why the next person should call you."
            </p>
          </section>
        </StudioFeatureShell>
      </div>
    </PageTransition>
  );
};

export default Spotlight;
