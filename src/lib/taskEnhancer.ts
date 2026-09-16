import { supabase } from "@/integrations/supabase/client";

export interface EnhanceTaskInput {
  taskId: string;
  rawTitle: string;
  existingDescription?: string | null;
  projectId: string;
  projectTitle?: string | null;
  projectDescription?: string | null;
  collaborators?: { id: string; full_name: string; role?: string | null }[];
  /** Don't overwrite the assignee if the user already picked one. */
  preserveAssignee?: boolean;
  /** If true, return the patch but don't write it to the DB. Caller will apply selectively. */
  dryRun?: boolean;
}

export interface EnhanceTaskResult {
  ok: boolean;
  patched?: {
    title?: string;
    description?: string | null;
    due_date?: string | null;
    priority?: string;
    assigned_to?: string | null;
  };
  error?: string;
}

/**
 * Calls the enhance-task edge function for a freshly created task and patches
 * the project_tasks row in place. Designed to be fired-and-forgotten right
 * after a manual insert — the UI can stay responsive while AI fills in details.
 */
export async function enhanceTaskInBackground(input: EnhanceTaskInput): Promise<EnhanceTaskResult> {
  try {
    const { data, error } = await supabase.functions.invoke("enhance-task", {
      body: {
        raw_title: input.rawTitle,
        existing_description: input.existingDescription ?? null,
        project_title: input.projectTitle ?? null,
        project_description: input.projectDescription ?? null,
        collaborators: input.collaborators ?? [],
        today_iso: new Date().toISOString().slice(0, 10),
      },
    });

    if (error) return { ok: false, error: error.message };
    if (!data || data.error) return { ok: false, error: data?.error || "No data" };

    const patch: Record<string, unknown> = {};
    if (typeof data.title === "string" && data.title.trim()) patch.title = data.title.trim();
    if (data.description !== undefined) patch.description = data.description || null;
    if (data.due_date !== undefined) patch.due_date = data.due_date || null;
    if (typeof data.priority === "string") patch.priority = data.priority;
    if (!input.preserveAssignee && data.assignee_user_id !== undefined) {
      patch.assigned_to = data.assignee_user_id || null;
    }

    if (Object.keys(patch).length === 0) return { ok: true, patched: {} };

    if (!input.dryRun) {
      const { error: updErr } = await supabase
        .from("project_tasks")
        .update(patch)
        .eq("id", input.taskId);
      if (updErr) return { ok: false, error: updErr.message };
    }

    return { ok: true, patched: patch as EnhanceTaskResult["patched"] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
