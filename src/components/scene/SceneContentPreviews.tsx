import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Headphones, CalendarDays, ArrowRight, Sparkles, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  onNavigate: (tab: string) => void;
}

export const SceneContentPreviews = ({ onNavigate }: Props) => {
  const [latestArticle, setLatestArticle] = useState<any>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const [articleRes, eventRes] = await Promise.all([
        supabase
          .from("magazine_articles")
          .select("title, subtitle, category, cover_image_url, read_time_minutes, created_at")
          .eq("is_published", true)
          .eq("is_featured", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("creative_jams")
          .select("title, venue_name, start_time, category, cover_image_url")
          .gte("start_time", new Date().toISOString())
          .order("start_time", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      setLatestArticle(articleRes.data);
      setUpcomingEvent(eventRes.data);
    };
    load();
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {/* Magazine preview */}
      <Card
        className="p-0 overflow-hidden rounded-xl border-border/50 cursor-pointer group hover:border-primary/30 transition-colors"
        onClick={() => onNavigate("magazine")}
      >
        {latestArticle?.cover_image_url ? (
          <div className="aspect-[3/2] relative">
            <img src={latestArticle.cover_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-0 text-[9px] gap-1">
                  <BookOpen className="h-2.5 w-2.5" />
                  Magazine
                </Badge>
                {latestArticle.created_at && (Date.now() - new Date(latestArticle.created_at).getTime() < 3 * 24 * 60 * 60 * 1000) && (
                  <Badge className="bg-primary text-primary-foreground border-0 text-[9px]">New</Badge>
                )}
              </div>
              <p className="text-white text-[11px] font-semibold line-clamp-2 leading-tight">{latestArticle.title}</p>
            </div>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[11px] font-semibold">Magazine</span>
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-2">
              {latestArticle?.title || "Stories & insights for creatives"}
            </p>
            <span className="text-[10px] text-primary flex items-center gap-0.5 font-medium">
              Read <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        )}
      </Card>

      {/* Podcast preview */}
      <Card
        className="p-0 overflow-hidden rounded-xl border-border/50 cursor-pointer group hover:border-primary/30 transition-colors"
        onClick={() => onNavigate("podcast")}
      >
        <div className="aspect-[3/2] relative bg-gradient-to-br from-primary/70 via-primary/50 to-primary/30">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Headphones className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="absolute bottom-0 p-2.5">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-0 text-[9px] gap-1 mb-1">
              <Headphones className="h-2.5 w-2.5" />
              Podcast
            </Badge>
            <p className="text-white text-[11px] font-semibold leading-tight">Discover A Thriver</p>
          </div>
        </div>
      </Card>

      {/* Event preview (full width below) */}
      {upcomingEvent && (
        <Card
          className="col-span-2 flex gap-3 p-3 rounded-xl border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => onNavigate("events")}
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex flex-col items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-accent uppercase">
              {format(new Date(upcomingEvent.start_time), "MMM")}
            </span>
            <span className="text-sm font-bold text-accent leading-none">
              {format(new Date(upcomingEvent.start_time), "dd")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold line-clamp-1">{upcomingEvent.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {upcomingEvent.venue_name || "Creative event"} • {format(new Date(upcomingEvent.start_time), "h:mm a")}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
        </Card>
      )}
    </div>
  );
};
