/**
 * LandingBelowFold — everything on the landing page after the hero.
 *
 * Split into its own chunk and mounted only once the visitor approaches it
 * (or the browser goes idle), so the hero stays on the critical path and
 * becomes interactive as early as possible.
 *
 * Every chapter follows one structural pattern: image (or illustrative
 * visual) → numbered title → explanation → an interactive tutorial
 * immediately below it. Numbers come from chapterRegistry.ts — the single
 * source of truth also used by ChapterProgressNav — so removing, adding,
 * or reordering a chapter here never requires hand-patching a number
 * anywhere else.
 */
import { InlineSignupBar } from "@/components/landing/kretopia/InlineSignupBar";
import { ChapterSection } from "@/components/landing/kretopia/ChapterSection";
import { VerifiedCreditsChapterSection } from "@/components/landing/kretopia/VerifiedCreditsChapterSection";
import { ProductLoopSection } from "@/components/landing/kretopia/ProductLoopSection";
import { MeetKretoSection } from "@/components/landing/kretopia/MeetKretoSection";
import { ForOrganisationsSection } from "@/components/landing/kretopia/ForOrganisationsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { ClosingCTASection } from "@/components/landing/kretopia/ClosingCTASection";
import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";
import { chapterRoman } from "@/components/landing/kretopia/chapterRegistry";
import {
  PASSPORT_TUTORIAL, SCOUT_TUTORIAL, MATCH_TUTORIAL,
  STUDIO_TUTORIAL, SOUNDSTAGES_TUTORIAL,
} from "@/components/landing/kretopia/tutorialContent";
import {
  PassportVisual, ScoutVisual, MatchVisual,
  StudioVisual, SoundStagesVisual,
} from "@/components/landing/kretopia/featureVisuals";

import passportImg    from "@/assets/kretopia/chapter-passport.jpg";
import scoutImg       from "@/assets/kretopia/chapter-scout.jpg";
import matchImg       from "@/assets/kretopia/chapter-match.jpg";
import studioImg      from "@/assets/kretopia/chapter-studio.jpg";
import soundstagesImg from "@/assets/kretopia/chapter-soundstages.jpg";

export const LandingBelowFold = () => {
  return (
    <>
      {/* Kretopia loop — Landing Final Conversion Overhaul: replaces the old
          "Search Your Name" pitch in this same slot (real search is now on
          the persistent navbar itself, see Navbar.tsx). Shows how a Passport
          becomes discovery becomes execution becomes a stronger Passport. */}
      <ProductLoopSection />

      {/* First conversion beat — most visitors never reach the closing CTA */}
      <InlineSignupBar />

      {/* Passport */}
      <ChapterSection
        id="chapter-passport"
        index={chapterRoman("chapter-passport")}
        kicker="Passport"
        title={
          <>
            One place for <br />
            <span className="landing-accent">
              the work
            </span>{" "}
            <br className="hidden sm:block" />
            that made you
          </>
        }
        body="Your Creative Passport brings your projects, credits, skills, collaborators and professional history together in one living record. Not just what you say you can do — what you've actually done."
        caption="Passport"
        image={passportImg}
        accent="#FF2DA1"
        href="/auth?next=/profile"
        ctaLabel="Build Your Passport"
        closingLine="One link. Your creative career."
        concepts={[
          { label: "Credits", body: "The role you played." },
          { label: "Projects", body: "The work you contributed to." },
          { label: "Co-Signs", body: "People who can confirm your contribution." },
          { label: "Evidence", body: "Proof that strengthens the record." },
        ]}
        tutorialSteps={PASSPORT_TUTORIAL}
        tutorialVisual={PassportVisual}
        discreetTutorial
      />

      {/* Verified Credits — the canonical tutorial reference. Its own
          closing beat now carries the one Trust line that used to be a
          separate, un-tracked section restating this same evidence data. */}
      <VerifiedCreditsChapterSection />

      {/* Scout */}
      <ChapterSection
        id="chapter-scout"
        index={chapterRoman("chapter-scout")}
        kicker="Scout"
        title={
          <>
            The opportunity finds<br />
            <span className="landing-accent">
              you
            </span>
          </>
        }
        body="Scout searches gigs, briefs, castings, commissions and opportunities across the web, then surfaces the ones that fit your Passport. Kreto can help you prepare the next move. You stay in control."
        caption="Scout"
        image={scoutImg}
        accent="#FF2DA1"
        href="/auth?next=/scout"
        ctaLabel="Explore Opportunities"
        reverse
        tutorialSteps={SCOUT_TUTORIAL}
        tutorialVisual={ScoutVisual}
        discreetTutorial
        kretoVariant="scout"
      />

      {/* Match */}
      <ChapterSection
        id="chapter-match"
        index={chapterRoman("chapter-match")}
        kicker="Match"
        title={
          <>
            The right person<br />
            <span className="landing-accent">
              for the work
            </span>
          </>
        }
        body="Discover creatives through what they actually do, where they are, the projects they've worked on and the people who can confirm it. Less cold searching. More creative context."
        caption="Match"
        image={matchImg}
        accent="#FF2DA1"
        href="/auth?next=/match"
        ctaLabel="Find Collaborators"
        tutorialSteps={MATCH_TUTORIAL}
        tutorialVisual={MatchVisual}
      />

      {/* Studio */}
      <ChapterSection
        id="chapter-studio"
        index={chapterRoman("chapter-studio")}
        kicker="Studio"
        title={
          <>
            From idea to invoice<br />
            <span className="landing-accent">
              in one room
            </span>
          </>
        }
        body="Bring the brief, collaborators, tasks, files, milestones, communication and payments together around the work."
        caption="Studio"
        image={studioImg}
        accent="#FF2DA1"
        href="/auth?next=/desk"
        ctaLabel="Create a Project"
        closingLine="When the project is finished, the outcome strengthens the Creative Passports of the people who made it happen."
        reverse
        tutorialSteps={STUDIO_TUTORIAL}
        tutorialVisual={StudioVisual}
        discreetTutorial
      />

      {/* Kreto — the sunset moment of the core creative journey */}
      <MeetKretoSection />

      {/* Community — SoundStages, Circle and events combined into one
          section rather than three separate large homepage modules. */}
      <ChapterSection
        id="chapter-community"
        index={chapterRoman("chapter-community")}
        kicker="Community"
        title={
          <>
            Creative careers<br />
            <span className="landing-accent">
              grow through people
            </span>
          </>
        }
        body="Meet collaborators, join live conversations, take part in SoundStages, industry sessions, auditions and creative events built around real connection and opportunity. Online when it works. In real life when it matters."
        caption="Community"
        image={soundstagesImg}
        accent="#FF2DA1"
        href={`/auth?next=${encodeURIComponent("/circle?tab=live")}`}
        ctaLabel="Join a SoundStage"
        tutorialSteps={SOUNDSTAGES_TUTORIAL}
        tutorialVisual={SoundStagesVisual}
        kretoVariant="connector"
      />

      {/* For Organisations — shorter than the creator journey, never competes with the hero */}
      <ForOrganisationsSection />

      {/* Closing CTA — back to the hero's core wedge */}
      <ClosingCTASection />

      {/* FAQ — crawlable, text-based answers for AI-search citation and
          Google FAQ rich results, mirrored in index.html's FAQPage JSON-LD */}
      <FAQSection />

      {/* Footer */}
      <EditorialFooter />
    </>
  );
};

export default LandingBelowFold;
