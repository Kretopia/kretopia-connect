import { Sparkles, MapPin, Verified } from "lucide-react";

/**
 * Match — the matchmaker. Tease the killer wedge: "we don't just let you
 * search, Thrive scouts the top 3 for you and explains why." No swipe lingo —
 * cards are tap-to-open.
 */
export const ProductSectionMatch = () => {
  const candidates = [
    { name: "Adaeze O.", role: "Director of Photography", city: "Lagos · 2.3 km", match: 94, tags: ["Editorial", "Sony FX3", "SS25 lookbook credit"], top: true },
    { name: "Jordan M.", role: "Cinematographer", city: "Lagos · 5.1 km", match: 87, tags: ["18 verified credits", "Music videos"] },
    { name: "Sade K.", role: "Director / DP", city: "Lagos · 8.4 km", match: 81, tags: ["Films", "Vogue feature"] },
  ];

  return (
    <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40">
      <div className="container mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
          {/* Copy */}
          <div>
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5">
              <Sparkles className="h-3 w-3" /> Smart Match · Matchmaker
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.03em] leading-[1.05] text-foreground mb-4">
              Don't just search.<br />
              <span className="text-energy-glow">Get scouted.</span>
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-5 max-w-md">
              Tell Thrive what you're shooting. We surface the top 3 collaborators in your city — ranked by verified credits, distance, and past work that fits your brief. No endless scrolling.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "Top 3 picked from your network + the wider creator economy",
                "Tap a card to open their verified profile",
                "Thrive drafts the intro DM for you",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-foreground/90">
                  <Verified className="h-4 w-4 text-energy mt-0.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mock — search results panel */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 to-energy/10 blur-3xl" />
            <div className="rounded-3xl border border-primary/30 bg-card shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 bg-background/40 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground">Brief · "DP for SS26 lookbook · Lagos · 3 days"</p>
                <span className="text-[10px] font-bold text-energy">Top 3 of 28</span>
              </div>
              <ul className="divide-y divide-border/50">
                {candidates.map((c) => (
                  <li
                    key={c.name}
                    className={`px-4 py-3 flex items-center gap-3 ${
                      c.top ? "bg-gradient-to-r from-energy/10 to-transparent" : ""
                    }`}
                  >
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                      c.top ? "bg-gradient-to-br from-primary to-energy text-primary-foreground" : "bg-primary/15 text-primary"
                    }`}>
                      {c.name.split(" ").map((p) => p[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                        {c.top && <Verified className="h-3.5 w-3.5 text-energy shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{c.role}</p>
                      <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {c.city}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              c.top ? "bg-energy/15 text-energy" : "bg-muted/60 text-muted-foreground"
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-2xl font-black leading-none ${c.top ? "text-energy-glow" : "text-primary"}`}>
                        {c.match}<span className="text-[11px]">%</span>
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mt-0.5">Match</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-energy/10 border-t border-primary/20 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-energy shrink-0" />
                <p className="text-[11px] text-foreground/90 leading-snug">
                  <span className="font-black">Kreto scouted these.</span> Tap any card to open the profile or have us draft the intro.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
