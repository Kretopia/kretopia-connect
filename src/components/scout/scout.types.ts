/** One row of `scouted_gigs` as Scout's For You list reads it. */
export interface ScoutedGig {
  id: string;
  source: string;
  source_name: string | null;
  source_url: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean;
  description: string | null;
  full_description: string | null;
  image_url: string | null;
  compensation: string | null;
  contact_email: string | null;
  apply_url: string | null;
  /** Kept for ordering; Scout never prints it as a percentage. */
  fit_score: number;
  fit_reason: string | null;
  scouted_at: string;
  /** When the board says the job went up; null for pages that don't say. */
  posted_at?: string | null;
  /** A real closing date when the listing gave one; Scout's own retention (`expires_at`) is not a deadline. */
  deadline?: string | null;
  details_fetched_at: string | null;
}

/** One of this person's own actions on a scouted gig (`scouted_gig_actions`). */
export interface ScoutActionRow {
  scouted_gig_id: string;
  action: string;
  outcome: string | null;
}

export type ScoutTab = "scouted" | "all" | "shortlist" | "marketplace";
