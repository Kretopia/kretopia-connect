import type { DestinationType, Mapping, SourceObject } from "./types.ts";
import { DEFAULT_DESTINATION, normalisePriority, normaliseStatus } from "./types.ts";

export interface WriteResult {
  result: "created" | "skipped_duplicate" | "skipped_mapping" | "failed";
  table?: string;
  id?: string;
  error?: string;
}

function mappingFor(mappings: Mapping[], type: string): Mapping | undefined {
  return mappings.find((m) => m.source_type === type && m.source_field === "object");
}

function destinationFor(mappings: Mapping[], obj: SourceObject): DestinationType {
  const m = mappingFor(mappings, obj.external_object_type);
  if (m && m.enabled === false) return "skip";
  return (m?.destination_type as DestinationType) ?? DEFAULT_DESTINATION[obj.external_object_type] ?? "skip";
}

const str = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};

/**
 * Writes a single normalised source object into the destination Studio table.
 * Idempotent: an object with the same (project_id, provider, external_id) is never written twice.
 */
export async function writeObject(
  supabase: any,
  opts: {
    projectId: string;
    userId: string;
    jobId: string;
    provider: string;
    mappings: Mapping[];
    obj: SourceObject;
    /** external_object_id -> created row id, for parent linking */
    idMap: Map<string, string>;
  },
): Promise<WriteResult> {
  const { projectId, userId, jobId, provider, mappings, obj, idMap } = opts;
  const dest = destinationFor(mappings, obj);
  if (dest === "skip") return { result: "skipped_mapping" };

  const raw = obj.raw_metadata ?? {};
  const provenance = {
    import_job_id: jobId,
    source_provider: provider,
    external_id: obj.external_object_id,
    external_url: obj.external_url ?? null,
    imported_at: new Date().toISOString(),
  };

  // ---- dedupe -------------------------------------------------------------
  if (dest !== "project_collaborators") {
    const { data: existing } = await supabase
      .from(dest)
      .select("id")
      .eq(dest === "expenses" ? "user_id" : "project_id", dest === "expenses" ? userId : projectId)
      .eq("source_provider", provider)
      .eq("external_id", obj.external_object_id)
      .maybeSingle();
    if (existing?.id) {
      idMap.set(obj.external_object_id, existing.id);
      return { result: "skipped_duplicate", table: dest, id: existing.id };
    }
  }

  let payload: Record<string, unknown>;

  switch (dest) {
    case "project_tasks": {
      const parentTitle = str(raw.parent_item);
      payload = {
        project_id: projectId,
        created_by: userId,
        title: (obj.title ?? "Untitled").slice(0, 300),
        description: [str(raw.body), parentTitle ? `Subtask of: ${parentTitle}` : null]
          .filter(Boolean).join("\n\n") || null,
        status: normaliseStatus(raw.status),
        priority: normalisePriority(raw.priority),
        due_date: str(raw.due_date),
        labels: [
          `imported:${provider}`,
          ...(str(raw.group) ? [String(raw.group)] : []),
          ...(str(raw.category) ? [String(raw.category)] : []),
        ],
        ...provenance,
      };
      break;
    }
    case "milestones": {
      payload = {
        project_id: projectId,
        created_by: userId,
        title: (obj.title ?? "Phase").slice(0, 300),
        description: str(raw.body),
        due_date: str(raw.due_date),
        amount: num(raw.amount),
        status: normaliseStatus(raw.status) === "done" ? "approved" : "pending",
        ...provenance,
      };
      break;
    }
    case "project_notes": {
      const unsupported = Array.isArray(raw.unsupported_blocks) ? (raw.unsupported_blocks as string[]) : [];
      const body = [
        str(raw.body) ?? "",
        unsupported.length
          ? `\n\n---\n_Imported content — some ${provider} blocks (${unsupported.join(", ")}) are kept as-is and are read-only._`
          : "",
        obj.external_url ? `\n\nSource: ${obj.external_url}` : "",
      ].join("");
      payload = {
        project_id: projectId,
        created_by: userId,
        title: (obj.title ?? "Imported note").slice(0, 300),
        content: body,
        is_read_only: true,
        ...provenance,
      };
      break;
    }
    case "project_messages": {
      payload = {
        project_id: projectId,
        user_id: null,
        message: str(raw.body) ?? "(no text)",
        is_imported: true,
        external_author_name: obj.external_author_name ?? "Unknown",
        external_channel: str(raw.channel) ?? str(raw.item),
        source_created_at: obj.source_created_at ?? null,
        reply_to: obj.external_parent_id ? idMap.get(obj.external_parent_id) ?? null : null,
        ...provenance,
      };
      break;
    }
    case "project_files": {
      payload = {
        project_id: projectId,
        user_id: userId,
        file_name: (obj.title ?? "Imported file").slice(0, 300),
        file_url: obj.external_url ?? "",
        file_type: "link",
        is_link: true,
        link_provider: String(raw.provider ?? provider),
        ...provenance,
      };
      if (!payload.file_url) return { result: "skipped_mapping" };
      break;
    }
    case "project_deliverables": {
      payload = {
        project_id: projectId,
        title: (obj.title ?? "Deliverable").slice(0, 300),
        description: str(raw.body),
        status: "pending",
        source: `import:${provider}`,
        due_date: str(raw.due_date),
        ...provenance,
      };
      break;
    }
    case "expenses": {
      payload = {
        user_id: userId,
        project_id: projectId,
        title: (obj.title ?? "Expense").slice(0, 300),
        amount: num(raw.amount) ?? 0,
        currency: "USD",
        category: str(raw.category) ?? "other",
        date: (obj.source_created_at ?? new Date().toISOString()).slice(0, 10),
        notes: str(raw.body),
        ...provenance,
      };
      break;
    }
    case "project_collaborators": {
      const email = str((raw as any).email);
      if (!email) return { result: "skipped_mapping" };
      const { data: dup } = await supabase
        .from("project_collaborators")
        .select("id").eq("project_id", projectId).eq("email", email).maybeSingle();
      if (dup?.id) return { result: "skipped_duplicate", table: dest, id: dup.id };
      // Suggested only — never auto-invited.
      payload = {
        project_id: projectId,
        email,
        role: "collaborator",
        status: "suggested",
        invited_by: userId,
      };
      break;
    }
    default:
      return { result: "skipped_mapping" };
  }

  const { data, error } = await supabase.from(dest).insert(payload).select("id").single();
  if (error) {
    // unique index race → treat as duplicate, not failure
    if (String(error.code) === "23505") return { result: "skipped_duplicate", table: dest };
    return { result: "failed", table: dest, error: error.message };
  }
  idMap.set(obj.external_object_id, data.id);
  return { result: "created", table: dest, id: data.id };
}

/** Order matters: parents before children so reply/thread links resolve. */
export const WRITE_ORDER: string[] = [
  "project", "milestone", "note", "task", "subtask", "message", "comment", "file", "deliverable", "expense", "member",
];

export function sortForWrite(objects: SourceObject[]): SourceObject[] {
  return [...objects].sort((a, b) => {
    const oa = WRITE_ORDER.indexOf(a.external_object_type);
    const ob = WRITE_ORDER.indexOf(b.external_object_type);
    if (oa !== ob) return oa - ob;
    return String(a.source_created_at ?? "").localeCompare(String(b.source_created_at ?? ""));
  });
}
