// How a Passport's work is grouped into sections: Video, Audio and Projects.
//
// Three different things are kept apart on purpose:
//   - the kind of content: what a piece IS (video, audio, an image or nothing playable), read only from the
//     `media_type` the piece was saved with and only when it has a media link that can be opened;
//   - the project: a credit, the work-history record (name, role, year), which may have no media at all;
//   - the proof: how the credit is evidenced (verified, co-signed, publicly sourced, pending, self-declared),
//     which is the classifier's answer and is never guessed here.
//
// Nothing is inferred from a credit's category or platform ("music" does not make something audio), and a
// piece with no usable link is shown as a project rather than as a player that cannot play. A section with
// nothing in it is not returned. Order is the order given (callers pass newest first), capped per section so a
// media-rich profile never renders an unbounded row.

import type { CreditEvidenceStatus } from "./creditEvidence";

export type ShowcaseKind = "video" | "audio" | "project";

/** A portfolio piece: media the creative uploaded or linked (a credit saved with source `portfolio`). */
export interface ShowcasePiece {
  id: string;
  title: string;
  description?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  thumbnail_url?: string | null;
}

/** A work-history credit, already classified for its proof by the caller. */
export interface ShowcaseCredit {
  id: string;
  project_name?: string | null;
  title?: string | null;
  role?: string | null;
  year?: number | null;
  platform?: string | null;
  thumbnail_url?: string | null;
  credit_category?: string | null;
  evidence?: CreditEvidenceStatus;
  endorsement_count?: number | null;
}

export interface MediaShowcaseItem<P extends ShowcasePiece = ShowcasePiece> {
  kind: "video" | "audio";
  id: string;
  title: string;
  thumbnailUrl: string | null;
  /** The original piece, handed back to the player. */
  piece: P;
}

export interface ProjectShowcaseItem {
  kind: "project";
  id: string;
  title: string;
  /** "Role · year", whichever parts exist. */
  subtitle: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  /** Present for credits only: a portfolio piece has no verification to show. */
  proof: CreditEvidenceStatus | null;
}

export type ShowcaseItem<P extends ShowcasePiece = ShowcasePiece> = MediaShowcaseItem<P> | ProjectShowcaseItem;

export interface ShowcaseSection<P extends ShowcasePiece = ShowcasePiece> {
  kind: ShowcaseKind;
  label: string;
  items: Array<ShowcaseItem<P>>;
}

export const SHOWCASE_SECTION_LIMIT = 12;

const LABEL: Record<ShowcaseKind, string> = { video: "Video", audio: "Audio", project: "Projects" };
const VIDEO_TYPES = new Set(["video", "youtube", "vimeo"]);

const isHttpUrl = (value: unknown): value is string => typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** "video" or "audio" only when the piece says so AND has a link that can be opened; otherwise null. */
export function playableKind(mediaType: string | null | undefined, mediaUrl: string | null | undefined): "video" | "audio" | null {
  if (!isHttpUrl(mediaUrl)) return null;
  const type = clean(mediaType).toLowerCase();
  if (VIDEO_TYPES.has(type)) return "video";
  if (type === "audio") return "audio";
  return null;
}

export function buildShowcase<P extends ShowcasePiece>(
  pieces: readonly P[],
  credits: readonly ShowcaseCredit[],
  limit: number = SHOWCASE_SECTION_LIMIT,
): Array<ShowcaseSection<P>> {
  const seen = new Set<string>();
  const sections: Record<ShowcaseKind, Array<ShowcaseItem<P>>> = { video: [], audio: [], project: [] };

  for (const piece of pieces) {
    if (!piece || !piece.id || seen.has(piece.id)) continue;
    seen.add(piece.id);
    const title = clean(piece.title) || "Untitled";
    const thumb = isHttpUrl(piece.thumbnail_url) ? piece.thumbnail_url!.trim() : null;
    const kind = playableKind(piece.media_type, piece.media_url);
    if (kind) {
      sections[kind].push({ kind, id: piece.id, title, thumbnailUrl: thumb, piece });
    } else {
      // An image, or media with no link to open: still part of the work, shown as a project card.
      const image = clean(piece.media_type).toLowerCase() === "image" && isHttpUrl(piece.media_url) ? piece.media_url!.trim() : null;
      sections.project.push({ kind: "project", id: piece.id, title, subtitle: null, thumbnailUrl: thumb ?? image, category: null, proof: null });
    }
  }

  for (const credit of credits) {
    if (!credit || !credit.id || seen.has(credit.id)) continue;
    seen.add(credit.id);
    const title = clean(credit.project_name) || clean(credit.title);
    if (!title) continue;
    const subtitle = [clean(credit.role), credit.year ? String(credit.year) : ""].filter(Boolean).join(" · ") || null;
    sections.project.push({
      kind: "project",
      id: credit.id,
      title,
      subtitle,
      thumbnailUrl: isHttpUrl(credit.thumbnail_url) ? credit.thumbnail_url!.trim() : null,
      category: clean(credit.credit_category) || null,
      proof: credit.evidence ?? null,
    });
  }

  return (["video", "audio", "project"] as const)
    .filter((kind) => sections[kind].length > 0)
    .map((kind) => ({ kind, label: LABEL[kind], items: sections[kind].slice(0, Math.max(0, limit)) }));
}
