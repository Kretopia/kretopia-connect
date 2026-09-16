import { supabase } from "@/integrations/supabase/client";

export type ProviderId = "notion" | "monday" | "slack_export" | "csv";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  tagline: string;
  auth: "oauth" | "upload";
  accept?: string;
  accentVar: string;
  available: boolean;
}

export const IMPORT_PROVIDERS: ProviderMeta[] = [
  { id: "notion", name: "Notion", tagline: "Pages, databases and docs", auth: "oauth", accentVar: "--signal-violet", available: true },
  { id: "monday", name: "monday.com", tagline: "Boards, items and updates", auth: "oauth", accentVar: "--signal-magenta", available: true },
  { id: "slack_export", name: "Slack", tagline: "Upload your workspace export", auth: "upload", accept: ".zip", accentVar: "--signal-amber", available: true },
  { id: "csv", name: "CSV", tagline: "Any spreadsheet of work", auth: "upload", accept: ".csv,text/csv", accentVar: "--accent-pay", available: true },
];

export const COMING_SOON = ["Trello", "Asana", "ClickUp", "Google Drive", "Dropbox"];

export interface ScopeNode {
  id: string;
  name: string;
  type: string;
  parent_id?: string | null;
  meta?: Record<string, any>;
}

export interface ImportMapping {
  source_type: string;
  source_field: string;
  destination_type: string | null;
  destination_field: string | null;
  transformation_rule?: Record<string, any>;
  enabled: boolean;
}

export interface ImportJob {
  id: string;
  provider: string;
  project_id: string | null;
  source_name: string | null;
  status: string;
  progress_percentage: number;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  skipped_items: number;
  warnings: any;
  error_summary: string | null;
  preview: any;
}

export const DESTINATION_LABELS: Record<string, string> = {
  project_tasks: "Studio tasks",
  milestones: "Milestones / phases",
  project_notes: "Brief & documents",
  project_messages: "Conversation archive",
  project_files: "Studio files",
  project_collaborators: "Suggested collaborators",
  project_deliverables: "Deliverables",
  expenses: "Expenses",
  skip: "Don't import",
};

export const SOURCE_LABELS: Record<string, string> = {
  project: "Project / board",
  task: "Tasks",
  subtask: "Subtasks",
  milestone: "Groups / phases",
  note: "Pages & docs",
  message: "Messages",
  comment: "Comments & updates",
  file: "Files & attachments",
  member: "People",
  expense: "Costs",
  deliverable: "Deliverables",
};

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.text) detail = (await ctx.text()) || detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export const startOAuth = (provider: ProviderId, returnTo?: string) =>
  call<{ url: string }>("integration-oauth-start", { provider, return_to: returnTo });

export const revokeConnection = (provider: ProviderId, purge = true) =>
  call<{ ok: boolean }>("integration-revoke", { provider, purge });

export const listScopes = (args: { provider: ProviderId; upload_path?: string | null }) =>
  call<{ scopes: ScopeNode[] }>("import-analyze", { ...args, action: "scopes" });

export const analyzeImport = (args: {
  provider: ProviderId;
  upload_path?: string | null;
  project_id?: string | null;
  scope: Record<string, unknown>;
}) =>
  call<{ job_id: string; counts: Record<string, number>; warnings: string[]; source_name: string; mappings: ImportMapping[] }>(
    "import-analyze",
    { ...args, action: "analyze" },
  );

export const runImport = (args: {
  job_id: string;
  mappings: ImportMapping[];
  project_id?: string | null;
  new_project_title?: string;
  retry_only?: boolean;
}) => call<{ ok: boolean; project_id: string }>("import-run", args);

export const generateSuggestions = (job_id: string) =>
  call<{ suggestions: number }>("import-suggest", { job_id, action: "generate" });

export const resolveSuggestions = (job_id: string, ids: string[], action: "approve" | "ignore") =>
  call<{ created?: number; ignored?: number }>("import-suggest", { job_id, action, suggestion_ids: ids });

export async function uploadImportFile(userId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const path = `${userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("import-uploads").upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function fetchConnections() {
  const { data } = await supabase
    .from("integration_connections")
    .select("id, provider, provider_account_name, connection_status, created_at")
    .is("revoked_at", null);
  return data ?? [];
}
