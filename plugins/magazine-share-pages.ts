import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

interface MagazineSharePagesPluginOptions {
  projectUrl: string;
  publishableKey: string;
  siteUrl: string;
}

interface MagazineArticle {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  content: string;
  cover_image_url: string | null;
  author_name: string | null;
  created_at: string;
}

const FALLBACK_OG_IMAGE = "https://www.kretopia.com/og-image.png";

export function magazineSharePagesPlugin(options: MagazineSharePagesPluginOptions): Plugin {
  return {
    name: "magazine-share-pages",
    apply: "build",
    async closeBundle() {
      if (!options.projectUrl || !options.publishableKey || !options.siteUrl) {
        console.warn("[magazine-share-pages] Missing configuration; skipping share page generation.");
        return;
      }

      const siteUrl = options.siteUrl.replace(/\/$/, "");
      const projectUrl = options.projectUrl.replace(/\/$/, "");
      const outDir = resolve(process.cwd(), "dist");

      const response = await fetch(
        `${projectUrl}/rest/v1/magazine_articles?select=id,slug,title,subtitle,content,cover_image_url,author_name,created_at,is_published&is_published=eq.true&order=created_at.desc`,
        {
          headers: {
            apikey: options.publishableKey,
            Authorization: `Bearer ${options.publishableKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`[magazine-share-pages] Failed to fetch articles: ${response.status} ${response.statusText}`);
      }

      const articles = (await response.json()) as MagazineArticle[];

      articles.forEach((article) => {
        const identifiers = Array.from(new Set([article.slug, article.id].filter(Boolean) as string[]));

        identifiers.forEach((identifier) => {
          const shareDir = resolve(outDir, "share", "magazine", identifier);
          mkdirSync(shareDir, { recursive: true });
          writeFileSync(resolve(shareDir, "index.html"), buildShareHtml(article, identifier, siteUrl));
        });
      });

      console.log(`[magazine-share-pages] Generated ${articles.length} magazine share page(s).`);
    },
  };
}

function buildShareHtml(article: MagazineArticle, identifier: string, siteUrl: string) {
  const articleIdentifier = article.slug || article.id;
  const articleUrl = `${siteUrl}/magazine/${articleIdentifier}`;
  const shareUrl = `${siteUrl}/share/magazine/${identifier}/`;
  const title = article.title;
  const description = article.subtitle || buildExcerpt(article.content);
  const image = article.cover_image_url || FALLBACK_OG_IMAGE;
  const author = article.author_name || "Kretopia Magazine";
  const publishedTime = article.created_at;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Kretopia Magazine</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="noindex,follow" />
    <link rel="canonical" href="${articleUrl}" />

    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:site_name" content="Kretopia Magazine" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta property="article:published_time" content="${escapeHtml(publishedTime)}" />
    <meta property="article:author" content="${escapeHtml(author)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />

    <meta http-equiv="refresh" content="0;url=${articleUrl}" />
    <script>window.location.replace(${JSON.stringify(articleUrl)});</script>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p><a href="${articleUrl}">Open article on Kretopia Magazine</a></p>
    </main>
  </body>
</html>`;
}

function buildExcerpt(markdown: string) {
  return markdown
    .replace(/[#*_>`~\-]+/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 155)
    .trim() + "...";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
