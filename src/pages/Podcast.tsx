import { Helmet } from "react-helmet-async";
import { PodcastPlayer } from "@/components/scene/PodcastPlayer";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_URL } from "@/lib/constants";

const Podcast = () => {
  const navigate = useNavigate();
  const canonicalUrl = `${APP_URL}/podcast`;

  return (
    <PageTransition>
      <Helmet>
        <title>Discover A Thriver Podcast | Kretopia</title>
        <meta name="description" content="Stories, insights and conversations with creatives shaping the industry. Listen to the Discover A Thriver podcast by Kretopia." />
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="index, follow" />

        <meta property="og:type" content="website" />
        <meta property="og:title" content="Discover A Thriver Podcast | Kretopia" />
        <meta property="og:description" content="Stories, insights and conversations with creatives shaping the industry." />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Kretopia" />
        <meta property="og:image" content="https://www.kretopia.com/og-image.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@kretopia" />
        <meta name="twitter:title" content="Discover A Thriver Podcast | Kretopia" />
        <meta name="twitter:description" content="Stories, insights and conversations with creatives shaping the industry." />
        <meta name="twitter:image" content="https://www.kretopia.com/og-image.png" />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "PodcastSeries",
            "name": "Discover A Thriver",
            "description": "Stories, insights and conversations with creatives shaping the industry.",
            "url": canonicalUrl,
            "publisher": {
              "@type": "Organization",
              "name": "Kretopia",
                "url": APP_URL
            }
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          <PodcastPlayer />
        </div>
      </div>
    </PageTransition>
  );
};

export default Podcast;
