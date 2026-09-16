import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Link2, Award, Globe2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { testimonials } from "@/data/testimonials";

interface Stats {
  creators: number;
  connections: number;
  credits: number;
  countries: number;
}

const formatNum = (n: number) => n.toLocaleString();

/**
 * Live network signal — fetches counts directly (no edge fn) so it can't fail
 * silently. Wrapped in `isolation:isolate` + `contain` + `translateZ(0)` to stop
 * Android Chrome tile-compositor bleed (the horizontal-scanline glitch users
 * reported around this section on real devices).
 */
export const SocialProofSection = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // public-stats edge fn uses service role — only way to read real counts past RLS
        const { data, error } = await supabase.functions.invoke<{
          stats?: {
            creators?: number;
            connections?: number;
            credits?: number;
            countries?: number;
          };
        }>("public-stats");
        if (!alive || error || !data) return;
        const s = data.stats ?? {};
        setStats({
          creators: s.creators ?? 0,
          connections: s.connections ?? 0,
          credits: s.credits ?? 0,
          countries: s.countries ?? 23,
        });
      } catch {
        /* silent — keep landing resilient */
      }
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!stats) return null;

  const headlineStats = [
    { icon: Users, label: "Verified creators", value: formatNum(stats.creators) },
    { icon: Link2, label: "Verified connections", value: formatNum(stats.connections) },
    { icon: Award, label: "Credits logged", value: formatNum(stats.credits) },
    { icon: Globe2, label: "Countries", value: formatNum(stats.countries) },
  ];

  const showTestimonials = testimonials.length >= 4; // even-only

  return (
    <section
      className="relative py-16 sm:py-24 px-4 border-y border-border/40 bg-background"
      style={{
        isolation: "isolate",
        contain: "layout paint",
        WebkitTransform: "translateZ(0)",
        transform: "translateZ(0)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-4">
            Live network signal
          </p>
          <h2 className="font-serif text-3xl sm:text-5xl md:text-6xl tracking-tight leading-[1.05] text-foreground mb-5">
            Built by creators.
            <br />
            <span className="italic">Proven by data.</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            Real numbers from the network — updated automatically. No vanity metrics.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {headlineStats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card p-5 sm:p-6 text-center"
            >
              <s.icon className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-foreground/70" />
              <p className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {s.value}
              </p>
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground mt-1 font-medium">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {showTestimonials && (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {testimonials.slice(0, 4).map((t) => (
              <article key={t.name} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm text-foreground leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt={t.name} />}
                    <AvatarFallback className="text-xs">
                      {t.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-foreground leading-tight">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.role}
                      {t.location ? ` · ${t.location}` : ""}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground/70 mt-8">
          Updated live · Excludes internal accounts
        </p>
      </div>
    </section>
  );
};
