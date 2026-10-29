/** A run of body text: plain, or emphasised. */
export type LegalPart = string | { strong: string };

export type LegalBlock =
  | { type: "p"; content: LegalPart[] }
  | { type: "ul"; items: LegalPart[][] }
  /** A set-apart statement with its own label, e.g. "Visibility". */
  | { type: "callout"; cap: string; text: string };

export interface LegalSection {
  /** Anchor id, "s01". */
  id: string;
  /** "01": the section's number, shown beside its title. */
  num: string;
  title: string;
  blocks: LegalBlock[];
}

/** A heading with one accented phrase, drawn with the Kretopia gradient. */
export interface LegalHeading {
  before: string;
  accent: string;
}

export interface LegalDocument {
  slug: "terms" | "privacy" | "community";
  /** "Terms of Service": names the page in the header, the panel and the browser title. */
  name: string;
  seoDescription: string;
  /** White first line of the page header, and its gradient second line. */
  title: string;
  accentTitle: string;
  subtitle: string;
  /** "Last updated 7 October 2026". */
  updated: string;
  panelHeading: LegalHeading;
  sections: LegalSection[];
  closing: { eyebrow: string; heading: LegalHeading };
}
