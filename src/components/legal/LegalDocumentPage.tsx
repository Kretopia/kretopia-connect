import { useEffect, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { KretoScene } from "@/components/brand/KretoScene";
import type { KretoSceneId } from "@/components/brand/kretoScenes";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { OutlineCta } from "@/components/ui/glass-cta";
import { WrappedShell } from "@/components/wrapped/WrappedShell";
import { WrappedStatus } from "@/components/wrapped/WrappedStatus";
import type { LegalBlock, LegalDocument, LegalPart } from "@/content/legal/types";
import { cn } from "@/lib/utils";

const LEGAL_PAGES = [
  { to: "/terms", label: "Terms", slug: "terms" },
  { to: "/privacy", label: "Privacy", slug: "privacy" },
  { to: "/community-guidelines", label: "Guidelines", slug: "guidelines" },
] as const;

const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function scrollToSection(id: string, updateUrl: boolean) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  if (updateUrl) window.history.replaceState(window.history.state, "", `#${id}`);
}

const Parts = ({ parts }: { parts: LegalPart[] }) => (
  <>
    {parts.map((part, i) =>
      typeof part === "string" ? (
        <span key={i}>{part}</span>
      ) : (
        <strong key={i} className="font-semibold text-foreground">
          {part.strong}
        </strong>
      ),
    )}
  </>
);

const Block = ({ block }: { block: LegalBlock }) => {
  if (block.type === "p") {
    return (
      <p>
        <Parts parts={block.content} />
      </p>
    );
  }
  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground/60">
        {block.items.map((item, i) => (
          <li key={i}>
            <Parts parts={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="rounded-r-xl border-l-2 border-foreground/50 bg-muted/40 px-4 py-3">
      <p className="font-semibold text-foreground">{block.cap}</p>
      <p>{block.text}</p>
    </div>
  );
};

interface LegalDocumentPageProps {
  doc: LegalDocument;
  /** The Kreto scene beside the panel title. */
  scene: KretoSceneId;
}

/**
 * A legal document on the frame every public Kretopia page wears (About, Spotlight, Events): the shared
 * cinematic header, the Studio body width and one Wrapped panel. The text comes from `doc` untouched; this
 * only lays it out: an index of its sections, then each section as a numbered row, then the three legal pages.
 */
export function LegalDocumentPage({ doc, scene }: LegalDocumentPageProps) {
  const { hash } = useLocation();

  // A link that arrives with #s05 lands on that section once the page is laid out.
  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    const frame = requestAnimationFrame(() => scrollToSection(id, false));
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  const onIndexClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    scrollToSection(id, true);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`${doc.name} — Kretopia`} description={doc.seoDescription} />
      <FeaturePageHeader compact eyebrow={doc.name} title={doc.title} accentTitle={doc.accentTitle} subtitle={doc.subtitle} />

      <StudioFeatureShell>
        <WrappedShell
          titleId={`${doc.slug}-title`}
          eyebrow={`Kretopia · ${doc.name}`}
          title={
            <>
              {doc.panelHeading.before}
              <span className="k-gradient-text">{doc.panelHeading.accent}</span>
            </>
          }
          status={<WrappedStatus active={false} label={doc.updated} />}
          aside={<KretoScene scene={scene} size="thumb" className="hidden h-16 w-32 shrink-0 rounded-xl border border-border sm:block" />}
        >
          <nav aria-label={`${doc.name}: sections`}>
            {/* One scrolling row on a phone, so fifteen sections do not push the text below the fold; wrapped from `sm`. */}
            <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
              {doc.sections.map((section) => (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    onClick={(event) => onIndexClick(event, section.id)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
                  >
                    {section.title}
                    <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-border">
            {doc.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="grid scroll-mt-24 gap-3 border-b border-border py-7 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:gap-10"
              >
                <header>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">{section.num}</p>
                  <h3 id={`${section.id}-title`} className="mt-2 text-lg font-semibold leading-snug text-foreground">
                    {section.title}
                  </h3>
                </header>
                <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="space-y-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{doc.closing.eyebrow}</p>
            <h3 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">
              {doc.closing.heading.before}
              <span className="k-gradient-text">{doc.closing.heading.accent}</span>
            </h3>
            <div className="mx-auto grid max-w-md grid-cols-1 gap-3 sm:grid-cols-3">
              {LEGAL_PAGES.map((page) => (
                <OutlineCta
                  key={page.slug}
                  to={page.to}
                  size="sm"
                  aria-current={page.slug === doc.slug ? "page" : undefined}
                  className={cn("min-h-11 w-full sm:min-h-0", page.slug === doc.slug && "bg-muted/50")}
                >
                  {page.label}
                </OutlineCta>
              ))}
            </div>
          </div>
        </WrappedShell>
      </StudioFeatureShell>
    </div>
  );
}

export default LegalDocumentPage;
