/** Shared types for the Universal Claim Flow */
export type ClaimSource = "auth" | "landing" | "gig" | "event";

export interface ClaimContext {
  source: ClaimSource;
  /** Pre-fill search input from a landing search or gig role hint */
  initialQuery?: string;
  /** Where to send user after they land on profile (defaults to /profile) */
  redirectAfter?: string;
  /** Gig or event ID for analytics + post-claim redirect */
  contextId?: string;
}

export interface WebCreditResult {
  title: string;
  url?: string;
  type?: string;
  year?: number;
  role_suggestion?: string;
  description?: string;
  /** Cover/thumbnail image. Backend may also send as `image_url` — normalize on intake. */
  thumbnail?: string;
  image_url?: string;
  platform?: string;
  client_brand?: string;
  location?: string;
  source_name?: string;
}

export interface ClaimedCredit extends WebCreditResult {
  /** Stable id for selection state */
  _id: string;
}

export interface DraftProfile {
  full_name?: string;
  role?: string;
  bio?: string;
  location?: string;
  skills?: string[];
  avatar_url?: string;
  website?: string;
}

export type FlowStep = "search" | "disambiguate" | "verify" | "preview" | "face" | "reveal" | "email" | "sending";
