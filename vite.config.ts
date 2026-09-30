import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { versionPlugin } from "./plugins/version-plugin";
import { sitemapPlugin } from "./plugins/sitemap-plugin";
import { magazineSharePagesPlugin } from "./plugins/magazine-share-pages";
import { profileSharePagesPlugin } from "./plugins/profile-share-pages";
import { gigSharePagesPlugin } from "./plugins/gig-share-pages";
import { eventSharePagesPlugin } from "./plugins/event-share-pages";
import { campaignSharePagesPlugin } from "./plugins/campaign-share-pages";
import { seoPagesPlugin } from "./plugins/seo-pages";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { visualizer } from "rollup-plugin-visualizer";

const { hash: buildHash, plugin: versionJsonPlugin } = versionPlugin();

// These values are public client configuration (they are embedded in every
// browser bundle). Keep safe defaults so preview and production builds do not
// crash when a local, gitignored .env file is unavailable.
const PUBLIC_SUPABASE_DEFAULTS = {
  url: "https://kwmcocsitwssrtzkdojh.supabase.co",
  publishableKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bWNvY3NpdHdzc3J0emtkb2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzA3MzYsImV4cCI6MjA3NDc0NjczNn0.ZiAk_MZuQkA0quxb7KABtlJ1cY1KUAyXw55OebmUT4c",
  projectId: "kwmcocsitwssrtzkdojh",
};

// PERMANENT: the real production backend is this one (all live users,
// profiles, credits, payments, storage). Lovable Cloud's own backend for
// this project was activated by mistake and is empty -- schema migrations
// alone can't populate it with real data/auth.users/storage, so cutting
// over to it was decided against (2026-09-20). The auto-generated .env
// points at that empty Cloud backend, so it would otherwise win over the
// public defaults above; this override is what keeps the app on the real
// one. Do not flip this to false -- there is no migrated data behind it.
const FORCE_LEGACY_BACKEND = true;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = FORCE_LEGACY_BACKEND
    ? PUBLIC_SUPABASE_DEFAULTS.url
    : env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_DEFAULTS.url;
  const supabasePublishableKey = FORCE_LEGACY_BACKEND
    ? PUBLIC_SUPABASE_DEFAULTS.publishableKey
    : env.VITE_SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_DEFAULTS.publishableKey;
  const supabaseProjectId = FORCE_LEGACY_BACKEND
    ? PUBLIC_SUPABASE_DEFAULTS.projectId
    : env.VITE_SUPABASE_PROJECT_ID || PUBLIC_SUPABASE_DEFAULTS.projectId;
  const generateStaticSocialPages = env.VITE_GENERATE_STATIC_SOCIAL_PAGES === "true";
  const analyzeBundle = process.env.ANALYZE === "true";

  return {
    define: {
      __BUILD_VERSION__: JSON.stringify(buildHash),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    server: {
      host: "::",
      // Respect an assigned PORT env var (e.g. the Claude Code preview
      // harness's autoPort) instead of always fighting over 8080 with
      // whatever else happens to be running locally; falls back to 8080
      // for a plain `npm run dev` with nothing else set.
      port: Number(process.env.PORT) || 8080,
    },
    plugins: [
      react(),
      mcpPlugin(),
      mode === "development" && componentTagger(),
      VitePWA({
        injectRegister: false,
        registerType: "autoUpdate",
        devOptions: {
          enabled: false,
        },
        includeAssets: ["favicon.png", "apple-touch-icon.png"],
        // Inject push notification handlers from public/sw.js
        injectManifest: undefined,
        workbox: {
          // Force immediate update - critical for PWA freshness
          skipWaiting: true,
          clientsClaim: true,
          // Clean old caches on update
          cleanupOutdatedCaches: true,
          // Raise precache size limit to accommodate the main JS bundle
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // CRITICAL: Never precache version.json — it must always be fetched fresh
          globIgnores: ['**/version.json'],
          // CRITICAL: Don't cache OAuth redirect route
          navigateFallbackDenylist: [/^\/~oauth/],
          // CRITICAL: Disable navigation precache fallback so index.html is always
          // fetched fresh from the network. This prevents the SW from serving a
          // stale index.html that references chunk filenames that no longer exist
          // after a deploy (root cause of "Failed to fetch dynamically imported
          // module" black-screen errors).
          navigateFallback: null,
          // Import push notification scripts
          importScripts: ['/sw.js'],
          // Cache strategy
          runtimeCaching: [
            {
              // HTML navigations: always go to network first so users get fresh
              // chunk manifests immediately after a deploy. Falls back to cache
              // only when offline.
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'html-navigations',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // API calls: always network first
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5,
                },
              },
            },
            {
              // Static assets: cache but revalidate quickly
              urlPattern: /\.(png|jpg|jpeg|svg|gif|woff|woff2)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-assets',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
            // NOTE: JS/CSS are NOT cached via runtimeCaching — 
            // Vite uses content-hashed filenames so workbox precaching handles them.
            // This prevents stale JS bundles from being served after deploys.
          ],
        },
        manifest: {
          name: "Kretopia — Where Creativity Lives",
          short_name: "Kretopia",
          description: "The Creative Economy OS. Passport · Scout · Kreto.",
          theme_color: "#7c3aed",
          background_color: "#0a0a0a",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
      versionJsonPlugin,
      // Unconditional, unlike the static-page plugins below — a sitemap is
      // one file, so it carries none of the per-entity upload-throttling
      // risk that keeps those opt-in. No reason this one should ever go
      // stale on a normal production build.
      sitemapPlugin({
        projectUrl: supabaseUrl,
        publishableKey: supabasePublishableKey,
        siteUrl: "https://www.kretopia.com",
      }),
      // These plugins can emit hundreds/thousands of per-entity HTML files
      // (/profile/:id, /credits/project/:id, /share/gig/:id, etc.). Lovable's
      // preview uploader can throttle when too many generated files are pushed
      // in one deploy, so keep them opt-in for dedicated SEO export builds.
      generateStaticSocialPages && magazineSharePagesPlugin({
        projectUrl: supabaseUrl,
        publishableKey: supabasePublishableKey,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && profileSharePagesPlugin({
        projectUrl: supabaseUrl,
        publishableKey: supabasePublishableKey,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && gigSharePagesPlugin({
        projectUrl: supabaseUrl,
        publishableKey: supabasePublishableKey,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && eventSharePagesPlugin({
        projectUrl: supabaseUrl,
        publishableKey: supabasePublishableKey,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && campaignSharePagesPlugin({
        projectUrl: supabaseUrl,
        publishableKey: supabasePublishableKey,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && seoPagesPlugin({
        projectUrl: supabaseUrl,
        publishableKey: supabasePublishableKey,
        siteUrl: "https://www.kretopia.com",
      }),
      // Dev-tool only, opt-in via `ANALYZE=true npm run build` -- writes
      // dist/bundle-stats.html and never affects a normal build's output.
      analyzeBundle && visualizer({
        filename: "dist/bundle-stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@/integrations/supabase/client": path.resolve(__dirname, "./src/integrations/supabase/legacyClient.ts"),
        "@/integrations/supabase/types": path.resolve(__dirname, "./src/integrations/supabase/legacyTypes.ts"),
        "@": path.resolve(__dirname, "./src"),
        // Deduplicate React to prevent multiple instances
        react: path.resolve(__dirname, "./node_modules/react"),
        "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
      exclude: ["mapbox-gl"], // Résout l'erreur de string literal non terminée sur la source map
    },
  };
});
