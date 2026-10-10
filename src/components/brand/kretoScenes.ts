// Kreto library crops (interim, cut from the library's overview sheet)
import landingHero from "@/assets/brand/kreto/library/landing-hero.webp";
import productLaunch from "@/assets/brand/kreto/library/product-launch.webp";
import social from "@/assets/brand/kreto/library/social.webp";
import investorDeck from "@/assets/brand/kreto/library/investor-deck.webp";
import announcement from "@/assets/brand/kreto/library/announcement.webp";
import event from "@/assets/brand/kreto/library/event.webp";
import onboarding from "@/assets/brand/kreto/library/onboarding.webp";
import celebration from "@/assets/brand/kreto/library/celebration.webp";
import campaign from "@/assets/brand/kreto/library/campaign.webp";

// CPO master scenes v4: product expressions and environments, each in two sizes
import passport from "@/assets/brand/kreto/scenes/passport.webp";
import passportThumb from "@/assets/brand/kreto/scenes/passport-thumb.webp";
import krepay from "@/assets/brand/kreto/scenes/krepay.webp";
import krepayThumb from "@/assets/brand/kreto/scenes/krepay-thumb.webp";
import assistant from "@/assets/brand/kreto/scenes/assistant.webp";
import assistantThumb from "@/assets/brand/kreto/scenes/assistant-thumb.webp";
import match from "@/assets/brand/kreto/scenes/match.webp";
import matchThumb from "@/assets/brand/kreto/scenes/match-thumb.webp";
import scout from "@/assets/brand/kreto/scenes/scout.webp";
import scoutThumb from "@/assets/brand/kreto/scenes/scout-thumb.webp";
import soundstages from "@/assets/brand/kreto/scenes/soundstages.webp";
import soundstagesThumb from "@/assets/brand/kreto/scenes/soundstages-thumb.webp";
import studio from "@/assets/brand/kreto/scenes/studio.webp";
import studioThumb from "@/assets/brand/kreto/scenes/studio-thumb.webp";
import talentSearch from "@/assets/brand/kreto/scenes/talent-search.webp";
import talentSearchThumb from "@/assets/brand/kreto/scenes/talent-search-thumb.webp";
import bgDark from "@/assets/brand/kreto/scenes/bg-dark.webp";
import bgDarkThumb from "@/assets/brand/kreto/scenes/bg-dark-thumb.webp";
import bgGradient from "@/assets/brand/kreto/scenes/bg-gradient.webp";
import bgGradientThumb from "@/assets/brand/kreto/scenes/bg-gradient-thumb.webp";
import bgLight from "@/assets/brand/kreto/scenes/bg-light.webp";
import bgLightThumb from "@/assets/brand/kreto/scenes/bg-light-thumb.webp";
import coworking from "@/assets/brand/kreto/scenes/coworking.webp";
import coworkingThumb from "@/assets/brand/kreto/scenes/coworking-thumb.webp";
import musicStudio from "@/assets/brand/kreto/scenes/music-studio.webp";
import musicStudioThumb from "@/assets/brand/kreto/scenes/music-studio-thumb.webp";
import office from "@/assets/brand/kreto/scenes/office.webp";
import officeThumb from "@/assets/brand/kreto/scenes/office-thumb.webp";
import workspace from "@/assets/brand/kreto/scenes/workspace.webp";
import workspaceThumb from "@/assets/brand/kreto/scenes/workspace-thumb.webp";

/**
 * Kreto's scenes: Kreto in a lit scene, never a cut-out, so each is shown in
 * a framed, cropped slot with `object-cover`.
 *
 * Two sets live here.
 *
 * Product expressions (CPO master scenes v4, 2:1 or 16:9): one per feature,
 * Kreto doing what that feature does.
 *   passport       laptop showing a Passport card        Passport, Today's Passport card
 *   krepay         holding a Kretopia card, approval     KrePay, billing
 *   assistant      speech bubbles                        Kreto's own panel, "your next move"
 *   match          two Kretos, high five                 Match, collaboration
 *   scout          binoculars over a landscape           Scout
 *   soundstages    microphone and waveform               Sound Stages, live audio
 *   studio         laptop with a moodboard               Studio, the New Room
 *   talent-search  profile cards and a magnifier         Talent finder, "people to meet"
 *
 * Environments (CPO master scenes v4): the same Kreto at a desk, in a place.
 *   bg-dark, bg-gradient, bg-light (wide, three backgrounds), coworking,
 *   music-studio, office, workspace.
 *
 * Interim crops (the nine below the divider) came from the library's overview
 * sheet before the real scenes existed; they stay for the expressions the v4
 * set does not cover (launch, social, celebration, ...).
 *
 * Sizes: `src` is 1280 px wide (never enlarged), `thumb` 480 px. Use the thumb
 * for any slot up to about 240 px wide.
 */
export type KretoSceneId =
  | "passport"
  | "krepay"
  | "assistant"
  | "match"
  | "scout"
  | "soundstages"
  | "studio"
  | "talent-search"
  | "bg-dark"
  | "bg-gradient"
  | "bg-light"
  | "coworking"
  | "music-studio"
  | "office"
  | "workspace"
  // interim crops
  | "landing-hero"
  | "product-launch"
  | "social"
  | "investor-deck"
  | "announcement"
  | "event"
  | "onboarding"
  | "celebration"
  | "campaign";

interface SceneFile {
  src: string;
  /** Intrinsic size, so the slot reserves its space before the file arrives. */
  width: number;
  height: number;
}

export interface SceneAsset extends SceneFile {
  /** A 480 px version for small slots; absent on the interim crops. */
  thumb?: SceneFile;
  /** Where to anchor the picture when the slot is a different shape. */
  position: string;
}

const two = (src: string, width: number, height: number, thumb: string, thumbH: number, position: string): SceneAsset => ({
  src,
  width,
  height,
  thumb: { src: thumb, width: 480, height: thumbH },
  position,
});

export const KRETO_SCENES: Record<KretoSceneId, SceneAsset> = {
  passport: two(passport, 1280, 720, passportThumb, 270, "35% 50%"),
  krepay: two(krepay, 1280, 640, krepayThumb, 240, "40% 50%"),
  assistant: two(assistant, 1280, 640, assistantThumb, 240, "40% 50%"),
  match: two(match, 1280, 640, matchThumb, 240, "50% 50%"),
  scout: two(scout, 1280, 640, scoutThumb, 240, "28% 50%"),
  soundstages: two(soundstages, 1280, 640, soundstagesThumb, 240, "55% 50%"),
  studio: two(studio, 1280, 640, studioThumb, 240, "35% 50%"),
  "talent-search": two(talentSearch, 1280, 640, talentSearchThumb, 240, "30% 50%"),
  "bg-dark": two(bgDark, 1280, 452, bgDarkThumb, 169, "62% 50%"),
  "bg-gradient": two(bgGradient, 1280, 454, bgGradientThumb, 170, "62% 50%"),
  "bg-light": two(bgLight, 1280, 450, bgLightThumb, 169, "62% 50%"),
  coworking: two(coworking, 1280, 720, coworkingThumb, 270, "55% 55%"),
  "music-studio": two(musicStudio, 1280, 720, musicStudioThumb, 270, "35% 50%"),
  office: two(office, 1280, 720, officeThumb, 270, "55% 50%"),
  workspace: two(workspace, 1280, 640, workspaceThumb, 240, "45% 55%"),

  // ── interim crops ──
  "landing-hero": { src: landingHero, width: 488, height: 241, position: "62% 50%" },
  "product-launch": { src: productLaunch, width: 468, height: 241, position: "50% 50%" },
  social: { src: social, width: 418, height: 277, position: "50% 38%" },
  "investor-deck": { src: investorDeck, width: 488, height: 211, position: "30% 50%" },
  announcement: { src: announcement, width: 468, height: 211, position: "50% 50%" },
  event: { src: event, width: 484, height: 211, position: "60% 50%" },
  onboarding: { src: onboarding, width: 488, height: 227, position: "40% 50%" },
  celebration: { src: celebration, width: 468, height: 233, position: "50% 50%" },
  campaign: { src: campaign, width: 484, height: 233, position: "55% 50%" },
};
