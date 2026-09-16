import type { WorkspaceType } from "@/lib/workspaceConfigs";

/** Lightweight keyword inference so the room shape matches what was said.
 *  Extracted from VoiceFirstCreateModal so it's independently testable --
 *  every branch here decides which of the 11 real WorkspaceType values a
 *  New Room draft gets seeded with before the user ever sees the review
 *  screen, so a silently-wrong match here is a real UX bug, not cosmetic. */
export function inferWorkspaceType(text: string): WorkspaceType {
  const t = (text || "").toLowerCase();
  if (/\b(podcast|episode|guest|interview show|mic|recording session)\b/.test(t)) return "content_series";
  // Specific multi-word phrases checked before the generic single-word
  // branches below that would otherwise shadow them: "model lineup" would
  // never be reached if event_production's own generic "lineup" keyword
  // ran first, and "audio mix"/"color grade" would never be reached if
  // music_project's generic "mix" keyword ran first. Confirmed by a real
  // test failure, not a hypothetical -- see inferWorkspaceType.test.ts.
  // "lookbook" deliberately excluded -- workspaceConfigs.ts's own photo_shoot
  // description lists "lookbooks" as a photo_shoot concept, so it isn't a
  // fashion_show-exclusive signal; "runway"/"model lineup" are.
  if (/\b(runway|fashion show|model lineup)\b/.test(t)) return "fashion_show";
  if (/\b(retouch|color grade|edit pass|audio mix)\b/.test(t)) return "edit_job";
  if (/\b(event|festival|launch party|conference|gala|run sheet|venue|doors open|lineup)\b/.test(t)) return "event_production";
  if (/\b(album|ep|single|track|mix|master|release|tour|studio session|song)\b/.test(t)) return "music_project";
  if (/\b(campaign|brand|sponsor|paid social|launch.*(brand|product))\b/.test(t)) return "brand_collab";
  if (/\b(dj|set|live gig|club night)\b/.test(t)) return "dj_live_gig";
  if (/\b(illustration|painting|commission)\b/.test(t)) return "commissioned_art";
  if (/\b(film|short film|music video|commercial spot|treatment)\b/.test(t)) return "video_shoot";
  if (/\b(photo shoot|editorial|headshot)\b/.test(t)) return "photo_shoot";
  if (/\b(shoot|reel|video|content|tiktok|instagram|youtube|carousel|post|edit)\b/.test(t)) return "content_series";
  return "general";
}

export default inferWorkspaceType;
