import type { AnalyzeResult, ImportProvider, ProviderContext, ScopeSelection, SourceObject, CanonicalType } from "../types.ts";
import { defaultMappings, toISO } from "../types.ts";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_ROWS = 20000;

/** Minimal RFC4180-ish parser (handles quotes, embedded commas + newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

async function readFile(ctx: ProviderContext): Promise<string> {
  if (!ctx.uploadPath) throw new Error("No CSV uploaded");
  const { data, error } = await ctx.supabase.storage.from("import-uploads").download(ctx.uploadPath);
  if (error) throw new Error(`Could not read upload: ${error.message}`);
  const buf = new Uint8Array(await data.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("CSV is larger than the 15MB limit");
  return new TextDecoder().decode(buf);
}

const FIELD_ALIASES: Record<string, string[]> = {
  title: ["title", "name", "task", "summary", "item", "deliverable"],
  description: ["description", "notes", "details", "body", "brief"],
  status: ["status", "state", "stage", "progress"],
  owner: ["owner", "assignee", "assigned to", "responsible", "person", "email"],
  start_date: ["start", "start date", "begin", "kickoff"],
  due_date: ["due", "due date", "deadline", "end date", "date"],
  amount: ["budget", "amount", "cost", "price", "value", "fee"],
  category: ["category", "type", "group", "phase"],
  priority: ["priority", "importance", "urgency"],
  external_reference: ["id", "ref", "reference", "external id", "url", "link"],
};

export function guessColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const key = h.toLowerCase().trim();
    for (const [dest, aliases] of Object.entries(FIELD_ALIASES)) {
      if (map[dest]) continue;
      if (aliases.some((a) => key === a || key.includes(a))) { map[dest] = h; break; }
    }
  }
  return map;
}

export const csvProvider: ImportProvider = {
  id: "csv",
  label: "CSV",
  auth: "upload",

  async listScopes(ctx) {
    const rows = parseCsv(await readFile(ctx));
    const headers = rows[0] ?? [];
    return headers.map((h, i) => ({ id: String(i), name: h, type: "column" }));
  },

  async analyze(ctx: ProviderContext, scope: ScopeSelection): Promise<AnalyzeResult> {
    const rows = parseCsv(await readFile(ctx));
    const warnings: string[] = [];
    if (!rows.length) throw new Error("That CSV looks empty");
    const headers = rows[0].map((h) => h.trim());
    let body = rows.slice(1);
    if (body.length > MAX_ROWS) {
      warnings.push(`Only the first ${MAX_ROWS} rows will be imported (${body.length} found).`);
      body = body.slice(0, MAX_ROWS);
    }
    const rowType = (scope.row_type ?? "task") as CanonicalType;
    const colMap = scope.column_map && Object.keys(scope.column_map).length
      ? scope.column_map
      : guessColumnMap(headers);

    const get = (r: string[], dest: string) => {
      const col = colMap[dest];
      if (!col) return null;
      const idx = headers.indexOf(col);
      return idx >= 0 ? (r[idx] ?? "").trim() || null : null;
    };

    const fileName = (ctx.uploadPath ?? "spreadsheet.csv").split("/").pop() ?? "spreadsheet.csv";
    const objects: SourceObject[] = body.map((r, i) => {
      const title = get(r, "title") ?? `Row ${i + 2}`;
      const raw: Record<string, unknown> = {
        body: get(r, "description"),
        status: get(r, "status"),
        priority: get(r, "priority"),
        owner: get(r, "owner"),
        start_date: toISO(get(r, "start_date")),
        due_date: toISO(get(r, "due_date")),
        amount: get(r, "amount"),
        category: get(r, "category"),
        row: Object.fromEntries(headers.map((h, hi) => [h, r[hi] ?? ""])),
      };
      return {
        external_object_id: get(r, "external_reference") || `${fileName}:${i + 2}`,
        external_object_type: rowType,
        external_url: null,
        title,
        raw_metadata: raw,
      };
    });

    return {
      source_name: fileName,
      source_type: "csv",
      objects,
      warnings,
      suggested_mappings: [
        ...defaultMappings(objects),
        ...Object.entries(colMap).map(([dest, col]) => ({
          source_type: `csv:${col}`,
          source_field: col,
          destination_type: null,
          destination_field: dest,
          transformation_rule: {},
          enabled: true,
        })),
      ],
    };
  },
};
