import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Public (publishable) values, mirrored from vite.config.ts so component tests
// that import the Supabase client can instantiate it in jsdom.
const PUBLIC_SUPABASE_DEFAULTS = {
  url: "https://kwmcocsitwssrtzkdojh.supabase.co",
  publishableKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bWNvY3NpdHdzc3J0emtkb2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzA3MzYsImV4cCI6MjA3NDc0NjczNn0.ZiAk_MZuQkA0quxb7KABtlJ1cY1KUAyXw55OebmUT4c",
  projectId: "kwmcocsitwssrtzkdojh",
};

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_DEFAULTS.url,
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        PUBLIC_SUPABASE_DEFAULTS.publishableKey,
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      process.env.VITE_SUPABASE_PROJECT_ID || PUBLIC_SUPABASE_DEFAULTS.projectId,
    ),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Edge functions import Deno-style `npm:` specifiers, which Vite cannot
      // resolve even when a test mocks them. Tests that run an edge handler
      // (src/lib/__tests__/edge) point the specifier at a stub and then mock it.
      { find: /^npm:@supabase\/supabase-js@.*$/, replacement: path.resolve(__dirname, "./src/lib/__tests__/edge/supabaseJsStub.ts") },
      { find: "npm:zod@4", replacement: path.resolve(__dirname, "./node_modules/zod/index.js") },
    ],
  },
});
