import type { AnalyzeResult, ImportProvider, ProviderContext, ScopeSelection, SourceObject } from "../types.ts";
import { defaultMappings, toISO } from "../types.ts";

const API = "https://api.monday.com/v2";
const MAX_OBJECTS = 5000;

async function gql(ctx: ProviderContext, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`monday.com ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text);
  if (json.errors?.length) throw new Error(`monday.com: ${json.errors[0].message}`);
  return json.data;
}

export const mondayProvider: ImportProvider = {
  id: "monday",
  label: "monday.com",
  auth: "oauth",

  async listScopes(ctx) {
    const data = await gql(ctx, `query { boards(limit: 200, state: active) { id name workspace { id name } } }`);
    const nodes: any[] = [];
    const seen = new Set<string>();
    for (const b of data.boards ?? []) {
      const ws = b.workspace;
      if (ws && !seen.has(ws.id)) {
        seen.add(ws.id);
        nodes.push({ id: `ws:${ws.id}`, name: ws.name, type: "workspace" });
      }
      nodes.push({ id: b.id, name: b.name, type: "board", parent_id: ws ? `ws:${ws.id}` : null });
    }
    return nodes;
  },

  async analyze(ctx: ProviderContext, scope: ScopeSelection): Promise<AnalyzeResult> {
    const boardIds = (scope.ids ?? []).filter((id) => !id.startsWith("ws:"));
    if (!boardIds.length) throw new Error("Pick at least one monday board");

    const warnings: string[] = [];
    const objects: SourceObject[] = [];
    let sourceName = "monday board";

    const data = await gql(
      ctx,
      `query($ids:[ID!]) {
        boards(ids:$ids) {
          id name description url
          columns { id title type settings_str }
          groups { id title color }
          items_page(limit: 500) {
            items {
              id name url created_at updated_at state
              group { id title }
              column_values { id text type value column { title } }
              subitems { id name url created_at column_values { id text type column { title } } }
              updates { id body created_at creator { id name } replies { id body created_at creator { id name } } }
              assets { id name public_url file_extension }
            }
          }
        }
      }`,
      { ids: boardIds },
    );

    for (const board of data.boards ?? []) {
      sourceName = board.name;
      objects.push({
        external_object_id: `board:${board.id}`,
        external_object_type: "project",
        external_url: board.url ?? null,
        title: board.name,
        raw_metadata: { description: board.description, columns: board.columns },
      });

      for (const g of board.groups ?? []) {
        objects.push({
          external_object_id: `group:${board.id}:${g.id}`,
          external_parent_id: `board:${board.id}`,
          external_object_type: "milestone",
          title: g.title,
          raw_metadata: { color: g.color },
        });
      }

      const items = board.items_page?.items ?? [];
      for (const it of items) {
        if (objects.length >= MAX_OBJECTS) { warnings.push("Import truncated at 5,000 items."); break; }
        const cols = Object.fromEntries((it.column_values ?? []).map((c: any) => [c.column?.title ?? c.id, c.text]));
        const status = (it.column_values ?? []).find((c: any) => c.type === "status")?.text ?? null;
        const date = (it.column_values ?? []).find((c: any) => c.type === "date" || c.type === "timeline")?.text ?? null;
        const person = (it.column_values ?? []).find((c: any) => c.type === "people")?.text ?? null;

        if (!scope.include_completed && String(status ?? "").toLowerCase().includes("done")) continue;
        if (!scope.include_archived && it.state === "archived") continue;

        objects.push({
          external_object_id: `item:${it.id}`,
          external_parent_id: `group:${board.id}:${it.group?.id}`,
          external_object_type: "task",
          external_url: it.url ?? null,
          title: it.name,
          source_created_at: toISO(it.created_at),
          source_updated_at: toISO(it.updated_at),
          raw_metadata: { status, due_date: date, owner: person, columns: cols, group: it.group?.title },
        });

        for (const sub of it.subitems ?? []) {
          const scols = Object.fromEntries((sub.column_values ?? []).map((c: any) => [c.column?.title ?? c.id, c.text]));
          objects.push({
            external_object_id: `subitem:${sub.id}`,
            external_parent_id: `item:${it.id}`,
            external_object_type: "subtask",
            external_url: sub.url ?? null,
            title: sub.name,
            source_created_at: toISO(sub.created_at),
            raw_metadata: { columns: scols, parent_item: it.name, status: scols["Status"] ?? null },
          });
        }

        if (scope.include_comments !== false) {
          for (const u of it.updates ?? []) {
            objects.push({
              external_object_id: `update:${u.id}`,
              external_parent_id: `item:${it.id}`,
              external_object_type: "comment",
              external_url: it.url ?? null,
              external_author_id: u.creator?.id ?? null,
              external_author_name: u.creator?.name ?? "monday user",
              source_created_at: toISO(u.created_at),
              raw_metadata: { body: String(u.body ?? "").replace(/<[^>]+>/g, " ").trim(), item: it.name },
            });
            for (const r of u.replies ?? []) {
              objects.push({
                external_object_id: `reply:${r.id}`,
                external_parent_id: `update:${u.id}`,
                external_object_type: "comment",
                external_author_name: r.creator?.name ?? "monday user",
                source_created_at: toISO(r.created_at),
                raw_metadata: { body: String(r.body ?? "").replace(/<[^>]+>/g, " ").trim(), item: it.name },
              });
            }
          }
        }

        if (scope.include_files) {
          for (const a of it.assets ?? []) {
            objects.push({
              external_object_id: `asset:${a.id}`,
              external_parent_id: `item:${it.id}`,
              external_object_type: "file",
              external_url: a.public_url ?? null,
              title: a.name,
              raw_metadata: { link_only: true, provider: "monday.com", ext: a.file_extension },
            });
          }
        }
      }
    }

    return {
      source_name: sourceName,
      source_type: "monday",
      objects,
      warnings,
      suggested_mappings: defaultMappings(objects),
    };
  },
};
