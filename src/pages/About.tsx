import { useState } from "react";
import { Fingerprint, ShieldCheck, Compass, LayoutGrid, Sparkles, Globe, ChevronRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { aboutTutorial } from "@/components/features/publicFeatureTutorials";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { KretoScene } from "@/components/brand/KretoScene";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  kretoVariant: "scout" | "connector" | "producer";
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

const About = () => {
  const [tab, setTab] = useState("system");
  return (
    <div className="min-h-screen bg-background">
      <SEO title="About Kretopia — The Creative Record, Built by Creatives" description="Kretopia turns creative history into trusted opportunity — verified credits, a Creative Passport, and one room per project, connecting artists worldwide." />
      <FeaturePageHeader compact eyebrow="About Kretopia" title="Built for" accentTitle="creatives, everywhere" subtitle="Talent is everywhere. Opportunity isn't. We close the gap." tutorial={{ featureKey: "about", label: "How Kretopia works", steps: aboutTutorial }} />
      <StudioFeatureShell>
        <WrappedShell titleId="about-overview" eyebrow="Kretopia" title={<>The creative <span className="k-gradient-text">record</span></>} aside={<KretoScene scene="studio" size="thumb" className="hidden h-16 w-32 rounded-xl border border-border sm:block" />}>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid h-11 w-full grid-cols-3">
              <TabsTrigger value="system">The system</TabsTrigger>
              <TabsTrigger value="loop">The loop</TabsTrigger>
              <TabsTrigger value="team">The team</TabsTrigger>
            </TabsList>
            <TabsContent value="system" className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PILLARS.map((p) => <div key={p.title} className="flex items-start gap-3 border-b border-border pb-4"><p.icon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" /><div><h3 className="text-sm font-semibold text-foreground">{p.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p></div></div>)}
              </div>
            </TabsContent>
            <TabsContent value="loop" className="mt-4 space-y-4">
              <ol className="flex flex-wrap items-center gap-3">{LOOP_STEPS.map((step, i) => <li key={step} className="flex items-center gap-3 text-sm font-medium text-foreground"><span>{step}</span>{i < LOOP_STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />}</li>)}</ol>
              <p className="text-sm leading-relaxed text-muted-foreground">Every finished project makes the next one easier to win. That is the whole product — proof in, opportunity out.</p>
            </TabsContent>
            <TabsContent value="team" className="mt-4">
              <div className="grid gap-5 md:grid-cols-3">{FOUNDERS.map((f) => <article key={f.name} className="space-y-2"><h3 className="font-semibold text-foreground">{f.name}</h3><p className="text-xs font-semibold text-muted-foreground">{f.role}</p><p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p></article>)}</div>
            </TabsContent>
          </Tabs>
        </WrappedShell>
      </StudioFeatureShell>
    </div>
  );
};
export default About;
