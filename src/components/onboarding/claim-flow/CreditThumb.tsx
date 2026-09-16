import { useState } from "react";
import { cn } from "@/lib/utils";
import { Music, Film, Image as ImageIcon, Mic, Video, Briefcase, Globe } from "lucide-react";

interface Props {
  src?: string;
  title: string;
  platform?: string;
  className?: string;
  iconClassName?: string;
}

const PLATFORM_GRADIENTS: Record<string, string> = {
  spotify: "from-emerald-500/40 to-emerald-700/20",
  "apple music": "from-pink-500/40 to-rose-700/20",
  applemusic: "from-pink-500/40 to-rose-700/20",
  youtube: "from-red-500/40 to-red-700/20",
  vimeo: "from-primary/40 to-primary/20",
  imdb: "from-yellow-500/40 to-amber-700/20",
  behance: "from-primary/40 to-primary/20",
  dribbble: "from-pink-400/40 to-fuchsia-700/20",
  soundcloud: "from-orange-500/40 to-orange-700/20",
  muso: "from-primary/40 to-primary/20",
  artstation: "from-primary/40 to-primary/20",
};

const PLATFORM_ICONS: Record<string, typeof Music> = {
  spotify: Music,
  "apple music": Music,
  applemusic: Music,
  soundcloud: Music,
  muso: Music,
  youtube: Video,
  vimeo: Film,
  imdb: Film,
  behance: ImageIcon,
  dribbble: ImageIcon,
  artstation: ImageIcon,
  podcast: Mic,
};

/** Image with branded fallback — never shows an empty/broken box. */
export const CreditThumb = ({ src, title, platform, className, iconClassName }: Props) => {
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;
  const key = (platform || "").toLowerCase().trim();
  const grad = PLATFORM_GRADIENTS[key] || "from-primary/30 to-accent/15";
  const Icon = PLATFORM_ICONS[key] || Briefcase;
  const initial = title?.trim().charAt(0).toUpperCase() || "?";

  if (showImg) {
    return (
      <img
        src={src}
        alt={title}
        loading="lazy"
        onError={() => setErrored(true)}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br relative",
        grad,
        className
      )}
      aria-label={title}
    >
      <Icon className={cn("text-foreground/40", iconClassName)} />
      <span className="absolute bottom-1 right-1 text-[10px] font-bold text-foreground/50 uppercase tracking-wide">
        {initial}
      </span>
    </div>
  );
};
