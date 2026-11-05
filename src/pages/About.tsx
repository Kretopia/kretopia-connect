import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";
import { GlassCta } from "@/components/ui/glass-cta";
import "./About.css";

/**
 * About V4 — the user's approved visual reference, not a landing-page remake.
 * Exactly three editorial sections, with a visual opening and footer.
 * The reference artwork is cropped from the approved screenshot and lives only
 * in public/about-reference; original real founder photos stay in place.
 */
const FOUNDERS = [
  {
    id: "noe",
    name: "Noé Plantier",
    role: "Co-founder & Chief Technology Officer",
    fields: ["Engineering", "Architecture", "Technology"],
    photo: "/about-founders/noe.jpg",
    initials: "NP",
    kreto: "/about-reference/kreto-noe.png",
    description:
      "Noé turns ideas into reliable technology. He leads Kretopia's technical architecture and engineering, making complex systems work together without making them difficult to use.",
  },
  {
    id: "ethan",
    name: "Ethan Auguste",
    role: "Founder & Chief Executive Officer",
    fields: ["Creative business", "Partnerships", "Community"],
    photo: "/about-founders/ethan.jpg",
    initials: "EA",
    kreto: "/about-reference/kreto-ethan.png",
    description:
      "Ethan brings experience across creative industries and international communities. He leads Kretopia's vision, business direction and partnerships, connecting the work to the people behind it.",
  },
  {
    id: "jefferson",
    name: "Jefferson Gordon-Lennox",
    role: "Co-founder & Chief Product Officer",
    fields: ["Product", "Creative practice", "Experience"],
    photo: "/about-founders/jefferson.jpg",
    initials: "JG",
    kreto: "/about-reference/kreto-jefferson.png",
    description:
      "An artist, writer and publisher, Jefferson brings the perspective of a working creative. He leads product direction and user experience, grounding Kretopia in how people actually create and collaborate.",
  },
] as const;

function Reveal({ children, className = "", delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reduced ? 0 : 0.32, ease: "easeOut", delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

function Portrait({ name, src, initials }: { name: string; src: string; initials: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="k-about__portrait">
      {failed ? (
        <span aria-label={name} className="k-about__initials">{initials}</span>
      ) : (
        <img
          alt={name}
          src={src}
          width={100}
          height={100}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function SectionLabel({ number, children }: { number: string; children: ReactNode }) {
  return (
    <p className="landing-eyebrow k-about__section-label">
      <span className="k-about__number">{number}</span>
      {children}
    </p>
  );
}

const About = () => (
  <div className="k-about">
    <SEO
      title="Behind Kretopia — Meet the Founders"
      description="Meet Noé, Ethan and Jefferson: three perspectives shaping the team behind Kretopia."
    />

    <header className="k-about__hero" aria-labelledby="about-title">
      <div className="k-about__container k-about__hero-layout">
        <Reveal className="k-about__hero-copy">
          <p className="landing-eyebrow k-about__eyebrow">Our story / The people behind the work</p>
          <h1 id="about-title" className="k-about__h1">
            Behind <span className="k-gradient-text">Kretopia.</span>
          </h1>
          <p className="k-about__lead">Three different paths. One shared purpose.</p>
          <p className="landing-sub k-about__intro">
            Kretopia is shaped by the people building it and the experiences they bring together.
          </p>
          <a href="#founders" className="k-about__jump">
            Meet the founders <ArrowDown size={17} aria-hidden="true" />
          </a>
        </Reveal>
        <div className="k-about__hero-art" aria-hidden="true">
          <img src="/about-reference/kreto-hero.webp" alt="" width="419" height="311" decoding="async" />
        </div>
      </div>
    </header>

    <section className="k-about__section k-about__story-section" aria-labelledby="story-title">
      <div className="k-about__container k-about__story">
        <div className="k-about__story-art" aria-hidden="true">
          <img src="/about-reference/kreto-story.webp" alt="" loading="lazy" width="355" height="254" decoding="async" />
        </div>
        <Reveal className="k-about__story-copy">
          <SectionLabel number="01">How we came together</SectionLabel>
          <h2 id="story-title" className="landing-h2 k-about__heading">
            Different backgrounds.<br />
            <span className="k-gradient-text">A shared perspective.</span>
          </h2>
          <p className="k-about__body">
            Creative business. Engineering. Artistic practice. Each of us came to Kretopia with a different understanding of the creative world. Together, those perspectives help us question assumptions, solve problems and build something more grounded in real experience.
          </p>
        </Reveal>
      </div>
    </section>

    <section id="founders" className="k-about__section k-about__founders" aria-labelledby="founders-title">
      <div className="k-about__container">
        <Reveal className="k-about__founder-heading">
          <SectionLabel number="02">The people behind Kretopia</SectionLabel>
          <h2 id="founders-title" className="landing-h2 k-about__heading">
            Meet the <span className="k-gradient-text">founders.</span>
          </h2>
        </Reveal>
        <div className="k-about__founder-grid">
          {FOUNDERS.map((founder, index) => (
            <Reveal
              key={founder.id}
              className={`k-about__founder-slot k-about__founder-slot--${founder.id}`}
              delay={index * 0.06}
            >
              {/* Each Kreto belongs to its own card. Only its position changes. */}
              <div className={`k-about__founder-kreto k-about__founder-kreto--${founder.id}`} aria-hidden="true">
                <img src={founder.kreto} alt="" width={238} height={116} loading="lazy" decoding="async" />
              </div>
              <article className="k-about__founder-card">
                <Portrait name={founder.name} src={founder.photo} initials={founder.initials} />
                <p className="k-about__founder-label">Founding team</p>
                <h3 className="k-about__founder-name">{founder.name}</h3>
                <p className="k-about__founder-role">{founder.role}</p>
                <ul className="k-about__founder-fields" aria-label={`${founder.name} areas of expertise`}>
                  {founder.fields.map((field) => <li key={field}>{field}</li>)}
                </ul>
                <p className="k-about__founder-description">{founder.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal className="k-about__founder-closing">
          Three disciplines. A common commitment to building thoughtfully, and to keeping the creative people behind the work in focus.
        </Reveal>
      </div>
    </section>

    <section className="k-about__section k-about__future-section" aria-labelledby="future-title">
      <div className="k-about__container k-about__future">
        <div className="k-about__future-art" aria-hidden="true">
          <img src="/about-reference/kreto-future.webp" alt="" width="344" height="239" loading="lazy" decoding="async" />
        </div>
        <Reveal className="k-about__future-copy">
          <SectionLabel number="03">What comes next</SectionLabel>
          <h2 id="future-title" className="landing-h2 k-about__heading">
            Still building. <span className="k-gradient-text">Still learning.</span>
          </h2>
          <p className="k-about__body">
            Kretopia is a work in progress. We'll keep refining it through experience, conversations and the people who make creative work possible.
          </p>
          <div className="k-about__actions">
            <GlassCta to="/auth?tab=signup" size="md">Join Kretopia</GlassCta>
            <Link className="k-about__outline-cta" to="/contact">
              Get in touch <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>

    <EditorialFooter />
  </div>
);

export default About;
