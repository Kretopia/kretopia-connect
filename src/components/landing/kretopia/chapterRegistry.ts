/**
 * Single source of truth for the landing tutorial's chapter order. Both
 * ChapterProgressNav (jump nav + active-chapter tracking) and every
 * chapter's own numbered eyebrow read from this same array, so adding,
 * removing, or reordering a chapter here is the only edit needed —
 * numbers and nav entries update themselves.
 */
import { toRoman } from "@/lib/toRoman";

export interface ChapterMeta {
  /** DOM id — the chapter's scroll anchor, observed by ChapterProgressNav. */
  id: string;
  /** Short label used in the nav and as the chapter's kicker. */
  label: string;
}

export const CHAPTER_REGISTRY: ChapterMeta[] = [
  { id: "kretopia-hero", label: "Search" },
  { id: "chapter-passport", label: "Passport" },
  { id: "chapter-verified-credits", label: "Verified Credits" },
  { id: "chapter-scout", label: "Scout" },
  { id: "chapter-match", label: "Match" },
  { id: "chapter-studio", label: "Studio" },
  { id: "chapter-kreto", label: "Kreto" },
  { id: "chapter-community", label: "Community" },
];

export function chapterNumber(id: string): number {
  const idx = CHAPTER_REGISTRY.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Unknown chapter id "${id}" — add it to CHAPTER_REGISTRY first.`);
  return idx + 1;
}

export function chapterRoman(id: string): string {
  return toRoman(chapterNumber(id));
}
