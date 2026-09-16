import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-6">
    <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
    <div className="text-sm leading-relaxed">{children}</div>
  </section>
);

export default function FounderKitOnePager() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10 print:py-4">
      <Helmet>
        <title>Kretopia · One-pager</title>
        <meta name="description" content="Kretopia at a glance — agentic OS for the creator economy." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Founder Kit · One-pager</p>
        <h1 className="font-serif text-4xl md:text-5xl mt-1 leading-tight">
          The Operating System for Creative Careers.
        </h1>
        <p className="text-base text-muted-foreground mt-3">
          Always-on agentic AI for the global creator economy — born in Trinidad & Tobago, deployable worldwide.
        </p>
      </header>

      <Card className="p-6 md:p-8 space-y-6">
        <Section title="Problem">
          Creative work is non-linear, multi-stakeholder, and admin-heavy. Creators lose ~30% of working hours
          chasing credits, drafting proposals, scouting gigs, vouching, and invoicing — bottlenecks that LinkedIn,
          IMDb, Upwork and Fiverr were never built to solve. In emerging markets the cost is even higher: invisible
          credits, ghosted gigs, late or no payments.
        </Section>

        <Section title="Solution — an Agentic Creative OS">
          Kretopia is one product with five always-on agents on top of a verified Creative Passport:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><b>Desk-Agent</b> watches every project and proposes the next step.</li>
            <li><b>Smart Gig Scout</b> finds and drafts real gigs across web, LinkedIn, IG, ATS.</li>
            <li><b>Sponsor Radar</b> surfaces brand-fit sponsor leads.</li>
            <li><b>Pricing Co-Pilot</b> drafts quotes from memory of past rates and clients.</li>
            <li><b>Studio Brain</b> ingests any drop (PDF / image / voice / link) into structured project memory.</li>
          </ul>
        </Section>

        <Section title="Why agentic, why now">
          LLM tool-calling is the first technology that absorbs the creator's operational tax at solo-proprietor
          unit economics. Kretopia runs on Lovable AI Gateway across Gemini Pro / 2.5 Flash / 2.5 Flash Lite, with a
          per-tool registry, daily caps, and tool-calling memory.
        </Section>

        <Section title="Traction">
          See live: <a className="underline" href="/founder-kit/metrics">/founder-kit/metrics</a> · Live agent log:{" "}
          <a className="underline" href="/agents">/agents</a>
        </Section>

        <Section title="Caribbean roots, global deploy">
          We start in Trinidad because the problem is sharpest here and the cultural export per capita is among the
          highest on earth. Every feature we ship for Port-of-Spain ships for Lagos, Kingston, Manila and Bogotá.
        </Section>

        <Section title="The ask">
          Compute + capital + curriculum to harden the agentic layer, train a creative-economy reasoning model on
          the anonymised credit graph, and convert traction into a priced seed round.
        </Section>
      </Card>

      <div className="text-xs text-muted-foreground mt-6 flex justify-between">
        <span>kretopia.com</span>
        <span>Built for Future Caribbean · Bridge for Billions · Founder Institute</span>
      </div>
    </div>
  );
}
