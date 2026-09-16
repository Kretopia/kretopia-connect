import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BookOpen, PenSquare, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MagazineArticleModal } from "./MagazineArticleModal";
import { MagazineArticleCard } from "./MagazineArticleCard";
import { MagazineEditor } from "./MagazineEditor";

interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  content: string;
  cover_image_url: string | null;
  cover_position_x?: number | null;
  cover_position_y?: number | null;
  cover_zoom?: number | null;
  category: string;
  tags: string[];
  author_name: string;
  author_avatar_url: string | null;
  is_featured: boolean;
  read_time_minutes: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  slug: string | null;
}

const CATEGORIES = ["all", "fashion", "art-culture", "music", "film", "events-festivals", "impact", "community", "web3-ai", "taste-of-bali", "photography", "business", "lifestyle-wellness", "bali-developments", "inspiration", "how-to", "spotlight"];

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  fashion: "Fashion",
  "art-culture": "Art & Culture",
  music: "Music",
  film: "Film",
  "events-festivals": "Events & Festivals",
  impact: "Impact",
  community: "Community",
  "web3-ai": "Web3 & AI",
  "taste-of-bali": "Taste of Bali",
  photography: "Photography",
  business: "Business",
  "lifestyle-wellness": "Lifestyle & Wellness",
  "bali-developments": "Bali Developments",
  inspiration: "Inspiration",
  "how-to": "How-To",
  spotlight: "Spotlight",
};

const formatCategoryLabel = (cat: string) => CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);

type SortKey = "latest" | "most-read" | "trending";

export const MagazineWall = () => {
  const { user } = useAuth();
  const { isEditorOrAdmin } = useUserRole();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("latest");
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchArticles = async () => {
    setLoading(true);
    setFetchError(false);
    let query = supabase
      .from("magazine_articles")
      .select("*")
      .eq("is_published", true)
      .limit(60);

    if (activeCategory !== "all") {
      query = query.eq("category", activeCategory);
    }

    if (sort === "most-read") {
      query = query.order("view_count", { ascending: false });
    } else if (sort === "trending") {
      // Trending: last 7 days, ranked by view_count
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", sevenDaysAgo).order("view_count", { ascending: false });
    } else {
      query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch magazine articles:", error);
      setFetchError(true);
      setArticles([]);
    } else {
      setArticles((data as Article[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchArticles(); }, [activeCategory, sort]);

  // Client-side search filter
  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.subtitle || "").toLowerCase().includes(q) ||
      a.author_name.toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q)) ||
      a.category.toLowerCase().includes(q)
    );
  }, [articles, search]);

  if (showEditor) {
    return (
      <MagazineEditor
        articleId={editingId}
        onClose={() => { setShowEditor(false); setEditingId(null); }}
        onPublished={() => { setShowEditor(false); setEditingId(null); fetchArticles(); }}
      />
    );
  }

  const featured = sort === "latest" ? filteredArticles.find(a => a.is_featured) : undefined;
  const rest = featured ? filteredArticles.filter(a => a !== featured) : filteredArticles;

  const openEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setEditingId(id);
    setShowEditor(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Kretopia Magazine
        </h2>
        <p className="text-xs text-muted-foreground">Stories, insights & creative culture</p>
      </div>

      {/* Publish CTA — open to every signed-in user, not just admin/writer:
          a non-staff submission still lands here (via the same editor) but
          is force-unpublished server-side pending review (see the
          2026-09-09 migration's enforce_magazine_moderation trigger), so
          the copy sets that expectation honestly instead of implying
          instant publication. */}
      <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--energy)/0.3)] bg-gradient-to-br from-[hsl(var(--energy)/0.14)] via-card to-card p-4 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl ai-ambient-breathe"
          style={{ background: "radial-gradient(circle, hsl(var(--energy)/0.35), transparent 70%)" }}
        />
        <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--energy))]">
              <Sparkles className="h-3 w-3" />
              Your story belongs here
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {isEditorOrAdmin ? "Write the next Kretopia Magazine feature." : "Got a story worth telling? Publish it."}
            </p>
            {!isEditorOrAdmin && (
              <p className="mt-0.5 text-xs text-muted-foreground">Submissions are reviewed before they go live.</p>
            )}
          </div>
          <Button
            size="sm"
            className="w-full shrink-0 gap-1.5 bg-[hsl(var(--energy))] text-white hover:bg-[hsl(var(--energy)/0.9)] sm:w-auto"
            onClick={() => {
              if (!user) { window.location.href = "/auth?next=/spotlight"; return; }
              setEditingId(null);
              setShowEditor(true);
            }}
          >
            <PenSquare className="h-3.5 w-3.5" />
            {isEditorOrAdmin ? "Write" : "Publish your story"}
          </Button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search articles, authors, tags…"
            className="pl-9 pr-9 h-9 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest" className="text-xs">Latest</SelectItem>
            <SelectItem value="most-read" className="text-xs">Most Read</SelectItem>
            <SelectItem value="trending" className="text-xs">Trending · 7d</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors capitalize",
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {formatCategoryLabel(cat)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      ) : fetchError ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Couldn't load articles</p>
          <button
            onClick={fetchArticles}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "No articles match your search" : sort === "trending" ? "No trending articles this week" : "No articles yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? "Try a different keyword" : "Check back soon for fresh creative stories"}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Featured Article — the lead story, full-width Holo Card */}
          {featured && (
            <MagazineArticleCard
              article={featured}
              categoryLabel={formatCategoryLabel(featured.category)}
              featured
              canEdit={isEditorOrAdmin}
              onOpen={() => setSelectedArticle(featured)}
              onEdit={(e) => openEdit(e, featured.id)}
            />
          )}

          {/* Topics grid — a real multi-column newspaper layout instead of
              a single swipeable rail, so more than 2-3 stories are visible
              at once and the page reads as a magazine front, not a feed. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rest.map(article => (
              <MagazineArticleCard
                key={article.id}
                article={article}
                categoryLabel={formatCategoryLabel(article.category)}
                canEdit={isEditorOrAdmin}
                onOpen={() => setSelectedArticle(article)}
                onEdit={(e) => openEdit(e, article.id)}
              />
            ))}
          </div>
        </div>
      )}

      <MagazineArticleModal article={selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)} />
    </div>
  );
};
