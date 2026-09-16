import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, BookOpen, Headphones, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Article {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  content: string | null;
  category: string | null;
  cover_image_url: string | null;
  read_time_minutes: number | null;
  created_at: string;
  is_featured: boolean | null;
}

export const SpotlightFeedRow = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from("magazine_articles")
          .select("id, slug, title, subtitle, content, category, cover_image_url, read_time_minutes, created_at, is_featured")
          .eq("is_published", true)
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8);
        setArticles((data || []) as Article[]);
      } catch {
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || articles.length === 0) return null;

  const isNew = (createdAt: string) =>
    Date.now() - new Date(createdAt).getTime() < 3 * 24 * 60 * 60 * 1000;

  const articleHref = (a: Article) => `/magazine/${a.slug || a.id}`;

  return (
    <section className="mb-8 scroll-mt-14">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Spotlight
        </h2>
        <Link
          to="/spotlight"
          className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
        >
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 snap-x snap-mandatory">
        {/* Podcast CTA card — shown first for visibility */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="shrink-0 w-[78%] sm:w-[300px] snap-start"
        >
          <Link
            to="/spotlight?tab=podcast"
            className="block h-full rounded-2xl overflow-hidden border border-primary/40 bg-gradient-to-br from-primary/30 via-primary/15 to-accent/20 hover:border-primary transition-all shadow-sm hover:shadow-md group relative"
          >
            <div className="aspect-[16/10] relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.4),transparent_70%)]" />
              <div className="h-14 w-14 rounded-full bg-primary/30 flex items-center justify-center group-hover:scale-110 transition-transform border border-primary/50 relative z-10">
                <Headphones className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="absolute top-2 left-2">
                <Badge className="bg-background/90 text-foreground border-0 text-[10px] font-semibold gap-1">
                  <Headphones className="h-2.5 w-2.5" />
                  Podcast
                </Badge>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background via-background/80 to-transparent">
                <p className="text-foreground text-sm font-bold leading-tight">Discover A Thriver</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">Conversations with creators making it happen</p>
              </div>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">New episodes weekly</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold group-hover:gap-1.5 transition-all">
                Listen <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        </motion.div>

        {articles.map((a) => (
          <div
            key={a.id}
            className="shrink-0 w-[78%] sm:w-[300px] snap-start"
          >
            <Link
              to={articleHref(a)}
              className="block rounded-2xl overflow-hidden border border-border/50 bg-card hover:border-primary/40 transition-all shadow-sm hover:shadow-md group h-full"
            >
              <div className="aspect-[16/10] relative bg-muted">
                {a.cover_image_url ? (
                  <img
                    src={a.cover_image_url}
                    alt={a.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/10">
                    <BookOpen className="h-8 w-8 text-primary/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <Badge className="bg-background/90 text-foreground border-0 text-[10px] font-semibold gap-1">
                    <BookOpen className="h-2.5 w-2.5" />
                    Magazine
                  </Badge>
                  {isNew(a.created_at) && (
                    <Badge className="bg-primary text-primary-foreground border-0 text-[10px] font-semibold">
                      New
                    </Badge>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  {a.category && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 mb-1">
                      {a.category}
                    </p>
                  )}
                  <p className="text-white text-sm font-bold leading-tight line-clamp-2">
                    {a.title}
                  </p>
                </div>
              </div>
              <div className="p-3">
                {(() => {
                  const preview = a.subtitle?.trim() || (a.content ? a.content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 140) : "");
                  return preview ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {preview}
                    </p>
                  ) : null;
                })()}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {a.read_time_minutes ? `${a.read_time_minutes} min read` : "Quick read"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-primary font-semibold group-hover:gap-1.5 transition-all">
                    Read <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        ))}

      </div>
    </section>
  );
};

export default SpotlightFeedRow;
