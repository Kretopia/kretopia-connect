import type { ClaimedCredit, DraftProfile } from "./types";

/**
 * Avatar fallback chain when AI extraction returns no avatar.
 * Order: explicit AI avatar → og:image of website → first credit thumbnail.
 * Client-side only — never blocks the flow.
 */
export async function resolveAvatarFallback(
  current: string | undefined,
  website: string | undefined,
  credits: ClaimedCredit[],
): Promise<string | undefined> {
  if (current) return current;

  // 1. Try og:image from website (best-effort; CORS may block)
  if (website && /^https?:\/\//.test(website)) {
    try {
      const proxied = `https://api.allorigins.win/get?url=${encodeURIComponent(website)}`;
      const res = await fetch(proxied, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const { contents } = await res.json();
        const og = contents?.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
        if (og?.[1]) return og[1];
        const tw = contents?.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        if (tw?.[1]) return tw[1];
      }
    } catch {
      /* swallow — fallback to credit thumbnail */
    }
  }

  // 2. First credit with a thumbnail (visual platforms = Behance/Vimeo/YouTube)
  const visual = credits.find((c) => c.thumbnail && /^https?:\/\//.test(c.thumbnail));
  return visual?.thumbnail;
}

/**
 * Templated bio fallback when the strict-extractive AI returns nothing.
 * Composes a factual line from role + top credits, no fabrication.
 */
export function buildBioFallback(profile: DraftProfile, credits: ClaimedCredit[]): string | undefined {
  if (profile.bio?.trim()) return profile.bio;

  const role = profile.role?.trim();
  const location = profile.location?.trim();
  const top = credits
    .filter((c) => c.title)
    .slice(0, 2)
    .map((c) => (c.year ? `${c.title} (${c.year})` : c.title));

  if (!role && top.length === 0) return undefined;

  const parts: string[] = [];
  if (role) {
    parts.push(location ? `${role} based in ${location}.` : `${role}.`);
  } else if (location) {
    parts.push(`Creative based in ${location}.`);
  }
  if (top.length) {
    parts.push(`Recent work includes ${top.join(" and ")}.`);
  }
  return parts.join(" ");
}
