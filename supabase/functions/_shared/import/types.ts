// Studio Import — shared contracts.
// Every provider normalises its data into these canonical shapes so that
// preview, mapping, dedupe, writing, auditing and retry are provider-agnostic.

/** Canonical source object types every provider must normalise into. */
export type CanonicalType =
  | "project"
  | "task"
  | "subtask"
  | "milestone"
  | "note"
  | "message"
  | "comment"
  | "file"
  | "member"
  | "expense"
  | "deliverable";

/** Studio destination tables an object can be written to. */
export type DestinationType =
  | "project_tasks"
  | "milestones"
  | "project_notes"
  | "project_messages"
  | "project_files"
  | "project_collaborators"
  | "expenses"
  | "project_deliverables"
  | "skip";

export interface SourceObject {
  external_object_id: string;
  external_parent_id?: string | null;
  external_object_type: CanonicalType;
  external_url?: string | null;
  external_author_id?: string | null;
  external_author_name?: string | null;
  title?: string | null;
  source_created_at?: string | null;
  source_updated_at?: string | null;
  /** Everything the writer may need: body, status, dates, assignee, amount, channel… */
  raw_metadata: Record<string, unknown>;
}

export interface Mapping {
  source_type: string; // canonical type, or `csv:<column>` for column mapping
  source_field: string; // 'object' for whole-object routing, else field name
  destination_type: DestinationType | null;
  destination_field: string | null;
  transformation_rule: Record<string, unknown>;
  enabled: boolean;
  user_confirmed?: boolean;
}

export interface ScopeNode {
  id: string;
  name: string;
  type: string; // workspace | database | page | board | channel | file
  parent_id?: string | null;
  meta?: Record<string, unknown>;
}

export interface AnalyzeResult {
  source_name: string;
  source_type: string;
  objects: SourceObject[];
  warnings: string[];
  suggested_mappings: Mapping[];
}

export interface ScopeSelection {
  /** ids selected in step 3 */
  ids?: string[];
  date_from?: string | null;
  date_to?: string | null;
  include_completed?: boolean;
  include_archived?: boolean;
  include_comments?: boolean;
  include_files?: boolean;
  include_members?: boolean;
  include_private_channels?: boolean;
  include_dms?: boolean;
  exclude_members?: string[];
  /** csv only */
  row_type?: CanonicalType;
  column_map?: Record<string, string>;
  [k: string]: unknown;
}

export interface ProviderContext {
  supabase: any;
  userId: string;
  job: Record<string, any>;
  /** decrypted provider access token, when auth === 'oauth' */
  accessToken?: string | null;
  /** storage path in the `import-uploads` bucket, when auth === 'upload' */
  uploadPath?: string | null;
}

export interface ImportProvider {
  id: string;
  label: string;
  auth: "oauth" | "upload";
  /** Step 3 — what can the user pick? */
  listScopes(ctx: ProviderContext): Promise<ScopeNode[]>;
  /** Step 4 — normalise the selected scope into canonical objects (read-only). */
  analyze(ctx: ProviderContext, scope: ScopeSelection): Promise<AnalyzeResult>;
}

/** Default routing of canonical types → Studio tables. */
export const DEFAULT_DESTINATION: Record<CanonicalType, DestinationType> = {
  project: "skip",
  task: "project_tasks",
  subtask: "project_tasks",
  milestone: "milestones",
  note: "project_notes",
  message: "project_messages",
  comment: "project_messages",
  file: "project_files",
  member: "project_collaborators",
  expense: "expenses",
  deliverable: "project_deliverables",
};

export function defaultMappings(objects: SourceObject[]): Mapping[] {
  const types = [...new Set(objects.map((o) => o.external_object_type))];
  return types.map((t) => ({
    source_type: t,
    source_field: "object",
    destination_type: DEFAULT_DESTINATION[t] ?? "skip",
    destination_field: null,
    transformation_rule: {},
    enabled: DEFAULT_DESTINATION[t] !== "skip",
  }));
}

/** Studio task statuses are constrained — normalise anything a provider gives us. */
export function normaliseStatus(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return "todo";
  if (/(^|\b)(done|complete|completed|shipped|closed|finished|approved)/.test(s)) return "done";
  if (/(review|qa|feedback|pending approval|waiting)/.test(s)) return "review";
  if (/(progress|doing|working|active|started|wip)/.test(s)) return "in_progress";
  if (/(backlog|idea|someday|later|icebox)/.test(s)) return "backlog";
  return "todo";
}

export function normalisePriority(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase();
  if (/(urgent|critical|highest|p0)/.test(s)) return "urgent";
  if (/(high|p1)/.test(s)) return "high";
  if (/(low|p3|minor)/.test(s)) return "low";
  return "normal";
}

export function toISO(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(typeof v === "number" && v < 1e12 ? v * 1000 : (v as any));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
