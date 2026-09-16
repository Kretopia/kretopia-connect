// Promotes an event into a full ThriveDesk Studio (workspace_type='event').
// Used by CreateSessionDialog when the user picks "Full Production Workspace".

import { supabase } from "@/integrations/supabase/client";
import { findArchetype, type EventArchetypeId } from "@/lib/eventArchetypes";

export interface CreateEventStudioInput {
  eventId: string;
  userId: string;
  title: string;
  description?: string | null;
  startTime?: string | null;
  archetypeId: EventArchetypeId;
  coverUrl?: string | null;
}

/**
 * Creates a Studio (project) tied to the event, mirrors the event_id linkage
 * (the DB trigger sync_project_event_link writes back creative_jams.project_id).
 * Returns the new project id, ready for navigate(`/desk/${id}`).
 */
export async function createEventStudio({
  eventId,
  userId,
  title,
  description,
  startTime,
  archetypeId,
  coverUrl,
}: CreateEventStudioInput): Promise<string> {
  const arch = findArchetype(archetypeId);
  const briefSeed = arch
    ? `${arch.label} — ${arch.blurb}\n\n${arch.producerPrompt}`
    : `Event production workspace for "${title}".`;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      title,
      description: description ?? briefSeed,
      created_by: userId,
      status: "active",
      workspace_type: "event_production" as any,
      deal_type: "solo" as any,
      event_id: eventId,
      cover_url: coverUrl ?? null,
      mood: arch?.id ?? null,
      deadline: startTime ?? null,
      setup_completed: true,
    } as any)
    .select("id")
    .single();

  if (error) throw error;

  return project.id as string;
}
