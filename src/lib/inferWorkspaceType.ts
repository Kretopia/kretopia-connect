import type { WorkspaceType } from "@/lib/workspaceConfigs";

/** Lightweight keyword inference so the room shape matches what was said.
 *  Extracted from VoiceFirstCreateModal so it's independently testable --
 *  every branch here decides which of the 11 real WorkspaceType values a
 *  New Room draft gets seeded with before the user ever sees the review
 *  screen, so a silently-wrong match here is a real UX bug, not cosmetic. */
export function inferWorkspaceType(text: string): WorkspaceType {
  // Accent-strip before matching (CEO hotfix: a French onboarding brief
  // like "événement de lancement" never matched any keyword below and
  // silently fell through to "general" -- é/è/ê etc. survive toLowerCase(),
  // so "événement" !== "evenement" without this). French keyword variants
  // are added alongside each English branch rather than as a parallel
  // French-only pass, so the same shadowing precedence rules apply to both.
  const t = (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (/\b(podcast|episode|guest|interview show|mic|recording session|balado|emission|enregistrement)\b/.test(t)) return "content_series";
  // Specific multi-word phrases checked before the generic single-word
  // branches below that would otherwise shadow them: "model lineup" would
  // never be reached if event_production's own generic "lineup" keyword
  // ran first, and "audio mix"/"color grade" would never be reached if
  // music_project's generic "mix" keyword ran first. Confirmed by a real
  // test failure, not a hypothetical -- see inferWorkspaceType.test.ts.
  // "lookbook" deliberately excluded -- workspaceConfigs.ts's own photo_shoot
  // description lists "lookbooks" as a photo_shoot concept, so it isn't a
  // fashion_show-exclusive signal; "runway"/"model lineup" are.
  if (/\b(runway|fashion show|model lineup|defile|podium|mannequin)\b/.test(t)) return "fashion_show";
  // "montage video" (not bare "montage") -- alone, "montage" is also how
  // French describes an event's physical stage/booth setup, which would
  // misclassify an event brief as edit_job if matched here first.
  if (/\b(retouch|color grade|edit pass|audio mix|etalonnage|retouche|montage video)\b/.test(t)) return "edit_job";
  if (/\b(event|festival|launch party|conference|gala|run sheet|venue|doors open|lineup|evenement|soiree|lancement)\b/.test(t)) return "event_production";
  if (/\b(album|ep|single|track|mix|master|release|tour|studio session|song|morceau|chanson|tournee)\b/.test(t)) return "music_project";
  if (/\b(campaign|brand|sponsor|paid social|launch.*(brand|product)|campagne|marque|partenariat)\b/.test(t)) return "brand_collab";
  if (/\b(dj|set|live gig|club night|soiree dj)\b/.test(t)) return "dj_live_gig";
  // "commande" (French for "commission") deliberately excluded -- it's
  // also the generic word for "order", too broad a false-positive risk.
  if (/\b(illustration|painting|commission|peinture)\b/.test(t)) return "commissioned_art";
  if (/\b(film|short film|music video|commercial spot|treatment|court metrage|clip|spot publicitaire)\b/.test(t)) return "video_shoot";
  if (/\b(photo shoot|editorial|headshot|shooting photo|portrait)\b/.test(t)) return "photo_shoot";
  if (/\b(shoot|reel|video|content|tiktok|instagram|youtube|carousel|post|edit|contenu|reseaux sociaux)\b/.test(t)) return "content_series";
  return "general";
}

export default inferWorkspaceType;
