import landingHero from "@/assets/brand/kreto/library/landing-hero.webp";
import productLaunch from "@/assets/brand/kreto/library/product-launch.webp";
import social from "@/assets/brand/kreto/library/social.webp";
import investorDeck from "@/assets/brand/kreto/library/investor-deck.webp";
import announcement from "@/assets/brand/kreto/library/announcement.webp";
import event from "@/assets/brand/kreto/library/event.webp";
import onboarding from "@/assets/brand/kreto/library/onboarding.webp";
import celebration from "@/assets/brand/kreto/library/celebration.webp";
import campaign from "@/assets/brand/kreto/library/campaign.webp";

/**
 * The scenes of the "Kreto 14 — Marketing & Editorial Library".
 *
 * Each is a full picture (Kreto in a lit scene), not a cut-out, so it is shown
 * in a framed, cropped slot with `object-cover`; never on top of another
 * surface the way the cut-outs were.
 *
 * Source note: the files here were cut from the library's overview sheet
 * (about 480 px wide, label trimmed off). They are crisp up to roughly 240 px
 * wide on a 2x screen. When the library's own exports are available, replace
 * the files in `src/assets/brand/kreto/library/` under the same names and
 * update the sizes below; nothing else changes.
 */
export type KretoSceneId =
  | "landing-hero"
  | "product-launch"
  | "social"
  | "investor-deck"
  | "announcement"
  | "event"
  | "onboarding"
  | "celebration"
  | "campaign";

interface SceneAsset {
  src: string;
  /** Intrinsic size, so the slot reserves its space before the file arrives. */
  width: number;
  height: number;
  /** Where to anchor the picture when the slot is a different shape. */
  position: string;
}

export const KRETO_SCENES: Record<KretoSceneId, SceneAsset> = {
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
