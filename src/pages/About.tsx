import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";
import { Link as AboutJoinLink } from "react-router-dom";
import { HoloCard } from "@/components/passport/HoloCard";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { useState, type ReactNode } from "react";

import { motion, useReducedMotion } from "framer-motion";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";

import "./About.css";

const FOUNDERS = [
  {
    id: "noe",
    name: "Noé Plantier",
    role: "Co-founder & Chief Technology Officer",
    fields: ["Engineering", "Architecture", "Technology"],
    photo: "/about/founders/noe-plantier.webp",
    initials: "NP",
    kreto: "/about-reference/kreto-noe.png",
    description: [
      "Noé leads Kretopia's technical architecture and engineering. His focus is on turning complex ideas into reliable, connected systems that remain intuitive and accessible to the people using them.",
    ],
  },
  {
    id: "ethan",
    name: "Ethan Auguste",
    role: "Founder & Chief Executive Officer",
    fields: ["Creative Economy", "Partnerships", "Community"],
    photo: "/about/founders/ethan-auguste.webp",
    initials: "EA",
    kreto: "/about-reference/kreto-ethan-networker.png",
    description: [
      "With over twenty years of experience across creative industries and international communities, Ethan brings an understanding of the people, relationships, and opportunities shaping creative careers.",
      "He leads Kretopia's vision, business direction, and partnerships, connecting the project with the wider creative ecosystem.",
    ],
  },
  {
    id: "jefferson",
    name: "Jefferson Gordon-Lennox",
    role: "Co-founder & Chief Product Officer",
    fields: ["Product", "Creative Direction", "Experience"],
    photo: "/about/founders/jefferson-gordon-lennox.webp",
    initials: "JG",
    kreto: "/about-reference/kreto-jefferson.png",
    description: [
      "A multidisciplinary artist, writer, and publisher, Jefferson brings the perspective of someone actively engaged in creative practice.",
      "He leads Kretopia's product direction and user experience, drawing on his artistic background to connect thoughtful design, practical functionality, and the realities of creative work.",
    ],
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
      <span className="k-about__number">{number} /</span> {children}
    </p>
  );
}


const ABOUT_PUBLIC_TUTORIAL = [
  {
    title: "Our story",
    body: "Discover the perspectives and experiences behind Kretopia."
  },
  {
    title: "Meet the founders",
    body: "Explore the three founding profiles, their expertise and their roles."
  },
  {
    title: "Continue the conversation",
    body: "Contact the team or join Kretopia through the links on this page."
  }
];

const About = () => (
  <div className="k-about landing-theme">
    <SEO
      title="Behind Kretopia — Meet the Founders"
      description="Meet Noé, Ethan and Jefferson: three perspectives shaping the team behind Kretopia."
    />


      <FeaturePageHeader
        eyebrow="OUR STORY / THE PEOPLE BEHIND THE WORK"
        title="Behind"
        accentTitle="Kretopia."
        subtitle="Three different paths. One shared purpose."
        tabs={

    <div className="flex w-full justify-center">
      <a
            href="#founders"
            className="k-about__founders-jump"
            onClick={() => requestAnimationFrame(() => {
              document.getElementById("founders-title")?.focus({ preventScroll: true });
            })}
          >
            Meet the founders
            <KretopiaIcon name="arrow-down" size={17} aria-hidden="true" />
          </a>
    </div>

        }

        tutorial={{ featureKey: "public-about", label: "How About works", steps: ABOUT_PUBLIC_TUTORIAL }}
      />

    <section className="k-about__section" aria-labelledby="story-title">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 k-about__container">
        <Reveal className="k-about__text-layout">
          <div>
            <SectionLabel number="01">OUR PERSPECTIVES</SectionLabel>
            <h2 id="story-title" className="landing-h2 k-about__heading">
              Different experiences. <span className="block">A broader understanding.</span>
            </h2>
          </div>
          <div className="k-about__copy">
            <div className="k-about__body">
              <p>Creative business. Engineering. Artistic practice.</p>
              <p>Each brings a different perspective to Kretopia.</p>
              <p>Understanding the creative industry means knowing its people and relationships. Building reliable technology means turning complex ideas into practical experiences. And designing for creatives means recognising the realities of their work.</p>
              <p>These perspectives shape how we approach the decisions, challenges, and opportunities ahead.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>

    <section id="founders" className="k-about__section k-about__founders" aria-labelledby="founders-title">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 k-about__container">
        <Reveal>
          <SectionLabel number="02">MEET THE FOUNDERS</SectionLabel>
          <h2 id="founders-title" tabIndex={-1} className="landing-h2 k-about__heading">
            The people behind Kretopia.
          </h2>
        </Reveal>
        <div className="k-about__founder-grid">
          {FOUNDERS.map((founder, index) => (
            <Reveal key={founder.id} className="k-about__founder-slot" delay={index * 0.06}>
              <HoloCard glow={true} maxTilt={2} className="h-full w-full">
<Card role="article" aria-labelledby={`founder-${founder.id}`} className={`k-about__founder-card k-about__founder-card--${founder.id}`}>

                <Portrait name={founder.name} src={founder.photo} initials={founder.initials} />
                <p className="k-about__founder-label">FOUNDING TEAM</p>
                <h3 id={`founder-${founder.id}`} className="k-about__founder-name">{founder.name}</h3>
                <p className="k-about__founder-role">{founder.role}</p>
                <ul className="k-about__founder-fields" aria-label={`${founder.name} areas of expertise`}>
                  {founder.fields.map((field) => <li key={field}>{field}</li>)}
                </ul>
                <div className="k-about__founder-description">
                  {founder.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </Card>
</HoloCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="k-about__section" aria-labelledby="future-title">
      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12 k-about__container">
        <Reveal className="k-about__text-layout">
          <div>
            <SectionLabel number="03">WHAT COMES NEXT</SectionLabel>
            <h2 id="future-title" className="landing-h2 k-about__heading">
              Still <span className="k-gradient-text">building.</span> Always <span className="k-gradient-text">learning.</span>
            </h2>
          </div>
          <div className="k-about__copy">
            <div className="k-about__body">
              <p>Kretopia is still evolving, and so are we.</p>
              <p>We'll continue to question our assumptions, learn from experience, and refine what we build alongside the people it is intended to serve.</p>
              <p>There's more to explore, more to understand, and more to create.</p>
            </div>

    <div className="k-about__actions">
      <AboutJoinLink
        to="/contact"
        className="k-nav-signin inline-flex items-center justify-center"
      >
        Get in Touch
      </AboutJoinLink>
      <AboutJoinLink
        to="/auth?tab=signup"
        className="k-nav-join inline-flex items-center justify-center"
      >
        Join Kretopia
      </AboutJoinLink>
    </div>

          </div>
        </Reveal>
      </div>
    </section>

    <EditorialFooter />
  </div>
);

export default About;
