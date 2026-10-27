/** Keep shared CommonJS interop in React's foundational chunk, never a consumer. */
export function vendorChunk(id: string): string | undefined {
  if (id.includes("commonjsHelpers")) return "react-vendor";
  if (!id.includes("node_modules")) return undefined;
  if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "react-vendor";
  if (id.includes("@supabase")) return "supabase-vendor";
  if (id.includes("framer-motion")) return "motion-vendor";
  if (id.includes("@sentry")) return "sentry-vendor";
  if (/node_modules\/(i18next|react-i18next|html-parse-stringify)\//.test(id)) return "i18n-vendor";
  return undefined;
}