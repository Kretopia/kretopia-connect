import JSZip from "npm:jszip@3.10.1";
import type { AnalyzeResult, ImportProvider, ProviderContext, ScopeSelection, SourceObject } from "../types.ts";
import { defaultMappings, toISO } from "../types.ts";

const MAX_ZIP_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_ENTRIES = 20000;
const MAX_UNCOMPRESSED = 500 * 1024 * 1024;
const MAX_MESSAGES = 30000;
const ALLOWED_EXT = [".json"];

/** Reject traversal, absolute paths and anything not a plain nested json file. */
export function isSafeEntry(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\")) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  return ALLOWED_EXT.some((e) => path.toLowerCase().endsWith(e));
}

async function loadZip(ctx: ProviderContext): Promise<JSZip> {
  if (!ctx.uploadPath) throw new Error("No Slack export uploaded");
  const { data, error } = await ctx.supabase.storage.from("import-uploads").download(ctx.uploadPath);
  if (error) throw new Error(`Could not read upload: ${error.message}`);
  const buf = new Uint8Array(await data.arrayBuffer());
  if (buf.byteLength > MAX_ZIP_BYTES) throw new Error("That export is larger than the 200MB limit");
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files);
  if (names.length > MAX_ENTRIES) throw new Error("That export contains too many files");
  let uncompressed = 0;
  for (const n of names) {
    const f: any = zip.files[n];
    uncompressed += Number(f?._data?.uncompressedSize ?? 0);
  }
  if (uncompressed > MAX_UNCOMPRESSED) throw new Error("That export is too large to process safely");
  return zip;
}

async function readJson(zip: JSZip, path: string): Promise<any | null> {
  const f = zip.file(path);
  if (!f || !isSafeEntry(path)) return null;
  try { return JSON.parse(await f.async("string")); } catch { return null; }
}

export const slackProvider: ImportProvider = {
  id: "slack_export",
  label: "Slack export",
  auth: "upload",

  async listScopes(ctx) {
    const zip = await loadZip(ctx);
    const channels = (await readJson(zip, "channels.json")) ?? [];
    const privates = (await readJson(zip, "groups.json")) ?? [];
    const dms = (await readJson(zip, "dms.json")) ?? [];
    const users = (await readJson(zip, "users.json")) ?? [];

    const countDays = (name: string) =>
      Object.keys(zip.files).filter((p) => p.startsWith(`${name}/`) && p.endsWith(".json")).length;

    return [
      ...channels.map((c: any) => ({
        id: c.name, name: `#${c.name}`, type: "channel",
        meta: { visibility: "public", members: c.members?.length ?? 0, days: countDays(c.name), purpose: c.purpose?.value ?? "" },
      })),
      ...privates.map((c: any) => ({
        id: c.name, name: `🔒 ${c.name}`, type: "private_channel",
        meta: { visibility: "private", members: c.members?.length ?? 0, days: countDays(c.name) },
      })),
      ...dms.map((d: any) => ({ id: d.id, name: "Direct message", type: "dm", meta: { visibility: "dm" } })),
      ...users.map((u: any) => ({
        id: u.id, name: u.profile?.real_name || u.name, type: "member",
        meta: { email: u.profile?.email ?? null, avatar: u.profile?.image_72 ?? null, bot: !!u.is_bot },
      })),
    ];
  },

  async analyze(ctx: ProviderContext, scope: ScopeSelection): Promise<AnalyzeResult> {
    const zip = await loadZip(ctx);
    const warnings: string[] = [];
    const users: any[] = (await readJson(zip, "users.json")) ?? [];
    const userMap = new Map(users.map((u) => [u.id, u.profile?.real_name || u.name || u.id]));

    const allScopes = await slackProvider.listScopes(ctx);
    const selected = new Set(scope.ids ?? []);
    const channels = allScopes.filter((s) => {
      if (s.type === "dm") return scope.include_dms === true && selected.has(s.id);
      if (s.type === "private_channel") return scope.include_private_channels === true && selected.has(s.id);
      if (s.type === "channel") return selected.has(s.id);
      return false;
    });
    if (!channels.length) warnings.push("No channels selected — nothing will be archived.");
    if (scope.include_private_channels) warnings.push("Private channels are included at your confirmation.");

    const from = scope.date_from ? new Date(scope.date_from).getTime() / 1000 : null;
    const to = scope.date_to ? new Date(scope.date_to).getTime() / 1000 : null;
    const excluded = new Set(scope.exclude_members ?? []);

    const objects: SourceObject[] = [];
    let truncated = false;

    for (const ch of channels) {
      const dayFiles = Object.keys(zip.files)
        .filter((p) => p.startsWith(`${ch.id}/`) && p.endsWith(".json") && isSafeEntry(p))
        .sort();
      for (const path of dayFiles) {
        const msgs = (await readJson(zip, path)) ?? [];
        for (const m of msgs) {
          if (objects.length >= MAX_MESSAGES) { truncated = true; break; }
          const ts = Number(m.ts ?? 0);
          if (from && ts < from) continue;
          if (to && ts > to) continue;
          if (m.subtype && ["channel_join", "channel_leave"].includes(m.subtype)) continue;
          if (excluded.has(m.user)) continue;

          objects.push({
            external_object_id: `${ch.id}:${m.ts}`,
            external_parent_id: m.thread_ts && m.thread_ts !== m.ts ? `${ch.id}:${m.thread_ts}` : null,
            external_object_type: "message",
            external_url: null,
            external_author_id: m.user ?? m.bot_id ?? null,
            external_author_name: userMap.get(m.user) ?? m.username ?? m.user_profile?.real_name ?? "Unknown",
            title: null,
            source_created_at: toISO(ts),
            raw_metadata: {
              body: m.text ?? "",
              channel: ch.id,
              thread: m.thread_ts ?? null,
              reactions: m.reactions ?? [],
              files: (m.files ?? []).map((f: any) => ({
                name: f.name, url: f.url_private ?? f.permalink ?? null, type: f.filetype,
              })),
            },
          });

          if (scope.include_files) {
            for (const f of m.files ?? []) {
              objects.push({
                external_object_id: `file:${f.id ?? `${ch.id}:${m.ts}:${f.name}`}`,
                external_parent_id: `${ch.id}:${m.ts}`,
                external_object_type: "file",
                external_url: f.permalink ?? f.url_private ?? null,
                external_author_name: userMap.get(m.user) ?? "Unknown",
                title: f.name ?? "Slack file",
                source_created_at: toISO(ts),
                raw_metadata: { link_only: true, provider: "Slack", mimetype: f.mimetype ?? null, channel: ch.id },
              });
            }
          }
        }
        if (truncated) break;
      }
      if (truncated) break;
    }

    if (truncated) warnings.push(`Only the first ${MAX_MESSAGES} messages are included in this import.`);
    if (scope.include_files) warnings.push("Slack files are archived as source links — Slack exports don't contain the files themselves.");

    if (scope.include_members) {
      for (const u of users) {
        if (u.is_bot || u.deleted || excluded.has(u.id)) continue;
        objects.push({
          external_object_id: `user:${u.id}`,
          external_object_type: "member",
          external_author_name: u.profile?.real_name || u.name,
          title: u.profile?.real_name || u.name,
          raw_metadata: { email: u.profile?.email ?? null },
        });
      }
    }

    return {
      source_name: (ctx.uploadPath ?? "slack-export.zip").split("/").pop() ?? "slack-export.zip",
      source_type: "slack_export",
      objects,
      warnings,
      suggested_mappings: defaultMappings(objects),
    };
  },
};
