import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ShowcaseItem {
  id: string;
  title: string;
  thumbnail_url: string;
  media_type: string;
}

export const PortfolioShowcase = () => {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const fetchPortfolio = async () => {
      try {
        const { data, error } = await supabase
          .from("credits")
          .select("id, project_name, primary_media_url, thumbnail_url, media_type")
          .not("primary_media_url", "is", null)
          .not("thumbnail_url", "is", null)
          .neq("thumbnail_url", "")
          .order("created_at", { ascending: false })
          .limit(30);

        if (error || !data || data.length === 0) {
          console.log("Portfolio fetch:", error?.message || "no data");
          setLoading(false);
          return;
        }

        const valid = data.filter((d) => {
          const t = d.thumbnail_url || "";
          return !t.endsWith(".wav") && !t.endsWith(".mp3") && !t.endsWith(".ogg");
        });

        const shuffled = valid
          .map((d) => ({
            id: d.id,
            title: d.project_name || "Untitled",
            thumbnail_url: d.thumbnail_url!,
            media_type: d.media_type || "image",
          }))
          .sort(() => Math.random() - 0.5);

        console.log(`Portfolio showcase: ${shuffled.length} items loaded`);
        setItems(shuffled);
      } catch (err) {
        console.error("Portfolio fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  if (loading || items.length < 2) return null;

  const scrollItems = [...items, ...items];

  return (
    <section className="py-16 sm:py-20 overflow-hidden">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 mb-10 text-center">
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-primary mb-3">
          Real work. Real creators.
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          See what's being built on{" "}
          <span className="text-primary">
            Kretopia
          </span>
        </h2>
        <p className="mt-3 text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">
          From demo reels to brand designs — browse portfolios from creators
          already on the platform.
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div className="flex gap-4 animate-scroll-x hover:[animation-play-state:paused]">
          {scrollItems.map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className="flex-shrink-0 w-64 sm:w-72 group"
            >
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border/50 bg-muted shadow-sm transition-all duration-300 group-hover:shadow-card group-hover:-translate-y-1">
                <img
                  src={item.thumbnail_url}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const card = (e.target as HTMLElement).closest('[data-card]');
                    if (card) (card as HTMLElement).style.display = 'none';
                  }}
                />
                {item.media_type === "video" && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-foreground/60 text-background text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                    <Play className="h-2.5 w-2.5 fill-current" />
                    Video
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm font-medium truncate text-muted-foreground px-1">
                {item.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-10">
        <Link to="/auth">
          <Button variant="outline" size="lg" className="group border-primary/30 hover:border-primary/60">
            Join & showcase your work
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </section>
  );
};
