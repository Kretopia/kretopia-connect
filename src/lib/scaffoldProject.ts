// Scaffolder: when a project is created, materialize the workspace's default
// Vault folders + starter deliverables so the Studio Room isn't empty on day one.
// Idempotent-ish: skips folders/tasks whose names already exist.

import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceConfig } from "@/lib/workspaceConfigs";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export async function scaffoldProjectDefaults(opts: {
  projectId: string;
  workspaceType: string | null | undefined;
  userId: string;
  /** If true, skip seeding tasks (caller already seeded their own). */
  skipTasks?: boolean;
}): Promise<void> {
  const { projectId, workspaceType, userId, skipTasks } = opts;
  const cfg = getWorkspaceConfig(workspaceType);

  // --- Vault folders ---
  try {
    const { data: existing } = await supabase
      .from("project_file_folders")
      .select("name")
      .eq("project_id", projectId);
    const have = new Set((existing ?? []).map((r: any) => norm(r.name || "")));
    const missing = (cfg.vaultFolders ?? []).filter((f) => !have.has(norm(f)));
    if (missing.length) {
      await supabase.from("project_file_folders").insert(
        missing.map((name) => ({ project_id: projectId, name, created_by: userId })),
      );
    }
  } catch (e) {
    console.warn("[scaffoldProjectDefaults] folders failed", e);
  }

  // --- Starter deliverables / tasks ---
  if (skipTasks) return;
  try {
    const { data: existing } = await supabase
      .from("project_tasks")
      .select("title")
      .eq("project_id", projectId);
    const have = new Set((existing ?? []).map((r: any) => norm(r.title || "")));
    const missing = (cfg.defaultDeliverables ?? []).filter((t) => !have.has(norm(t)));
    if (missing.length) {
      await supabase.from("project_tasks").insert(
        missing.map((title, i) => ({
          project_id: projectId,
          title: title.slice(0, 200),
          status: "todo" as const,
          priority: i === 0 ? "high" : "normal",
          labels: ["starter"],
          created_by: userId,
        })),
      );
    }
  } catch (e) {
    console.warn("[scaffoldProjectDefaults] tasks failed", e);
  }
}
