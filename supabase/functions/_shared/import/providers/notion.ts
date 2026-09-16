import type { AnalyzeResult, ImportProvider, ProviderContext, ScopeSelection, SourceObject } from "../types.ts";
import { defaultMappings, toISO } from "../types.ts";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const MAX_OBJECTS = 5000;

async function notion(ctx: ProviderContext, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Notion ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const plain = (rich: any[]): string => (rich ?? []).map((r) => r?.plain_text ?? "").join("");

function titleOf(page: any): string {
  const props = page.properties ?? {};
  for (const v of Object.values<any>(props)) {
    if (v?.type === "title") return plain(v.title) || "Untitled";
  }
  return plain(page.title) || "Untitled";
}

/** Flatten Notion blocks to markdown-ish text; unsupported blocks are preserved verbatim. */
async function blocksToText(ctx: ProviderContext, blockId: string, depth = 0): Promise<{ text: string; unsupported: string[] }> {
  if (depth > 2) return { text: "", unsupported: [] };
  let cursor: string | undefined;
  const lines: string[] = [];
  const unsupported: string[] = [];
  do {
    const q: any = await notion(ctx, `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    for (const b of q.results ?? []) {
      const t = b.type;
      const rich = b[t]?.rich_text;
      if (rich) {
        const prefix = t === "heading_1" ? "# " : t === "heading_2" ? "## " : t === "heading_3" ? "### "
          : t === "bulleted_list_item" ? "- " : t === "numbered_list_item" ? "1. "
          : t === "to_do" ? (b.to_do?.checked ? "- [x] " : "- [ ] ") : t === "quote" ? "> " : "";
        lines.push(prefix + plain(rich));
      } else if (t === "image" || t === "file" || t === "pdf" || t === "bookmark" || t === "embed") {
        const url = b[t]?.external?.url ?? b[t]?.file?.url ?? b[t]?.url;
        if (url) lines.push(`[${t}](${url})`);
      } else if (t === "divider") lines.push("---");
      else unsupported.push(t);
      if (b.has_children && t !== "child_page" && t !== "child_database") {
        const nested = await blocksToText(ctx, b.id, depth + 1);
        if (nested.text) lines.push(nested.text.split("\n").map((l) => `  ${l}`).join("\n"));
        unsupported.push(...nested.unsupported);
      }
    }
    cursor = q.has_more ? q.next_cursor : undefined;
  } while (cursor);
  return { text: lines.join("\n"), unsupported: [...new Set(unsupported)] };
}

function propValue(v: any): unknown {
  switch (v?.type) {
    case "title": case "rich_text": return plain(v[v.type]);
    case "number": return v.number;
    case "select": return v.select?.name ?? null;
    case "multi_select": return (v.multi_select ?? []).map((s: any) => s.name);
    case "status": return v.status?.name ?? null;
    case "date": return v.date?.start ?? null;
    case "checkbox": return v.checkbox;
    case "people": return (v.people ?? []).map((p: any) => p.name ?? p.id);
    case "url": return v.url;
    case "email": return v.email;
    case "files": return (v.files ?? []).map((f: any) => ({ name: f.name, url: f.external?.url ?? f.file?.url }));
    case "relation": return (v.relation ?? []).map((r: any) => r.id);
    case "formula": return v.formula?.string ?? v.formula?.number ?? null;
    default: return null;
  }
}

export const notionProvider: ImportProvider = {
  id: "notion",
  label: "Notion",
  auth: "oauth",

  async listScopes(ctx) {
    const out: any[] = [];
    let cursor: string | undefined;
    do {
      const res: any = await notion(ctx, "/search", {
        method: "POST",
        body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
      });
      for (const r of res.results ?? []) {
        out.push({
          id: r.id,
          name: r.object === "database" ? plain(r.title) || "Untitled database" : titleOf(r),
          type: r.object === "database" ? "database" : "page",
          parent_id: r.parent?.page_id ?? r.parent?.database_id ?? null,
          meta: { url: r.url, last_edited: r.last_edited_time },
        });
      }
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor && out.length < 500);
    return out;
  },

  async analyze(ctx: ProviderContext, scope: ScopeSelection): Promise<AnalyzeResult> {
    const warnings: string[] = [];
    const objects: SourceObject[] = [];
    const unsupportedAll = new Set<string>();
    const ids = scope.ids ?? [];
    if (!ids.length) throw new Error("Pick at least one Notion page or database");

    let sourceName = "Notion";

    for (const id of ids) {
      let kind: "page" | "database" = "page";
      let meta: any = null;
      try { meta = await notion(ctx, `/databases/${id}`); kind = "database"; }
      catch { meta = await notion(ctx, `/pages/${id}`); kind = "page"; }

      if (kind === "database") {
        sourceName = plain(meta.title) || "Notion database";
        objects.push({
          external_object_id: id,
          external_object_type: "project",
          external_url: meta.url ?? null,
          title: sourceName,
          source_created_at: toISO(meta.created_time),
          raw_metadata: { schema: Object.keys(meta.properties ?? {}) },
        });
        let cursor: string | undefined;
        do {
          const q: any = await notion(ctx, `/databases/${id}/query`, {
            method: "POST",
            body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
          });
          for (const row of q.results ?? []) {
            if (objects.length >= MAX_OBJECTS) break;
            const props = Object.fromEntries(
              Object.entries(row.properties ?? {}).map(([k, v]) => [k, propValue(v)]),
            );
            const status = props["Status"] ?? props["status"] ?? props["State"] ?? null;
            const due = props["Due"] ?? props["Due date"] ?? props["Date"] ?? props["Deadline"] ?? null;
            const done = row.properties?.Done?.checkbox ?? null;
            if (!scope.include_completed && (String(status ?? "").toLowerCase().includes("done") || done === true)) continue;
            if (!scope.include_archived && row.archived) continue;
            objects.push({
              external_object_id: row.id,
              external_parent_id: id,
              external_object_type: "task",
              external_url: row.url ?? null,
              title: titleOf(row),
              source_created_at: toISO(row.created_time),
              source_updated_at: toISO(row.last_edited_time),
              raw_metadata: {
                status: status ?? (done ? "done" : null),
                due_date: due,
                priority: props["Priority"] ?? null,
                owner: Array.isArray(props["Assignee"]) ? props["Assignee"][0] : props["Assignee"] ?? null,
                properties: props,
              },
            });
          }
          cursor = q.has_more ? q.next_cursor : undefined;
        } while (cursor && objects.length < MAX_OBJECTS);
      } else {
        const title = titleOf(meta);
        sourceName = title;
        const { text, unsupported } = await blocksToText(ctx, id);
        unsupported.forEach((u) => unsupportedAll.add(u));
        objects.push({
          external_object_id: id,
          external_object_type: "note",
          external_url: meta.url ?? null,
          title,
          source_created_at: toISO(meta.created_time),
          source_updated_at: toISO(meta.last_edited_time),
          raw_metadata: {
            body: text,
            properties: Object.fromEntries(Object.entries(meta.properties ?? {}).map(([k, v]) => [k, propValue(v)])),
            unsupported_blocks: unsupported,
          },
        });
      }
    }

    if (unsupportedAll.size) {
      warnings.push(
        `Some Notion blocks (${[...unsupportedAll].join(", ")}) can't be rendered natively — they're kept in a read-only "Imported content" note.`,
      );
    }

    return { source_name: sourceName, source_type: "notion", objects, warnings, suggested_mappings: defaultMappings(objects) };
  },
};
