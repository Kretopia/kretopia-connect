/**
 * KretopiaHero — Section 1 of the Kretopia landing page.
 *
 * Search behavior:
 * - UnifiedSearchDropdown remains the single source of truth for searching
 *   people, opportunities, and creative work.
 * - The hero never runs a duplicate Supabase query.
 * - When the dropdown confirms a completed search with zero public results,
 *   the hero shows a styled, non-blocking Kretopia "Create your project"
 *   invitation below the input.
 * - No result state is not shown while the user is typing, loading, or when
 *   the query is too short.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, FolderPlus, SearchX, Sparkles, X } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { UnifiedSearchDropdown } from "@/components/search/UnifiedSearchDropdown";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { analytics } from "@/lib/analytics";
import { trackLandingCta } from "@/lib/landingFunnel";
import { cn } from "@/lib/utils";

const LINE_1 = ["Find", "work", "that", "fits"];
const LINE_2 = ["what", "you", "do."];

const MIN_SEARCH_LENGTH = 2;

const ctaFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070D]";

type SearchState = {
  query: string;
  isLoading: boolean;
  hasResults: boolean;
};

const wordVariants = (reducedMotion: boolean) =>
  reducedMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: {
            duration: 0.6,
            ease: [0.2, 0.65, 0.3, 0.95] as const,
          },
        },
      };

export const KretopiaHero = () => {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    isLoading: false,
    hasResults: false,
  });

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);

  const smoothX = useSpring(pointerX, {
    stiffness: 40,
    damping: 22,
    mass: 0.6,
  });

  const smoothY = useSpring(pointerY, {
    stiffness: 40,
    damping: 22,
    mass: 0.6,
  });

  const fieldX = useTransform(smoothX, [0, 1], [-24, 24]);
  const fieldY = useTransform(smoothY, [0, 1], [-14, 14]);

  const normalizedQuery = searchState.query.trim();
  const canShowNoResult =
    normalizedQuery.length >= MIN_SEARCH_LENGTH &&
    !searchState.isLoading &&
    !searchState.hasResults;

  const handlePointerMove = (event: React.MouseEvent<HTMLElement>) => {
    if (reducedMotion) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    pointerX.set((event.clientX - rect.left) / rect.width);
    pointerY.set((event.clientY - rect.top) / rect.height);
  };

  const handlePointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  const handleSearchStateChange = (nextState: SearchState) => {
    setSearchState(nextState);
  };

  const handleCreateProject = () => {
    const destination = `/auth?next=${encodeURIComponent(
      `/studio/new?project=${encodeURIComponent(normalizedQuery)}`,
    )}&src=hero_no_results_create_project`;

    analytics.featureUsed("landing_hero_create_project_from_empty_search", {
      queryLength: normalizedQuery.length,
    });

    trackLandingCta("hero_create_project_from_empty_search", "hero", {
      label: "Create this project",
      queryLength: normalizedQuery.length,
      variant: "search_empty_state",
    });

    navigate(destination);
  };

  useEffect(() => {
    analytics.featureUsed("landing_hero_viewed", { location: "hero" });
  }, []);

  return (
    <section
      id="kretopia-hero"
      className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden sm:min-h-[calc(100svh-5rem)]"
      style={{ backgroundColor: "#05070D" }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 80% 20%, rgba(120, 70, 40, 0.14), transparent 55%), radial-gradient(80% 60% at 0% 100%, rgba(0,0,0,0.6), transparent 60%)",
        }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ x: fieldX, y: fieldY }}
      >
        <div
          className="h-[70vh] w-[70vh] max-h-[560px] max-w-[560px] rounded-full blur-[90px]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--secondary) / 0.55) 0%, hsl(var(--energy) / 0.22) 42%, transparent 72%)",
          }}
        />
      </motion.div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(70% 55% at 50% 35%, #000 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(70% 55% at 50% 35%, #000 0%, transparent 75%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[900px] flex-col items-center px-5 py-12 text-center sm:px-8 sm:py-16 lg:px-12">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <BrandLogo size="md" showBeta />
        </motion.div>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="landing-eyebrow mb-6"
        >
          For creative professionals
        </motion.p>

        <h1 className="landing-h1 landing-glow mx-auto max-w-full">
          <motion.span
            className="block"
            initial="hidden"
            animate="show"
            variants={{
              show: {
                transition: {
                  staggerChildren: reducedMotion ? 0 : 0.05,
                },
              },
            }}
          >
            <span className="block">
              {LINE_1.map((word, index) => (
                <motion.span
                  key={word}
                  className={cn(
                    "inline-block",
                    index < LINE_1.length - 1 && "mr-[0.28em]",
                  )}
                  variants={wordVariants(reducedMotion)}
                >
                  {word}
                </motion.span>
              ))}
            </span>

            <span className="landing-accent block">
              {LINE_2.map((word, index) => (
                <motion.span
                  key={word}
                  className={cn(
                    "inline-block",
                    index < LINE_2.length - 1 && "mr-[0.28em]",
                  )}
                  variants={wordVariants(reducedMotion)}
                >
                  {word}
                </motion.span>
              ))}
            </span>
          </motion.span>
        </h1>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative isolate z-30 mt-8 w-full max-w-[38rem] sm:mt-9"
        >
          <p className="landing-eyebrow mb-4 block text-center sm:mb-5">
            Creative Work
          </p>

          <div className="relative z-30">
            <UnifiedSearchDropdown
              variant="hero"
              placeholder="Search people, roles, projects, or opportunities…"
              onSearchStateChange={handleSearchStateChange}
              className="relative z-30 text-left"
            />
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-5 -bottom-6 -z-10 h-14 bg-primary/10 blur-2xl"
          />

          {canShowNoResult ? (
            <motion.div
              role="status"
              aria-live="polite"
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: 6 }}
              transition={{ duration: 0.24 }}
              className={cn(
                "relative z-20 mt-4 overflow-hidden rounded-2xl",
                "border border-primary/25 bg-card/95 p-4 text-left shadow-2xl",
                "backdrop-blur-xl sm:p-5",
              )}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-80"
              />

              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <SearchX className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Nothing public matched “{normalizedQuery}” yet.
                      </p>

                      <p className="mt-1 text-sm leading-5 text-muted-foreground">
                        Be the first to put it on the Kretopia map. Create your
                        project and start building its creative record.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSearchState({
                          query: "",
                          isLoading: false,
                          hasResults: true,
                        })
                      }
                      className={cn(
                        "rounded-lg p-1 text-muted-foreground",
                        "transition-colors hover:bg-muted hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      )}
                      aria-label="Dismiss no results message"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateProject}
                    className={cn(
                      "mt-4 inline-flex w-full items-center justify-center gap-2",
                      "rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground",
                      "shadow-[0_0_28px_hsl(var(--primary)/0.25)]",
                      "transition duration-200 hover:-translate-y-0.5 hover:brightness-110",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      "focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070D]",
                      "sm:w-auto",
                    )}
                  >
                    <FolderPlus className="h-4 w-4" aria-hidden="true" />
                    Create “{normalizedQuery}”
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-9 flex w-full flex-col items-center gap-4 sm:mt-10"
        >
          <div className="flex w-full max-w-xs flex-col items-center justify-center gap-3 sm:max-w-none sm:w-auto sm:flex-row">
            <Link
              to="/auth?tab=signup&src=hero_passport"
              onClick={() =>
                trackLandingCta("hero_build_passport", "hero", {
                  label: "Build My Passport",
                  variant: "signal_field",
                })
              }
              className={cn(
                "btn-landing-primary group inline-flex w-full items-center justify-center gap-2",
                "rounded-full px-7 py-3.5 text-base font-semibold",
                "transition-transform duration-200 hover:-translate-y-0.5 sm:w-auto",
                ctaFocusRing,
                "focus-visible:ring-[hsl(var(--energy))]/70",
              )}
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Build My Passport
              <ArrowRight
                className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>

            <Link
              to="/auth?next=/scout&src=hero_explore"
              onClick={() =>
                trackLandingCta("hero_explore_opportunities", "hero", {
                  label: "Explore Opportunities",
                  variant: "signal_field",
                })
              }
              className={cn(
                "btn-glass btn-glass-outline inline-flex w-full items-center justify-center gap-2",
                "rounded-full px-7 py-3.5 text-base font-semibold",
                "transition-transform duration-200 hover:-translate-y-0.5 sm:w-auto",
                ctaFocusRing,
                "focus-visible:ring-white/40",
              )}
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Explore Opportunities
            </Link>
          </div>

          <p
            className="text-xs text-white/45"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            Free to start. No credit card needed.
          </p>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-6 z-20 hidden opacity-95 lg:block min-[1440px]:hidden">
        <KretoCharacter variant="main" size={180} floatAmplitude={0} />
      </div>

      <div className="pointer-events-none absolute bottom-4 right-16 z-20 hidden opacity-95 min-[1440px]:block">
        <KretoCharacter variant="main" size={300} floatAmplitude={0} />
      </div>
    </section>
  );
};

export default KretopiaHero;