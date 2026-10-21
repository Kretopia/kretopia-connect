/** A production role is only a claim until the relevant person/company confirms it. */
export function pendingRoleClaim(userId: string, projectName: string, role: string) {
  return { user_id: userId, project_name: projectName, role: role.trim(), verification_status: "pending" as const };
}