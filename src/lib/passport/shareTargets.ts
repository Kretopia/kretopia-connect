/**
 * Profession-aware share targets for the Passport.
 *
 * Each target maps to an existing public route on the platform; the
 * <PassportShareSheet /> uses this map to render the right share order
 * for the user's profession archetype.
 */

import type { ShareTarget } from "./professionProfiles";
import { APP_URL } from "@/lib/constants";

export interface ShareTargetMeta {
  id: ShareTarget;
  label: string;
  shortLabel: string;
  description: string;
  /** Build the public URL for a given user id. */
  href: (userId: string, origin?: string) => string;
  /** When true, only owners with a paid plan can publish this. */
  paidOnly?: boolean;
}

const O = (origin?: string) => origin ?? APP_URL;

export const SHARE_TARGETS: Record<ShareTarget, ShareTargetMeta> = {
  profile: {
    id: "profile",
    label: "Passport profile",
    shortLabel: "Profile",
    description: "Your full Passport — always free.",
    href: (id, origin) => `${O(origin)}/profile/${id}`,
  },
  epk: {
    id: "epk",
    label: "EPK / Media kit",
    shortLabel: "EPK",
    description: "Press-ready one-pager with reel, bio, credits and contact.",
    href: (id, origin) => `${O(origin)}/epk/${id}`,
  },
  compcard: {
    id: "compcard",
    label: "Comp Card",
    shortLabel: "Comp Card",
    description: "Modeling comp card with measurements, polaroids and agency.",
    href: (id, origin) => `${O(origin)}/comp/${id}`,
  },
  reel: {
    id: "reel",
    label: "Showreel page",
    shortLabel: "Reel",
    description: "Single-focus reel page for casting and bookings.",
    href: (id, origin) => `${O(origin)}/epk/${id}#reel`,
  },
  press: {
    id: "press",
    label: "Press / Clips",
    shortLabel: "Press",
    description: "Bylines, features and press links.",
    href: (id, origin) => `${O(origin)}/profile/${id}#press`,
  },
  rate: {
    id: "rate",
    label: "Rate card",
    shortLabel: "Rates",
    description: "Public rate card for clients and brands.",
    href: (id, origin) => `${O(origin)}/profile/${id}#rates`,
  },
  rollcall: {
    id: "rollcall",
    label: "Roll Call",
    shortLabel: "Roll Call",
    description: "IMDb-style credit list grouped by project.",
    href: (id, origin) => `${O(origin)}/profile/${id}#credits`,
  },
  portfolio_pdf: {
    id: "portfolio_pdf",
    label: "Portfolio PDF",
    shortLabel: "PDF",
    description: "Downloadable portfolio document.",
    href: (id, origin) => `${O(origin)}/epk/${id}?download=1`,
  },
  site: {
    id: "site",
    label: "Personal website",
    shortLabel: "Website",
    description: "One-click published site at your custom URL.",
    href: (id, origin) => `${O(origin)}/site/${id}`,
    paidOnly: true,
  },
};

export function targetsFor(targets: ShareTarget[]): ShareTargetMeta[] {
  return targets.map((t) => SHARE_TARGETS[t]).filter(Boolean);
}
