// Sorts any posting found on a job board into one family, one level and one working mode, from its title and its short excerpt.
// Pure: no network, no AI. The same text always lands in the same place, so the counts on Scout's "All sources" tab are stable and
// can be explained to the person reading them.
//
// How a family is chosen: every rule below names a family and how strong a signal it is (9 = names the job, 4 = only hints at it).
// A family's score is its strongest title match plus a third of its strongest excerpt match; the highest score wins, and a tie goes
// to the family listed first in CATEGORIES (so the creative families beat the others). Nothing matches: "Everything else".

export type CategoryGroup = "creative" | "adjacent" | "other";

export const CATEGORY_IDS = [
  "creative-direction",
  "design-brand",
  "product-ux",
  "video-motion",
  "photo",
  "illustration-art",
  "games-3d",
  "audio-music",
  "writing-content",
  "social-community",
  "marketing",
  "engineering",
  "data-ai",
  "product-program",
  "sales-accounts",
  "ops-finance-people",
  "other",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryDef {
  id: CategoryId;
  label: string;
  group: CategoryGroup;
}

/** In display order: the creative families first, then the ones next to them, then everything else. */
export const CATEGORIES: CategoryDef[] = [
  { id: "creative-direction", label: "Creative direction", group: "creative" },
  { id: "design-brand", label: "Design & brand", group: "creative" },
  { id: "product-ux", label: "Product & UX design", group: "creative" },
  { id: "video-motion", label: "Video & motion", group: "creative" },
  { id: "photo", label: "Photography", group: "creative" },
  { id: "illustration-art", label: "Illustration & art", group: "creative" },
  { id: "games-3d", label: "Games & 3D", group: "creative" },
  { id: "audio-music", label: "Audio & music", group: "creative" },
  { id: "writing-content", label: "Writing & content", group: "creative" },
  { id: "social-community", label: "Social & community", group: "creative" },
  { id: "marketing", label: "Marketing & growth", group: "adjacent" },
  { id: "engineering", label: "Engineering", group: "other" },
  { id: "data-ai", label: "Data & AI", group: "other" },
  { id: "product-program", label: "Product & project management", group: "other" },
  { id: "sales-accounts", label: "Sales & accounts", group: "other" },
  { id: "ops-finance-people", label: "Operations, finance & people", group: "other" },
  { id: "other", label: "Everything else", group: "other" },
];

const BY_ID = new Map(CATEGORIES.map((c, i) => [c.id, { ...c, order: i }]));
export const categoryOf = (id: CategoryId): CategoryDef & { order: number } => BY_ID.get(id)!;

export type Level = "intern" | "junior" | "senior" | "lead" | "director";
export const LEVELS: { id: Level; label: string }[] = [
  { id: "intern", label: "Intern / student" },
  { id: "junior", label: "Junior" },
  { id: "senior", label: "Senior" },
  { id: "lead", label: "Lead" },
  { id: "director", label: "Director & above" },
];

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";
export type Language = "en" | "de" | "other";

// ── Normalising ───────────────────────────────────────────────────────────────────────────────────────────

/** Repairs text a feed encoded twice ("fÃ¼r" -> "für"); anything that does not round-trip is returned unchanged. */
export function fixMojibake(s: string): string {
  if (!/[ÃÂâ][\u0080-¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from(Array.from(s, (ch) => ch.charCodeAt(0)));
    if (Array.from(s).some((ch) => ch.charCodeAt(0) > 255)) return s;
    const fixed = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return fixed;
  } catch {
    return s;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…" };

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d{2,6});/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]{2,6});/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]{2,6});/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// Accents are dropped before matching, so "Fotógrafo", "Júnior" and "Vidéo" meet the same rules as their plain forms.
const norm = (s: string): string =>
  decodeEntities(fixMojibake(s))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()[\]{}:;,|•·–—]/g, " ")
    .replace(/\//g, " / ")
    .replace(/\s+/g, " ")
    .trim();

// ── Families ──────────────────────────────────────────────────────────────────────────────────────────────

type Rule = [CategoryId, number, RegExp];

const RULES: Rule[] = [
  // creative direction
  ["creative-direction", 9, /\b(diretor(a)? de arte|director(a)? de arte|directeur artistique|direttore creativo|kreativdirektor\w*|creative directors?|art directors?|design directors?|executive creative|chief creative|creative lead|head of creative|director of creative|director of brand|brand director|director of design|vp of design|vp design|head of design|head of brand|creative strategist|creative strategy|brand strateg\w*)\b/],

  // design & brand
  ["design-brand", 10, /\bbrand experience\b/],
  ["design-brand", 9, /\b(disenador\w*|dise(?:n|ñ)o grafico|designer grafico|designer visual|graphic design\w*|brand designers?|brand design|brand identity|visual design\w*|packaging (design\w*|artists?|specialists?)|(package|packaging) design\w*|typograph\w*|layout artist|identity design\w*|presentation design\w*|creative designers?|marketing design\w*|communication design\w*|print design\w*|web designers?|digital designers?|grafikdesign\w*|mediengestalt\w*|art ?work)\b/],
  ["design-brand", 4, /\bbrand\b/],
  ["design-brand", 4, /\bdesign(er|ers)?\b/],
  ["design-brand", 3, /\bcreative\b/],

  // product & UX
  ["product-ux", 10, /\b(product design\w*|ux|user experience|design systems?|user research\w*|ux research\w*|design ?ops|usability)\b/],
  ["product-ux", 9, /\b(ui|user interface|interaction design\w*|experience design\w*|service design\w*|design engineers?|content designers?|conversation designers?)\b/],
  ["product-ux", 6, /\b(design lead|design manager|staff designer|principal designer|head of product design)\b/],

  // video & motion
  ["video-motion", 9, /\b(video\w*|motion|animators?|animations?|vfx|visual effects|compositors?|colou?rists?|cinematograph\w*|film\w*|post[- ]production|youtube|broadcast\w*|reels?|short[- ]form|footage|filmmaker)\b/],

  // photography
  ["photo", 9, /\b(photograph\w*|photos?|retouch\w*|fotograf\w*|fotografo\w*)\b/],

  // illustration & art
  ["illustration-art", 9, /\b(illustrat\w*|concept art\w*|character art\w*|storyboard\w*|comics?|cartoon\w*|painters?|2d artists?|visual artists?|tattoo)\b/],
  ["illustration-art", 5, /\bartists?\b/],

  // games & 3D
  ["games-3d", 11, /\b(game design\w*|level design\w*)\b/],
  // "game" names the industry, not the craft: a game composer or a game audio engineer is audio first.
  ["games-3d", 9.5, /\b(games?|gaming)\b/],
  ["games-3d", 9, /\b(3d|unity|unreal|environment artists?|technical artists?|ar \/ vr|vr|xr|metaverse|blender|houdini|maya|zbrush|cgi)\b/],

  // audio & music
  ["audio-music", 10, /\b(audio|sound design\w*|sound engineer\w*|music\w*|composers?|podcast\w*|mixing|mastering|voice[- ]?over|sonic)\b/],

  // writing & content
  ["writing-content", 9, /\b(copywrit\w*|copy writers?|content writers?|writers?|article writers?|journalists?|screenwriters?|scriptwriters?|ghostwrit\w*|technical writers?|translators?|content strateg\w*|content managers?|content leads?|content producers?|content marketing|proofread\w*|redakteur\w*|texter\w*|lektor\w*|redator(a)?|redactor(a)?|redacteur\w*|escritor\w*)\b/],
  ["writing-content", 6, /\b(editors?|editorial|documentation|localiz\w*|storytell\w*)\b/],
  ["writing-content", 4, /\bnarrative\b/],

  // social & community
  ["social-community", 9, /\b(social media|community (managers?|leads?|specialists?|moderators?|builders?)|influencers?|ugc|content creators?|creator (partnerships?|success|programs?|managers?)|streamers?)\b/],
  ["social-community", 5, /\b(community|creators?)\b/],

  // marketing & growth
  ["marketing", 8, /\b(marketing|growth|seo|sem|ppc|paid media|demand gen\w*|lifecycle|crm|product marketing|brand managers?|public relations|pr managers?|communications?|campaigns?|advertis\w*|media buyers?|affiliates?|werbung)\b/],

  // data & AI
  ["data-ai", 9, /\b(data scien\w*|data analy\w*|data engineer\w*|machine learning|ml engineer\w*|llm|nlp|computer vision|business intelligence|bi analyst|research scientists?|ai trainers?|ai engineer\w*|prompt engineer\w*|analytics|annotation|statistic\w*)\b/],
  ["data-ai", 6, /\b(ai|data|ml)\b/],

  // engineering
  ["engineering", 7, /\b(engineer\w*|developers?|software|programmers?|back-?end|front-?end|full[- ]?stack|devops|sre|site reliability|qa|sdet|architects?|cto|embedded|firmware|react|python|java|node|ios|android|entwickler\w*|ingenieur\w*)\b/],
  ["engineering", 5, /\b(security|technology|infrastructure|cloud|platform|it)\b/],

  // product & project management
  ["product-program", 9, /\b(product managers?|product owners?|product management|program managers?|programme managers?|project managers?|project management|scrum|delivery managers?|pmo|technical program\w*|chief of staff|product leads?|projektleit\w*|projektmanag\w*)\b/],

  // sales & accounts
  ["sales-accounts", 8, /\b(sales|account executives?|account managers?|account directors?|key account|business development|bdr|sdr|customer success|client (advisors?|partners?|engagement|success)|partnerships?|partner managers?|revenue|reseller|commercial|relationship managers?|vertrieb\w*)\b/],

  // operations, finance & people
  ["ops-finance-people", 6, /\b(finance|financial|accountants?|accounting|controllers?|tax|steuerberat\w*|bookkeep\w*|buchhalt\w*|payroll|hr|human resources|people (ops|operations|partners?|team)|recruit\w*|talent acquisition|legal|counsel|compliance|contracts?|operations?|office managers?|administrat\w*|assistants?|coordinators?|support|customer service|risk|procurement|supply chain|logistics|clinical|dean|academic|teachers?|nurses?|phlebotom\w*|sachbearbeit\w*|verwaltung)\b/],
];

const EXCERPT_WEIGHT = 1 / 3;
/** A title that names nothing is sorted by its excerpt only when the excerpt names the job outright (a strength-9 signal). */
const EXCERPT_ONLY_MIN = 3;

function best(text: string): Map<CategoryId, number> {
  const scores = new Map<CategoryId, number>();
  if (!text) return scores;
  for (const [id, strength, re] of RULES) {
    if (strength > (scores.get(id) ?? 0) && re.test(text)) scores.set(id, strength);
  }
  return scores;
}

export interface Families {
  primary: CategoryId;
  /** Other families the title names just as plainly ("Graphic Designer & Video Editor"), at most two. */
  secondary: CategoryId[];
}

export function classifyFamilies(title: string, excerpt?: string | null): Families {
  const t = best(norm(title));
  // Only the opening of the excerpt: later text is usually about the company, not the role.
  const e = excerpt ? best(norm(excerpt.slice(0, 280))) : new Map<CategoryId, number>();
  const titled = [...t.values()].some((v) => v > 0);
  let primary: CategoryId = "other";
  let top = 0;
  for (const c of CATEGORIES) {
    if (c.id === "other") continue;
    const s = (t.get(c.id) ?? 0) + EXCERPT_WEIGHT * (e.get(c.id) ?? 0);
    if (s > top) {
      top = s;
      primary = c.id;
    }
  }
  if (top < (titled ? 1 : EXCERPT_ONLY_MIN)) return { primary: "other", secondary: [] };
  const primaryTitle = t.get(primary) ?? 0;
  const secondary = CATEGORIES.filter((c) => c.id !== primary && c.id !== "other" && (t.get(c.id) ?? 0) >= 8 && (t.get(c.id) ?? 0) >= primaryTitle - 2)
    .slice(0, 2)
    .map((c) => c.id);
  return { primary, secondary };
}

export const classifyCategory = (title: string, excerpt?: string | null): CategoryId => classifyFamilies(title, excerpt).primary;

// ── Level ─────────────────────────────────────────────────────────────────────────────────────────────────

const LEVEL_RULES: [Level, RegExp][] = [
  ["director", /\b(directors?|diretor\w*|directeur|direttore|vp|vice president|chief|cto|cmo|cpo|head of)\b/],
  ["lead", /\b(lead|principal|team lead|tech lead|leitung)\b/],
  ["senior", /\b(senior|sr|staff|expert|experienced|iii|iv)\b/],
  ["junior", /\b(junior|jr|entry[- ]level|graduate|berufseinsteiger\w*|associate)\b/],
  ["intern", /\b(interns?|internship|werkstudent\w*|praktikant\w*|praktikum|trainee|apprentice\w*|ausbildung|student|estagiari\w*|becari\w*|pasante|stagiaire|stage)\b/],
];

export function classifyLevel(title: string): Level | null {
  const t = norm(title);
  for (const [level, re] of LEVEL_RULES) if (re.test(t)) return level;
  return null;
}

// ── Working mode and language ─────────────────────────────────────────────────────────────────────────────

export function classifyWorkMode(input: { location?: string | null; remote_scope?: string | null; title?: string | null }): WorkMode {
  const loc = (input.location ?? "").toLowerCase();
  const title = (input.title ?? "").toLowerCase();
  if (/\bhybrid\b/.test(loc) || /\bhybrid\b/.test(title)) return "hybrid";
  if (input.remote_scope === "remote" || /\b(remote|anywhere|worldwide|work from home|wfh)\b/.test(loc) || /\b(fully remote|remote)\b/.test(title)) return "remote";
  if (loc.trim() !== "") return "onsite";
  return "unknown";
}

const GERMAN = /\b(und|für|mit|wir|sie|ein|eine|einen|der|die|das|bei|oder|deine?|ihre?|gesucht|m\/w\/d|w\/m\/d|d\/m\/w|gmbh)\b/g;
const ENGLISH = /\b(and|the|for|with|you|your|our|we|are|will|of|to|in|a|an|is|team|role)\b/g;

export function detectLanguage(text: string): Language {
  const t = fixMojibake(text).toLowerCase();
  if (t.trim().length < 12) return "other";
  const de = (t.match(GERMAN) ?? []).length;
  const en = (t.match(ENGLISH) ?? []).length;
  if (de >= 2 && de > en) return "de";
  if (en >= 2) return "en";
  return de >= 1 ? "de" : "other";
}

// ── Clean title ───────────────────────────────────────────────────────────────────────────────────────────

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B50}\u{2190}-\u{21FF}]/gu;
const TAGS = /\s*[([]\s*(?:remote|fully remote|worldwide|anywhere|hybrid|permanent work from home|work from home|m\s*\/\s*[wfd]\s*\/\s*[dfwx]|[wfd]\s*\/\s*[mwf]\s*\/\s*[dfwx]|all genders?|gn|f\s*\/\s*m\s*\/\s*d|\d+\s*%[^)\]]*|full[- ]?time|part[- ]?time|freelance|contract)\s*[)\]]\s*/gi;

/**
 * The title as a person would want to read it: entities decoded, mojibake repaired, emoji and "(remote)" / "(m/f/d)" tags dropped, a
 * title shouted in capitals set in normal case, the company name taken off the end when it is shown next to it anyway.
 */
export function cleanTitle(raw: string, company?: string | null): string {
  let s = decodeEntities(fixMojibake(raw)).replace(EMOJI, " ").replace(/\s+/g, " ").trim();
  s = s.replace(TAGS, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^(?:we(?:'|’)?re hiring|hiring|job)\s*[:\-–—]\s*/i, "");
  if (company) {
    const c = company.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`\\s+(?:at|@|\\||[-–—])\\s+${c}\\s*$`, "i"), "").trim();
  }
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length >= 8 && letters.replace(/[^A-ZÀ-Þ]/g, "").length / letters.length > 0.7) {
    s = s.toLowerCase().replace(/(^|[\s/(-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());
    s = s.replace(/\b(Ux|Ui|Seo|Sem|Crm|Hr|Qa|Cto|Cmo|Vp|Ai|Ml|Ar|Vr|Xr|3d|2d|Vfx|Cgi|Ppc|Pr|It)\b/g, (m) => m.toUpperCase());
  }
  s = s.replace(/\s*[-–—|,:;]+\s*$/, "").trim();
  return s.length > 140 ? `${s.slice(0, 137).trimEnd()}…` : s;
}

// ── One call ──────────────────────────────────────────────────────────────────────────────────────────────

export interface ClassifyInput {
  title: string;
  excerpt?: string | null;
  location?: string | null;
  remote_scope?: string | null;
}

export interface Classified {
  category: CategoryId;
  /** Other families the title names just as plainly; a filter on one of them finds this posting too. */
  alsoIn: CategoryId[];
  group: CategoryGroup;
  level: Level | null;
  workMode: WorkMode;
  language: Language;
}

export function classifyOpportunity(i: ClassifyInput): Classified {
  const { primary: category, secondary } = classifyFamilies(i.title, i.excerpt);
  return {
    category,
    alsoIn: secondary,
    group: categoryOf(category).group,
    level: classifyLevel(i.title),
    workMode: classifyWorkMode({ location: i.location, remote_scope: i.remote_scope, title: i.title }),
    language: detectLanguage(`${i.title} ${i.excerpt ?? ""}`),
  };
}
