/**
 * About — same cinematic language as the landing page: aurora, grain, scroll
 * reveals. Chapter titles use the exact same .landing-h2/.landing-glow
 * treatment as the hero's own .landing-h1 (brand Satoshi, weight 600, same
 * tracking/line-height/glow) -- chapters used to be set in a separate serif
 * face, which read as a different, older page bolted onto the hero rather
 * than one continuous surface. Kept short: what Kretopia is, the loop it
 * runs, the three people building it, and one invitation. No ThriveIN copy
 * — Kretopia only. Used to hardcode a permanent #05070D plate regardless of
 * theme (like the true guest landing page); now resolves --background like
 * every other feature surface, so it follows Dark/Light.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Fingerprint, ShieldCheck, Compass, LayoutGrid, Sparkles, Globe } from "lucide-react";
import { SEO } from "@/components/SEO";
import { EditorialPageHero } from "@/components/kretopia/EditorialPageHero";
import { Reveal } from "@/components/kretopia/Reveal";
import { KretoCharacter, type KretoCharacterVariant } from "@/components/brand/KretoCharacter";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const ACCENT = "#FF2DA1";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const PILLARS = [
  { icon: Fingerprint, title: "Creative Passport", body: "Your whole career on one link — credits, collaborators, co-signs." },
  { icon: ShieldCheck, title: "Verified Credits", body: "Every claim backed by evidence or the people who were there." },
  { icon: Compass, title: "Scout", body: "Gigs, briefs and casting calls matched to what you actually do." },
  { icon: LayoutGrid, title: "Studio", body: "One room per project — brief, files, chat, deliverables, payment." },
  { icon: Sparkles, title: "Kreto", body: "Your Executive Producer: reads your Passport, turns talk into action." },
  { icon: Globe, title: "One record, worldwide", body: "A creative in Port of Spain, Lagos or Paris is one search away." },
];

const LOOP_STEPS = ["Search", "Passport", "Trust", "Opportunity", "Studio", "Payment", "Stronger Passport"];

const FOUNDERS: {
  name: string;
  role: string;
  kretoVariant: KretoCharacterVariant;
  body: string;
}[] = [
  {
    name: "Ethan Auguste",
    role: "CEO",
    kretoVariant: "scout",
    body: "Spent a decade building the room before building the product — showcases, listening sessions and introductions across Dubai, Los Angeles, Trinidad, Geneva and Bali. He didn't guess what creatives needed; he was already in the room when they said it out loud.",
  },
  {
    name: "Jefferson Lenox Gordon",
    role: "CDO",
    kretoVariant: "connector",
    body: "Design and creative direction — really, the culture's own taste made legible in a product. Every screen answers one question: would this feel out of place next to the work it represents? Sharp, editorial, unmistakably built by creatives, not for them.",
  },
  {
    name: "Noé Plantier",
    role: "CTO",
    kretoVariant: "producer",
    body: "Engineering and AI — the unglamorous machinery underneath the whole promise. Verification, Scout, Kreto: turning a scattered, screenshot-and-DM creative history into something that's actually searchable, provable, and useful the moment someone needs it.",
  },
];

/** Full-bleed chapter plate — same surface + reveal as the landing chapters. */
const Chapter = ({
  index, kicker, title, accentWord, children,
}: {
  index: string; kicker: string; title: string; accentWord: string; children: React.ReactNode;
}) => {
  const reducedMotion = useReducedMotion();
  const titleId = `about-chapter-${index.toLowerCase()}-title`;
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: "hsl(var(--background))" }} aria-labelledby={titleId}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.13]"
        style={{ backgroundImage: GRAIN }}
      />
      <div className="relative mx-auto max-w-[1100px] px-5 sm:px-8 py-20 sm:py-28">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.2, 0.65, 0.3, 0.95] }}
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="font-serif italic text-2xl pink-glow-breathe" style={{ color: ACCENT }}>{index}.</span>
            <span className="landing-eyebrow" style={{ color: "hsl(var(--muted-foreground))" }}>{kicker}</span>
          </div>
          {/* Same landing-h2/landing-glow treatment as the hero's own
              landing-h1 -- brand Satoshi, weight 600, same tracking/
              line-height/glow, just the next size down. Used to be a
              separate serif face here, reading as a different page. */}
          <h2 id={titleId} className="landing-h2 landing-glow max-w-3xl" style={{ color: "hsl(var(--foreground))" }}>
            {title}{" "}
            <span className="landing-accent">{accentWord}</span>
          </h2>
        </motion.div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
};

const About = () => {
  const [loopRef, loopVisible] = useScrollReveal<HTMLDivElement>();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(var(--background))" }}>
      <SEO
        title="About Kretopia — The Creative Record, Built by Creatives"
        description="Kretopia turns creative history into trusted opportunity — verified credits, a Creative Passport, and one room per project, connecting artists worldwide."
      />

      <EditorialPageHero
        kicker="About Kretopia"
        oneLine
        subtitleOneLine
        title="Built for"
        accentTitle="creatives, everywhere."
        subtitle="Talent is everywhere. Opportunity isn't. We close the gap."
      />

      {/* I — What Kretopia is */}
      <Chapter index="I" kicker="The system" title="Your work, finally" accentWord="on the record.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delayIndex={i}>
              <div className="h-full rounded-2xl border border-border bg-foreground/[0.02] p-5 transition-colors hover:border-[rgba(255,45,161,0.35)]">
                <span
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(255,45,161,0.1)" }}
                >
                  <p.icon className="h-4 w-4" style={{ color: ACCENT }} />
                </span>
                <p className="text-foreground font-semibold text-sm mb-1.5">{p.title}</p>
                <p className="text-sm leading-relaxed text-foreground/55">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Chapter>

      {/* II — The loop */}
      <Chapter index="II" kicker="The loop" title="One cycle that keeps" accentWord="compounding.">
        <div ref={loopRef} className="flex flex-wrap items-center gap-x-1 gap-y-3">
          {LOOP_STEPS.map((step, i) => (
            <span key={step} className="flex items-center">
              <span
                className="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs sm:text-sm font-medium text-foreground/85 transition-all duration-500"
                style={{
                  opacity: loopVisible ? 1 : 0,
                  transform: loopVisible ? "none" : "translateY(6px)",
                  transitionDelay: `${i * 90}ms`,
                  borderColor: "rgba(255,45,161,0.25)",
                  backgroundColor: "hsl(var(--foreground) / 0.02)",
                }}
              >
                {step}
              </span>
              {i < LOOP_STEPS.length - 1 && (
                <ChevronRight className="mx-0.5 h-3.5 w-3.5" style={{ color: "rgba(255,45,161,0.5)" }} aria-hidden />
              )}
            </span>
          ))}
        </div>
        <Reveal delayIndex={2}>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-foreground/60">
            Every finished project makes the next one easier to win. That is the whole product — proof in, opportunity out.
          </p>
        </Reveal>
      </Chapter>

      {/* III — The founders */}
      <Chapter index="III" kicker="The founders" title="Three people, one" accentWord="obsession.">
        <div className="grid gap-4 md:grid-cols-3">
          {FOUNDERS.map((f, i) => (
            <Reveal key={f.name} delayIndex={i}>
              <div className="h-full rounded-2xl border border-border bg-foreground/[0.02] p-6 transition-colors hover:border-[rgba(255,45,161,0.35)]">
                <KretoCharacter variant={f.kretoVariant} size={56} floatAmplitude={0} className="mb-5" />
                <p className="text-foreground font-semibold">{f.name}</p>
                <p className="landing-eyebrow mb-3" style={{ color: ACCENT }}>{f.role}</p>
                <p className="text-sm leading-relaxed text-foreground/55">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delayIndex={3}>
          <p className="mt-10 max-w-2xl font-serif italic text-lg leading-relaxed text-foreground/80">
            "A community person, a designer and an engineer building the same thing: a place where what a creative
            has actually done travels with them — across cities, industries and borders."
          </p>
        </Reveal>
      </Chapter>

    </div>
  );
};

export default About;
