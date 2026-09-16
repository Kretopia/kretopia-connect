// Deterministic CSV / Sheet → deliverables parser.
// NO AI involved — what's in the cells is what lands on the board.
// Used by BriefHub when the user pastes a Sheet URL or uploads/pastes CSV.

export interface ParsedReference {
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  kind: "image" | "link" | "video" | null;
}

export interface ParsedDeliverable {
  title: string;
  description: string;
  due_date: string | null;
  references: ParsedReference[];
  notes: string | null;
  kind: string; // best-effort guess based on title/description (image/video/audio/...)
}

const COL_ALIASES: Record<keyof ColMap, string[]> = {
  title:       ["title", "name", "asset", "deliverable", "task", "post", "item", "concept"],
  description: ["description", "brief", "details", "notes", "concept description", "content", "copy", "scope"],
  due_date:    ["due", "due date", "deadline", "date", "delivery", "delivery date"],
  references:  ["reference", "references", "ref", "link", "links", "url", "urls", "image", "images", "visual", "visuals", "moodboard", "inspo", "inspiration", "asset", "assets", "media"],
  notes:       ["note", "notes", "comment", "comments", "remarks", "extra"],
  kind:        ["type", "kind", "format", "category"],
};

interface ColMap {
  title: number;
  description: number;
  due_date: number;
  references: number[];
  notes: number;
  kind: number;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, " ");
const IMG_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?|#|$)/i;
const VID_EXT = /\.(mp4|mov|webm|m4v|avi)(\?|#|$)/i;
const VID_HOST = /(youtube\.com|youtu\.be|vimeo\.com|loom\.com)/i;

/** RFC-ish CSV parser supporting quoted cells, commas in cells, and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (cell.length || row.length) { row.push(cell); rows.push(row); row = []; cell = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Extract every URL from a cell (cells may have commas, newlines, or just text + url). */
function extractUrls(cell: string): string[] {
  if (!cell) return [];
  const matches = cell.match(/https?:\/\/[^\s,;\n\r"'<>]+/gi);
  return matches ? Array.from(new Set(matches)) : [];
}

function classifyUrl(url: string): ParsedReference {
  if (IMG_EXT.test(url)) return { url, thumbnail_url: url, caption: null, kind: "image" };
  if (VID_EXT.test(url) || VID_HOST.test(url)) return { url, thumbnail_url: null, caption: null, kind: "video" };
  return { url, thumbnail_url: null, caption: null, kind: "link" };
}

function guessKind(title: string, desc: string): string {
  const t = `${title} ${desc}`.toLowerCase();
  if (/\b(voice ?over|vo|narration|dub)\b/.test(t)) return "voiceover";
  if (/\b(song|track|beat|mix|master|stem|music|jingle)\b/.test(t)) return "music";
  if (/\b(audio|podcast|sfx)\b/.test(t)) return "audio";
  if (/\b(video|reel|tiktok|cut|trailer|edit|footage|montage|film)\b/.test(t)) return "video";
  if (/\b(carousel|post|feed|story|stories|igtv|tweet)\b/.test(t)) return "social_post";
  if (/\b(shoot|model|lookbook|campaign)\b/.test(t)) return "model_shoot";
  if (/\b(article|blog|copy|caption|script|essay|writing|press release)\b/.test(t)) return "writing";
  if (/\b(logo|poster|flyer|banner|design|mockup|graphic|key art|cover art)\b/.test(t)) return "design";
  if (/\b(photo|image|picture|portrait|headshot)\b/.test(t)) return "image";
  if (/\b(pdf|deck|doc|contract|brief)\b/.test(t)) return "document";
  return "other";
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Try ISO first, then Date constructor as fallback
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function buildColMap(header: string[]): ColMap {
  const map: ColMap = {
    title: -1, description: -1, due_date: -1,
    references: [], notes: -1, kind: -1,
  };
  header.forEach((h, idx) => {
    const n = norm(h);
    for (const key of Object.keys(COL_ALIASES) as (keyof ColMap)[]) {
      const aliases = COL_ALIASES[key];
      if (!aliases.some((a) => n === a || n.includes(a))) continue;
      if (key === "references") {
        map.references.push(idx);
      } else if ((map[key] as number) === -1) {
        (map as unknown as Record<string, number>)[key as string] = idx;
      }
    }
  });
  // Fallback: if no title column, use the first non-reference column
  if (map.title === -1) {
    for (let i = 0; i < header.length; i++) {
      if (!map.references.includes(i)) { map.title = i; break; }
    }
  }
  return map;
}

/**
 * Parse CSV/Sheet text into deliverables EXACTLY as they appear.
 * - Each non-empty data row becomes one deliverable.
 * - Cells that contain URLs are collected as references (multiple per row OK).
 * - No AI rewriting: title is the title cell, description is the description cell, etc.
 */
export function parseCsvToDeliverables(csvText: string): {
  deliverables: ParsedDeliverable[];
  detectedColumns: ColMap;
  rowCount: number;
} {
  const rows = parseCsv(csvText);
  if (rows.length < 1) return { deliverables: [], detectedColumns: { title: -1, description: -1, due_date: -1, references: [], notes: -1, kind: -1 }, rowCount: 0 };

  const header = rows[0].map((h) => h ?? "");
  const cols = buildColMap(header);
  const dataRows = rows.slice(1);

  const deliverables: ParsedDeliverable[] = dataRows
    .map((r) => {
      const get = (idx: number) => (idx >= 0 && idx < r.length ? (r[idx] ?? "").trim() : "");
      const title = get(cols.title);
      const description = get(cols.description);
      const due = parseDate(get(cols.due_date));
      const notes = get(cols.notes) || null;
      const kindCell = get(cols.kind);

      // Collect refs from every reference column
      const refs: ParsedReference[] = [];
      for (const ci of cols.references) {
        for (const u of extractUrls(get(ci))) refs.push(classifyUrl(u));
      }
      // Also scan description + notes for stray URLs (sometimes refs are inline)
      for (const u of extractUrls(`${description} ${notes ?? ""}`)) {
        if (!refs.some((x) => x.url === u)) refs.push(classifyUrl(u));
      }

      const kind = kindCell ? guessKind(kindCell, "") : guessKind(title, description);

      return {
        title: title || "(untitled)",
        description,
        due_date: due,
        references: refs,
        notes,
        kind,
      };
    })
    .filter((d) => d.title !== "(untitled)" || d.description || d.references.length);

  return { deliverables, detectedColumns: cols, rowCount: dataRows.length };
}

/** Convert any Google Sheets URL to its CSV export endpoint. */
export function googleSheetCsvUrl(sheetUrl: string): string | null {
  const m = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const id = m[1];
  const gidMatch = sheetUrl.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}
