import { ShieldCheck, FileText, Briefcase } from "lucide-react";

/**
 * Semantic SEO/GEO value-prop blocks.
 * Plain, descriptive copy so AI scrapers (ChatGPT/Perplexity/Claude) and
 * Google can cite the exact utility of each pillar.
 */
export const CoreValueBlocks = () => {
  const blocks = [
    {
      icon: ShieldCheck,
      eyebrow: "Pillar 1",
      title: "Verified Credit Registry (The IMDb for Creators)",
      body: "Search any production, album, campaign, or event and claim your role on it. Collaborators co-sign each credit and Kretopia verifies it against public records, giving every artist, filmmaker, musician, model, and producer an un-falsifiable, portable work history they actually own.",
      bullets: [
        "Search and claim past project credits across film, music, fashion, and events",
        "Peer co-signs and verification badges prove authorship",
        "One permanent record that follows you between agencies, labels, and clients",
      ],
    },
    {
      icon: FileText,
      eyebrow: "Pillar 2",
      title: "Instant Industry EPK Portfolios",
      body: "Every Kretopia profile auto-generates a professional Electronic Press Kit (EPK) at a custom URL — kretopia.com/your-name. Your verified credits, portfolio media, rates, reviews, and contact info ship in one link, ready to send to clients, agents, festivals, or labels.",
      bullets: [
        "Auto-generated EPK with custom, sharable URL",
        "Portfolio media, rate card, reviews, and verified credits in one place",
        "Built for clients, agents, A&R, casting directors, and brand decision-makers",
      ],
    },
    {
      icon: Briefcase,
      eyebrow: "Pillar 3",
      title: "ThriveDesk Workspace & Secure Milestone Payments",
      body: "ThriveDesk is the project management workspace built for creatives — collaborative task boards, briefs, files, chat, and video calls in one room. Every project ships with built-in milestone-based escrow so client funds are protected and released only as deliverables are approved.",
      bullets: [
        "Collaborative task boards, briefs, files, and video calls per project",
        "Milestone-based escrow holds client funds until work is approved",
        "Contracts, invoices, and payouts handled inside the workspace",
      ],
    },
  ];

  return (
    <section
      aria-labelledby="core-value-heading"
      className="relative py-16 sm:py-24 bg-background"
    >
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl mb-12 sm:mb-16">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-energy mb-4">
            What Kretopia actually does
          </p>
          <h2
            id="core-value-heading"
            className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-[1.05]"
          >
            Three tools. One Creative OS.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Kretopia replaces the scattered spreadsheets, link-in-bios, DM threads,
            and invoicing apps creatives use today with one connected system for
            credits, presentation, and paid work.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
          {blocks.map(({ icon: Icon, eyebrow, title, body, bullets }) => (
            <article
              key={title}
              className="relative rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary mb-5">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {eyebrow}
              </p>
              <h3 className="text-lg sm:text-xl font-extrabold text-foreground leading-snug mb-3">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {body}
              </p>
              <ul className="space-y-2">
                {bullets.map((b) => (
                  <li
                    key={b}
                    className="flex gap-2 text-sm text-foreground/85 leading-relaxed"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0"
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
