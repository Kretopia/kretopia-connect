/* KRETOPIA_LEGAL_INSTITUTIONAL_V2
   Presentation only. Legal content remains in src/content/legal.
   No cinematic effects, decorative mascots or altered wording.
*/
import { useEffect, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";

import { SEO } from "@/components/SEO";

import type { KretoSceneId } from "@/components/brand/kretoScenes";
import type {
  LegalBlock,
  LegalDocument,
  LegalPart,
} from "@/content/legal/types";
import { toRoman } from "@/lib/toRoman";

const LEGAL_PAGES = [
  { to: "/terms", label: "Terms", slug: "terms" },
  { to: "/privacy", label: "Privacy", slug: "privacy" },
  {
    to: "/community-guidelines",
    label: "Community",
    slug: "community",
  },
] as const;

function scrollToSection(id: string, updateUrl: boolean) {
  const target = document.getElementById(id);
  if (!target) return;

  target.scrollIntoView({
    behavior: "auto",
    block: "start",
  });

  if (updateUrl) {
    window.history.replaceState(
      window.history.state,
      "",
      `#${id}`,
    );
  }
}

function Parts({ parts }: { parts: LegalPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <strong
            key={index}
            className="font-semibold text-foreground"
          >
            {part.strong}
          </strong>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "p") {
    return (
      <p>
        <Parts parts={block.content} />
      </p>
    );
  }

  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-2 pl-5 marker:text-foreground/70">
        {block.items.map((item, index) => (
          <li key={index}>
            <Parts parts={item} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="rounded-r-sm border-l-2 border-border bg-muted/20 px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="mb-1.5 text-[15px] font-semibold leading-6 text-foreground">
        {block.cap}
      </p>
      <p>{block.text}</p>
    </div>
  );
}

interface LegalDocumentPageProps {
  doc: LegalDocument;
  /** Retained for compatibility with existing page routes. */
  scene?: KretoSceneId;
}

export function LegalDocumentPage({
  doc,
}: LegalDocumentPageProps) {
  const { hash } = useLocation();

  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;

    const frame = requestAnimationFrame(() =>
      scrollToSection(id, false),
    );

    return () => cancelAnimationFrame(frame);
  }, [hash]);

  const onIndexClick = (
    event: MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    event.preventDefault();
    scrollToSection(id, true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={`${doc.name} — Kretopia`}
        description={doc.seoDescription}
      />

      <header className="mx-auto max-w-5xl px-5 pb-12 pt-14 text-center sm:px-8 sm:pb-14 sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
          {doc.name}
        </p>

        <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {doc.title}{" "}
          <span className="text-foreground">
            {doc.accentTitle}
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-[66ch] text-base leading-7 text-foreground/80">
          {doc.subtitle}
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        <article className="rounded-2xl border border-border bg-card px-5 py-8 sm:px-9 sm:py-11 lg:px-12">
          <header className="border-b border-border pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/75">
              Kretopia · {doc.name}
            </p>

            <h2
              id={`${doc.slug}-title`}
              className="mt-3 max-w-none text-xl font-semibold leading-snug sm:text-2xl"
            >
              {doc.panelHeading.before}
              <span>{doc.panelHeading.accent}</span>
            </h2>

            <p className="mt-4 text-sm text-foreground/80">
              {doc.updated}
            </p>
          </header>

          <nav
            aria-label={`${doc.name}: sections`}
            className="border-b border-border py-8"
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/80">
              Contents
            </p>

            <ol
              className={`grid grid-flow-row gap-x-12 gap-y-1.5 sm:grid-cols-2 sm:grid-flow-col ${
                doc.sections.length <= 8
                  ? "sm:grid-rows-4"
                  : "sm:grid-rows-8"
              }`}
            >
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={(event) =>
                      onIndexClick(event, section.id)
                    }
                    className="flex min-h-11 items-baseline gap-3 rounded-md px-2 py-2 text-[15px] leading-6 text-foreground/90 hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden="true"
                      className="w-9 shrink-0 font-semibold text-foreground/85"
                    >
                      {toRoman(Number(section.num))}
                    </span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div>
            {doc.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="scroll-mt-24 border-b border-border py-9 sm:py-11"
              >
                <h3
                  id={`${section.id}-title`}
                  className="flex items-baseline gap-3 text-xl font-semibold leading-snug text-foreground sm:text-[22px]"
                >
                  <span
                    aria-hidden="true"
                    className="w-9 shrink-0 text-base font-semibold text-foreground/85"
                  >
                    {toRoman(Number(section.num))}
                  </span>
                  <span className="min-w-0">
                    {section.title}
                  </span>
                </h3>

                <div className="mt-6 max-w-[70ch] space-y-5 text-base leading-[1.75] text-foreground/90 sm:ml-12">
                  {section.blocks.map((block, index) => (
                    <Block key={index} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="pt-10">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/75">
                {doc.closing.eyebrow}
              </p>

              <h2 className="mt-4 text-xl font-semibold leading-snug sm:text-2xl">
                {doc.closing.heading.before}
                <span>{doc.closing.heading.accent}</span>
              </h2>
            </div>

            <nav
              aria-label="Related documents"
              className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
            >
              {LEGAL_PAGES.map((page) => (
                <Link
                  key={page.slug}
                  to={page.to}
                  aria-current={
                    page.slug === doc.slug ? "page" : undefined
                  }
                  className={
                    "text-sm no-underline hover:no-underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (
                      page.slug === doc.slug
                        ? "font-semibold text-foreground"
                        : "text-foreground/90"
                    )
                  }
                >
                  {page.label}
                </Link>
              ))}
            </nav>

            <div className="mt-10 flex justify-center border-t border-border pt-6">
              <span
                role="img"
                aria-label="Kretopia"
                className="inline-flex items-center gap-2"
              >
                <img
                  src="/brand/kretopia-identity/mark/kretopia-mark-transparent.webp"
                  alt=""
                  aria-hidden="true"
                  className="h-7 w-7 object-contain"
                />
                <img
                  src="/brand/kretopia-identity/wordmark/kretopia-wordmark-white-transparent.webp"
                  alt=""
                  aria-hidden="true"
                  className="hidden h-5 w-auto object-contain dark:block"
                />
                <img
                  src="/brand/kretopia-identity/wordmark/kretopia-wordmark-black-transparent.webp"
                  alt=""
                  aria-hidden="true"
                  className="block h-5 w-auto object-contain dark:hidden"
                />
              </span>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}

export default LegalDocumentPage;
