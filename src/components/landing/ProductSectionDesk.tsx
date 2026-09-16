import { CheckCircle, Sparkles, FolderOpen, Mic, FileText } from "lucide-react";

/**
 * Desk — the project OS. Show: voice → brief → tasks → vault. The wedge is
 * "we don't just give you a workspace, Thrive builds it for you from a sentence."
 */
export const ProductSectionDesk = () => (
  <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-border/40 bg-gradient-to-b from-background via-primary/[0.03] to-background">
    <div className="container mx-auto max-w-6xl">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        {/* Mock first on mobile? Keep copy first for rhythm */}
        <div className="order-2 lg:order-1 relative">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 to-accent/15 blur-3xl" />
          <div className="rounded-3xl border border-primary/30 bg-card shadow-2xl overflow-hidden">
            {/* Voice prompt at top */}
            <div className="px-4 py-3 border-b border-border/60 bg-gradient-to-r from-primary/10 to-energy/10 flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-energy/20 flex items-center justify-center">
                <Mic className="h-3.5 w-3.5 text-energy" />
              </div>
              <p className="text-[11px] text-foreground italic leading-snug">"Aurora SS26 — 3-day shoot, 4 looks, need a DP and 2 stylists, deliver Mar 14."</p>
            </div>
            {/* Brief */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground">Brief · drafted by Thrive</p>
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                Editorial fashion shoot · 3 days · 4 looks (denim, eveningwear, athleisure, swim).
                Crew: <strong>1 DP, 2 stylists, 1 MUA, 1 PA</strong>. Delivery: 14 March, color-graded stills + 30s reel.
              </p>
            </div>
            {/* Tasks */}
            <div className="p-4 border-b border-border/50">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground mb-2">Tasks · auto-generated</p>
              <ul className="space-y-2">
                {[
                  { done: true, label: "Lock location · Eko Atlantic" },
                  { done: false, label: "Confirm DP rate", assignee: "You" },
                  { done: false, label: "Send call sheet to crew", assignee: "Thrive draft ready" },
                  { done: false, label: "Approve moodboard v2", assignee: "Maya · client" },
                ].map((t) => (
                  <li key={t.label} className="flex items-center gap-2.5">
                    {t.done ? (
                      <CheckCircle className="h-4 w-4 text-energy shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-primary shrink-0" />
                    )}
                    <span className={`text-xs flex-1 ${t.done ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                      {t.label}
                    </span>
                    {t.assignee && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                        {t.assignee}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {/* Vault */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground">Vault</p>
                </div>
                <span className="text-[10px] text-muted-foreground">12 files · 3 approvals pending</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {["from-primary/40 to-primary/10", "from-energy/40 to-energy/10", "from-accent/40 to-accent/10", "from-primary/30 to-primary/5", "from-energy/30 to-energy/5", "from-accent/30 to-accent/5"].map((g, i) => (
                  <div key={i} className={`aspect-square rounded-md bg-gradient-to-br ${g} border border-border/40`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="order-1 lg:order-2">
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-4 px-3 py-1 rounded-full border border-primary/30 bg-primary/5">
            <FileText className="h-3 w-3" /> Studios · Project OS
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.03em] leading-[1.05] text-foreground mb-4">
            Talk it out.<br />
            <span className="text-energy-glow">Thrive builds the studio.</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-5 max-w-md">
            One voice note becomes a real project — brief, task list, file vault, crew chat, money tracking. Built around how creatives actually run shoots, releases, campaigns, and events.
          </p>
          <ul className="space-y-2 mb-6">
            {[
              "Voice → brief → tasks in under 30 seconds",
              "Invite clients & crew with magic-link · no signup needed",
              "Studio rooms tuned for film, music, fashion, content & campaigns",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-foreground/90">
                <CheckCircle className="h-4 w-4 text-energy mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);
