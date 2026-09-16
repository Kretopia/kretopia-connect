// Connects milestone completion to project status: when every milestone on
// a project reaches 'paid', the project moves from 'active' to 'completed'.
// Deliberately narrow -- only fires when ALL milestones are paid, and only
// moves a project OUT of 'active'. A project a user already set to
// 'paused'/'cancelled'/'completed' is never touched, so this can't
// silently override an explicit choice.

export async function syncProjectStatusIfAllMilestonesPaid(
  supabaseAdmin: any,
  projectId: string | null | undefined,
): Promise<void> {
  if (!projectId) return;

  const { data: milestones } = await supabaseAdmin
    .from("milestones")
    .select("status")
    .eq("project_id", projectId);

  if (!milestones || milestones.length === 0) return;
  const allPaid = milestones.every((m: { status: string }) => m.status === "paid");
  if (!allPaid) return;

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || project.status !== "active") return;

  await supabaseAdmin
    .from("projects")
    .update({ status: "completed" })
    .eq("id", projectId);
}
