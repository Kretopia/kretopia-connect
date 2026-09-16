import { supabase } from "@/integrations/supabase/client";

const BUCKET = "project-files";

/**
 * Extract the storage path inside the project-files bucket from either:
 *  - a stored path like "projectId/123.png"
 *  - a stored path like "project-files/projectId/123.png"
 *  - a legacy public URL containing "/project-files/<path>"
 */
export const extractProjectFilePath = (stored: string): string => {
  if (!stored) return stored;
  if (stored.startsWith("http")) {
    try {
      const u = new URL(stored);
      const parts = u.pathname.split("/");
      const idx = parts.indexOf(BUCKET);
      if (idx >= 0) return parts.slice(idx + 1).join("/");
    } catch {
      // fall through
    }
  }
  if (stored.startsWith(`${BUCKET}/`)) return stored.slice(BUCKET.length + 1);
  return stored;
};

/**
 * Generate a fresh signed URL (default 1h) for a stored path or legacy URL.
 */
export const getProjectFileSignedUrl = async (
  stored: string,
  options?: { expiresIn?: number; download?: string | boolean }
): Promise<string | null> => {
  const path = extractProjectFilePath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, options?.expiresIn ?? 3600, {
      download: options?.download,
    });
  if (error || !data?.signedUrl) {
    console.error("Failed to create signed URL", error);
    return null;
  }
  return data.signedUrl;
};
