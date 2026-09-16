import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Headphones, CalendarDays, Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeaturedItem {
  type: "article" | "podcast" | "event";
  title: string;
  subtitle: string;
  imageUrl: string | null;
  icon: React.ReactNode;
  badge: string;
  onClick?: () => void;
}

interface Props {
  onNavigate: (tab: string) => void;
}

export const SceneHero = ({ onNavigate }: Props) => {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const load = async () => {
      const featured: FeaturedItem[] = [];

      // Featured article
      const { data: article } = await supabase
        .from("magazine_articles")
        .select("title, subtitle, cover_image_url")
        .eq("is_published", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (article) {
        featured.push({
          type: "article",
          title: article.title,
          subtitle: article.subtitle || "Read the latest from Kretopia Magazine",
          imageUrl: article.cover_image_url,
          icon: <BookOpen className="h-3 w-3" />,
          badge: "Magazine",
          onClick: () => onNavigate("magazine"),
        });
      }

      // Static podcast highlight
      featured.push({
        type: "podcast",
        title: "Discover A Thriver",
        subtitle: "Creative stories & insights from the creator economy",
        imageUrl: null,
        icon: <Headphones className="h-3 w-3" />,
        badge: "Podcast",
        onClick: () => onNavigate("podcast"),
      });

      // Upcoming event
      const { data: event } = await supabase
        .from("creative_jams")
        .select("title, venue_name, cover_image_url")
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (event) {
        featured.push({
          type: "event",
          title: event.title,
          subtitle: event.venue_name || "Upcoming creative event",
          imageUrl: event.cover_image_url,
          icon: <CalendarDays className="h-3 w-3" />,
          badge: "Event",
          onClick: () => onNavigate("events"),
        });
      }

      // Fallback if no content
      if (featured.length === 0) {
        featured.push({
          type: "article",
          title: "Welcome to Scene",
          subtitle: "Your creative community hub for events, inspiration & stories",
          imageUrl: null,
          icon: <Flame className="h-3 w-3" />,
          badge: "Kretopia",
        });
      }

      setItems(featured);
    };
    load();
  }, [onNavigate]);

  if (items.length === 0) return null;

  const current = items[active];

  const gradients = {
    article: "from-primary/80 via-secondary/60 to-accent/40",
    podcast: "from-secondary/80 via-primary/60 to-accent/40",
    event: "from-accent/80 via-primary/60 to-secondary/40",
  };

  return (
    <Card
      className="relative overflow-hidden rounded-2xl border-0 cursor-pointer group mb-4"
      onClick={current.onClick}
    >
      <div className="aspect-[2.2/1] relative">
        {current.imageUrl ? (
          <img
            src={current.imageUrl}
            alt={current.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-br", gradients[current.type])} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Badge */}
        <div className="absolute top-3 left-3">
          <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/20 text-[10px] gap-1">
            {current.icon}
            {current.badge}
          </Badge>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-white font-bold text-base leading-tight line-clamp-1">{current.title}</h2>
          <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{current.subtitle}</p>
        </div>

        {/* Dots */}
        {items.length > 1 && (
          <div className="absolute bottom-2 right-3 flex gap-1">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActive(i); }}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  i === active ? "bg-white w-4" : "bg-white/40"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
