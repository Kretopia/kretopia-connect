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
import { ChapterSection } from "@/components/landing/kretopia/ChapterSection";
import { ProductLoopSection } from "@/components/landing/kretopia/ProductLoopSection";
import { MeetKretoSection } from "@/components/landing/kretopia/MeetKretoSection";
import { ForOrganisationsSection } from "@/components/landing/kretopia/ForOrganisationsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";
import { chapterRoman } from "@/components/landing/kretopia/chapterRegistry";
import {
  PASSPORT_TUTORIAL, SCOUT_TUTORIAL, MATCH_TUTORIAL,
  STUDIO_TUTORIAL, SOUNDSTAGES_TUTORIAL,
} from "@/components/landing/kretopia/tutorialContent";
import {
  PassportVisual, ScoutVisual, StudioVisual,
} from "@/components/landing/kretopia/featureVisuals";

import scoutImg       from "@/assets/kretopia/chapter-scout.jpg";
import studioImg      from "@/assets/kretopia/chapter-studio.jpg";
import soundstagesImg from "@/assets/kretopia/chapter-soundstages.jpg";

// HD chapter videos — landing overhaul (24/09/2026). Served from /public
// (not imported) since Vite would otherwise inline/hash large binaries
// through the JS module graph; a plain absolute path is the standard way
// to reference public/ assets. The matching *Img above is kept as each
// <video>'s poster, so a slow connection still shows something on first
// paint instead of a blank frame.
const studioVideo = "/videos/kretovideo1.mp4";
const soundstagesVideo = "/videos/kretovideo.mp4";
const scoutVideo = "/videos/kretovideo2.mp4";
// Passport and Match: the native 720×1280 masters, losslessly remuxed with the
// index up front (no re-encode, no upscale), each with its own first frame as
// the poster so the still never differs from the video.
const passportVideo = "/videos/kreto-passport.mp4";
const passportPoster = "/videos/kreto-passport-poster.jpg";
const matchVideo = "/videos/kreto-vertical.mp4";
const matchPoster = "/videos/kreto-vertical-poster.jpg";

export const LandingBelowFold = () => {
  return (
    <>
      {/* Kretopia loop — Landing Final Conversion Overhaul: replaces the old
          "Search Your Name" pitch in this same slot (real search is now on
          the persistent navbar itself, see Navbar.tsx). Shows how a Passport
          becomes discovery becomes execution becomes a stronger Passport. */}
      <ProductLoopSection />

      {/* Passport */}
      <ChapterSection
        id="chapter-passport"
        index={chapterRoman("chapter-passport")}
        kicker="Passport"
        title={
          // Every chapter now carries the one accent phrase (matching Scout/
          // Studio/Community below) -- restored after user feedback that an
          // all-plain title read as "the gradient didn't apply" rather than
          // "restrained". The phrase is 3 words, comfortably long enough for
          // the accent gradient to sweep its complete blue->orange range
          // (see .landing-accent's own comment on why a bare 1-2 word
          // phrase visually truncates the sweep).
          <>
            One place for the work<br />
            <span className="landing-accent">
              that made you
            </span>
          </>
        }
        body="Your Creative Passport brings your projects, credits, skills, collaborators and professional history together in one living record. Not just what you say you can do — what you've actually done."
        caption="Passport"
        image={passportPoster}
        video={passportVideo}
        // The head comes toward the camera mid-clip: keep the frame high so
        // the helmet is never cut off by the 9:16 → 4:5 crop.
        mediaPosition="50% 20%"
        accent="hsl(var(--energy))"
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

      {/* Scout */}
      <ChapterSection
        id="chapter-scout"
        index={chapterRoman("chapter-scout")}
        kicker="Scout"
        title={
          // "you" alone (66px wide) was too narrow for the gradient's
          // 4-stop sweep to read as complete -- background-clip:text maps
          // 0%-100% of the gradient across this span's own box, but a box
          // this narrow only ever showed the middle violet/magenta stops,
          // never reaching the blue start or orange end. Moved the split
          // one word earlier so the accent phrase is "finds you" instead
          // of just "you" -- confirmed live, the wider box shows the full
          // range correctly.
          <>
            The opportunity<br />
            <span className="landing-accent">
              finds you
            </span>
          </>
        }
        body="Scout searches gigs, briefs, castings, commissions and opportunities across the web, then surfaces the ones that fit your Passport. Kreto can help you prepare the next move. You stay in control."
        caption="Scout"
        image={scoutImg}
        video={scoutVideo}
        accent="hsl(var(--energy))"
        href="/auth?next=/scout"
        ctaLabel="Explore Opportunities"
        reverse
        tutorialSteps={SCOUT_TUTORIAL}
        tutorialVisual={ScoutVisual}
        discreetTutorial
      />

      {/* Match */}
      <ChapterSection
        id="chapter-match"
        index={chapterRoman("chapter-match")}
        kicker="Match"
        title={
          // Restored the accent phrase, matching every other chapter now
          // (see the Passport chapter's comment above).
          <>
            The right person<br />
            <span className="landing-accent">
              for the work
            </span>
          </>
        }
        body="Discover creatives through what they actually do, where they are, the projects they've worked on and the people who can confirm it. Less cold searching. More creative context."
        caption="Match"
        image={matchPoster}
        video={matchVideo}
        accent="hsl(var(--energy))"
        href="/auth?next=/match"
        ctaLabel="Find Collaborators"
        tutorialSteps={MATCH_TUTORIAL}
        discreetTutorial
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
        video={studioVideo}
        accent="hsl(var(--energy))"
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
        video={soundstagesVideo}
        accent="hsl(var(--energy))"
        href={`/auth?next=${encodeURIComponent("/circle?tab=live")}`}
        ctaLabel="Join a SoundStage"
        tutorialSteps={SOUNDSTAGES_TUTORIAL}
        discreetTutorial
      />

      {/* For Organisations — shorter than the creator journey, never competes with the hero */}
      <ForOrganisationsSection />

      {/* FAQ — crawlable, text-based answers for AI-search citation and
          Google FAQ rich results, mirrored in index.html's FAQPage JSON-LD */}
      <FAQSection />

      {/* Footer */}
      <EditorialFooter />
    </>
  );
};

export default LandingBelowFold;
