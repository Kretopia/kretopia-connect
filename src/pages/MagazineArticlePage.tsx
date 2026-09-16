import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Helmet } from "react-helmet-async";
import { MagazineArticleViewer } from "@/components/scene/MagazineArticleViewer";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";

const MagazineArticlePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;

      // Try by slug first, then fall back to ID
      let { data, error } = await supabase
        .from("magazine_articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (!data && !error) {
        const res = await supabase
          .from("magazine_articles")
          .select("*")
          .eq("id", slug)
          .eq("is_published", true)
          .maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (error || !data) {
        setNotFound(true);
      } else {
        setArticle(data);
        supabase
          .from("magazine_articles")
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq("id", data.id)
          .then(() => {}, () => {});
      }
      setLoading(false);
    };
    fetchArticle();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h1 className="text-xl font-bold mb-2">Article Not Found</h1>
        <p className="text-muted-foreground text-sm mb-6">This article may have been moved or removed.</p>
        <Link to="/" className="text-primary text-sm font-medium hover:underline">
          Go to Kretopia →
        </Link>
      </div>
    );
  }

  const canonicalUrl = `https://kretopia.com/magazine/${slug}`;
  const description = article.subtitle || article.content?.slice(0, 155).replace(/[#*>\n]/g, "") + "...";

  return (
    <>
      <Helmet>
        <title>{article.title} | Kretopia Magazine</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Kretopia Magazine" />
        {article.cover_image_url && <meta property="og:image" content={article.cover_image_url} />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={description} />
        {article.cover_image_url && <meta name="twitter:image" content={article.cover_image_url} />}

        {/* JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description,
            image: article.cover_image_url || undefined,
            author: { "@type": "Organization", name: article.author_name || "Kretopia Magazine" },
            publisher: {
              "@type": "Organization",
              name: "Kretopia",
              url: "https://kretopia.com",
              logo: { "@type": "ImageObject", url: "https://kretopia.com/og-image.png" },
            },
            datePublished: article.created_at,
            dateModified: article.updated_at,
            mainEntityOfPage: canonicalUrl,
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <MagazineArticleViewer
          article={article}
          onBack={() => window.history.back()}
          isPublicPage={true}
          isAuthenticated={!!user}
        />
      </div>
    </>
  );
};

export default MagazineArticlePage;
