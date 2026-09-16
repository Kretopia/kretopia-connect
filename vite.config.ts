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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const generateStaticSocialPages = env.VITE_GENERATE_STATIC_SOCIAL_PAGES === "true";
  const analyzeBundle = process.env.ANALYZE === "true";

  return {
    define: {
      __BUILD_VERSION__: JSON.stringify(buildHash),
    },
    server: {
      host: "::",
      port: 8080,
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
        projectUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        siteUrl: "https://www.kretopia.com",
      }),
      // These plugins can emit hundreds/thousands of per-entity HTML files
      // (/profile/:id, /credits/project/:id, /share/gig/:id, etc.). Lovable's
      // preview uploader can throttle when too many generated files are pushed
      // in one deploy, so keep them opt-in for dedicated SEO export builds.
      generateStaticSocialPages && magazineSharePagesPlugin({
        projectUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && profileSharePagesPlugin({
        projectUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && gigSharePagesPlugin({
        projectUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && eventSharePagesPlugin({
        projectUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && campaignSharePagesPlugin({
        projectUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        siteUrl: "https://www.kretopia.com",
      }),
      generateStaticSocialPages && seoPagesPlugin({
        projectUrl: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
