// Saving and deleting Studio notes without losing or inventing anything.
//
// The old editor ran `update(...).eq("id", id)` and reported success whenever the request did not error.
// That is wrong in three ways this module fixes:
//   * last write wins: two people editing the same note silently overwrote each other
//   * zero rows updated (access removed, note deleted) still said "Note updated"
//   * delete had the same false success, and no way back
//
// Every function returns an explicit outcome, so the UI can only claim what actually happened.

export interface NoteRow {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export type SaveOutcome =
  | { status: "saved"; row: NoteRow }
  /** Someone else changed the note since it was opened here. Nothing was written. */
  | { status: "conflict"; latest: NoteRow }
  /** The note no longer exists, or this account can no longer see it. Nothing was written. */
  | { status: "gone" }
  /** The note is visible but cannot be changed by this account. Nothing was written. */
  | { status: "denied" }
  | { status: "error"; message: string };

export type DeleteOutcome =
  | { status: "deleted"; row: NoteRow }
  | { status: "gone" }
  | { status: "error"; message: string };

// Minimal structural type of the supabase client used here (kept narrow so tests can fake it).
type Q = {
  select: (cols?: string) => Q;
  update: (patch: Record<string, unknown>) => Q;
  insert: (row: Record<string, unknown>) => Q;
  delete: () => Q;
  eq: (col: string, val: string) => Q;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
};
export type NotesClient = { from: (table: string) => Q };

const TABLE = "project_notes";

/**
 * Save only if the note is still the version that was opened (compare-and-set on updated_at).
 * Pass the latest server `updated_at` as `expectedUpdatedAt` to deliberately overwrite after a conflict.
 */
export async function saveNote(
  client: NotesClient,
  note: { id: string; updated_at: string },
  patch: { title: string; content: string },
  now: () => string = () => new Date().toISOString(),
): Promise<SaveOutcome> {
  const { data, error } = await client
    .from(TABLE)
    .update({ title: patch.title, content: patch.content, updated_at: now() })
    .eq("id", note.id)
    .eq("updated_at", note.updated_at)
    .select()
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (data) return { status: "saved", row: data as NoteRow };

  // Zero rows: find out why instead of guessing.
  const { data: latest, error: lookupError } = await client.from(TABLE).select("*").eq("id", note.id).maybeSingle();
  if (lookupError) return { status: "error", message: lookupError.message };
  if (!latest) return { status: "gone" };
  const row = latest as NoteRow;
  if (row.updated_at !== note.updated_at) return { status: "conflict", latest: row };
  return { status: "denied" };
}

export async function createNote(
  client: NotesClient,
  projectId: string,
  note: { title: string; content: string },
): Promise<{ status: "created"; row: NoteRow } | { status: "error"; message: string }> {
  const { data, error } = await client
    .from(TABLE)
    .insert({ project_id: projectId, title: note.title, content: note.content })
    .select()
    .single();
  if (error || !data) return { status: "error", message: error?.message ?? "Could not create the note" };
  return { status: "created", row: data as NoteRow };
}

/** Delete and prove a row was actually removed; return the row so the delete can be undone. */
export async function deleteNote(client: NotesClient, id: string): Promise<DeleteOutcome> {
  const { data, error } = await client.from(TABLE).delete().eq("id", id).select().maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "gone" };
  return { status: "deleted", row: data as NoteRow };
}
