import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink } from "lucide-react";

interface EventHost {
  full_name?: string | null;
  avatar_url?: string | null;
  username?: string | null;
  user_id?: string | null;
  id_verified?: boolean | null;
  hostedCount?: number;
  avg_response_hours?: number | null;
  website_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  tiktok_url?: string | null;
  behance_url?: string | null;
  imdb_url?: string | null;
  soundcloud_url?: string | null;
  spotify_url?: string | null;
  youtube_url?: string | null;
  calendly_url?: string | null;
}

interface EventHostCardProps {
  host: EventHost | null;
  isAuthenticated: boolean;
  onContactViaKretopia: (username: string | null) => void;
  onSignIn: () => void;
}

const CONTACT_FIELDS = [
  ["Website", "website_url", "website"],
  ["Instagram", "instagram_url", "instagram"],
  ["X", "twitter_url", "x"],
  ["LinkedIn", "linkedin_url", "linkedin"],
  ["TikTok", "tiktok_url", "tiktok"],
  ["Behance", "behance_url", "behance"],
  ["IMDb", "imdb_url", "imdb"],
  ["SoundCloud", "soundcloud_url", "soundcloud"],
  ["Spotify", "spotify_url", "spotify"],
  ["YouTube", "youtube_url", "youtube"],
  ["Calendly", "calendly_url", "calendly"],
] as const;

const PLATFORM_DOMAINS: Record<(typeof CONTACT_FIELDS)[number][2], string> = {
  website: "",
  instagram: "instagram.com",
  x: "x.com",
  linkedin: "linkedin.com",
  tiktok: "tiktok.com",
  behance: "behance.net",
  imdb: "imdb.com",
  soundcloud: "soundcloud.com",
  spotify: "open.spotify.com",
  youtube: "youtube.com",
  calendly: "calendly.com",
};

function getPublicUrl(value: string | null | undefined, platform: (typeof CONTACT_FIELDS)[number][2]): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    if (platform === "website" || /\s/.test(raw)) return null;
  }

  const domain = PLATFORM_DOMAINS[platform];
  const handle = raw.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  return domain && handle ? `https://${domain}/${encodeURIComponent(handle)}` : null;
}

export function EventHostCard({ host, isAuthenticated, onContactViaKretopia, onSignIn }: EventHostCardProps) {
  const responseHours = host?.avg_response_hours;
  const responseLabel = typeof responseHours === "number" && Number.isFinite(responseHours) && responseHours >= 0
    ? responseHours < 1
      ? "Usually within an hour"
      : `Usually within ${Math.round(responseHours)} ${Math.round(responseHours) === 1 ? "hour" : "hours"}`
    : "Response time not listed";

  const contacts = CONTACT_FIELDS.flatMap(([label, field, platform]) => {
    const url = getPublicUrl(host?.[field], platform);
    return url ? [{ label, url }] : [];
  });

  return (
    <section aria-labelledby="event-host-name" className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-14 w-14 ring-2 ring-primary/15">
          <AvatarImage src={host?.avatar_url || undefined} alt="" />
          <AvatarFallback>{host?.full_name?.trim().charAt(0) || "H"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hosted by</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 id="event-host-name" className="font-semibold">{host?.full_name || "Event host"}</h2>
            {host?.id_verified && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
                Verified
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[host?.hostedCount ? `${host.hostedCount} ${host.hostedCount === 1 ? "event" : "events"} hosted` : null, responseLabel]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {contacts.length ? (
        <nav aria-label="Host public contact links" className="flex flex-wrap gap-2">
          {contacts.map(({ label, url }) => (
            <Button key={label} asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open host ${label}`}>
                {label} <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          ))}
        </nav>
      ) : (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => (isAuthenticated ? onContactViaKretopia(host?.username || null) : onSignIn())}
        >
          Contact via Kretopia
        </Button>
      )}
    </section>
  );
}

export default EventHostCard;
