import { Film, Music, Tv, Camera, Mic, Palette, Globe, Gamepad2, BookOpen, Video, Radio, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Category-specific cinematic gradient covers for credits without thumbnails.
 * Each category gets a unique deep gradient + icon combo for visual distinction.
 */

const CATEGORY_VISUALS: Record<string, { gradient: string; icon: any; accent: string }> = {
  // Film & TV
  film: { gradient: "from-slate-900 via-primary to-slate-900", icon: Film, accent: "text-primary/60" },
  movie: { gradient: "from-slate-900 via-primary to-slate-900", icon: Film, accent: "text-primary/60" },
  short_film: { gradient: "from-zinc-900 via-primary to-zinc-900", icon: Clapperboard, accent: "text-primary/60" },
  documentary: { gradient: "from-stone-900 via-amber-950 to-stone-900", icon: Camera, accent: "text-amber-400/60" },
  tv: { gradient: "from-gray-900 via-primary to-gray-900", icon: Tv, accent: "text-primary/60" },
  television: { gradient: "from-gray-900 via-primary to-gray-900", icon: Tv, accent: "text-primary/60" },

  // Music
  music: { gradient: "from-zinc-900 via-rose-950 to-zinc-900", icon: Music, accent: "text-rose-400/60" },
  album: { gradient: "from-zinc-900 via-rose-950 to-zinc-900", icon: Music, accent: "text-rose-400/60" },
  single: { gradient: "from-neutral-900 via-pink-950 to-neutral-900", icon: Music, accent: "text-pink-400/60" },
  ep: { gradient: "from-neutral-900 via-fuchsia-950 to-neutral-900", icon: Music, accent: "text-fuchsia-400/60" },
  mixtape: { gradient: "from-zinc-900 via-primary to-zinc-900", icon: Music, accent: "text-primary/60" },

  // Audio & Podcast
  podcast: { gradient: "from-slate-900 via-emerald-950 to-slate-900", icon: Mic, accent: "text-emerald-400/60" },
  audio: { gradient: "from-zinc-900 via-teal-950 to-zinc-900", icon: Radio, accent: "text-teal-400/60" },

  // Visual & Design
  photography: { gradient: "from-stone-900 via-orange-950 to-stone-900", icon: Camera, accent: "text-orange-400/60" },
  design: { gradient: "from-slate-900 via-primary to-slate-900", icon: Palette, accent: "text-primary/60" },
  art: { gradient: "from-zinc-900 via-primary to-zinc-900", icon: Palette, accent: "text-primary/60" },

  // Digital & Web
  digital: { gradient: "from-gray-900 via-primary to-gray-900", icon: Globe, accent: "text-primary/60" },
  web: { gradient: "from-slate-900 via-primary to-slate-900", icon: Globe, accent: "text-primary/60" },
  gaming: { gradient: "from-zinc-900 via-green-950 to-zinc-900", icon: Gamepad2, accent: "text-green-400/60" },

  // Writing & Publishing
  writing: { gradient: "from-stone-900 via-amber-950 to-stone-900", icon: BookOpen, accent: "text-amber-400/60" },
  publishing: { gradient: "from-stone-900 via-yellow-950 to-stone-900", icon: BookOpen, accent: "text-yellow-400/60" },
  book: { gradient: "from-stone-900 via-amber-950 to-stone-900", icon: BookOpen, accent: "text-amber-400/60" },

  // Video & Content
  video: { gradient: "from-gray-900 via-red-950 to-gray-900", icon: Video, accent: "text-red-400/60" },
  content: { gradient: "from-zinc-900 via-orange-950 to-zinc-900", icon: Video, accent: "text-orange-400/60" },
  commercial: { gradient: "from-slate-900 via-primary to-slate-900", icon: Clapperboard, accent: "text-primary/60" },
};

const DEFAULT_VISUAL = { gradient: "from-slate-900 via-zinc-800 to-slate-900", icon: Film, accent: "text-zinc-400/60" };

function resolveVisual(category?: string | null) {
  if (!category) return DEFAULT_VISUAL;
  const key = category.toLowerCase().replace(/[\s&-]+/g, '_');
  // Try exact match, then partial
  if (CATEGORY_VISUALS[key]) return CATEGORY_VISUALS[key];
  for (const [k, v] of Object.entries(CATEGORY_VISUALS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return DEFAULT_VISUAL;
}

interface CreditCoverPlaceholderProps {
  category?: string | null;
  title: string;
  role?: string;
  className?: string;
  height?: string;
}

export function CreditCoverPlaceholder({ 
  category, title, role, className, height = "h-[220px]" 
}: CreditCoverPlaceholderProps) {
  const { gradient, icon: Icon, accent } = resolveVisual(category);

  return (
    <div className={cn(
      `w-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center relative overflow-hidden`,
      height, className
    )}>
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" 
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
      />
      
      {/* Icon */}
      <Icon className={cn("h-10 w-10 mb-3", accent)} />
      
      {/* Title & Role */}
      <div className="text-center px-4 relative z-10">
        <p className="text-white/90 font-bold text-sm leading-tight line-clamp-2 tracking-wide">
          {title}
        </p>
        {role && (
          <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] mt-1.5">
            {role}
          </p>
        )}
      </div>
      
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}