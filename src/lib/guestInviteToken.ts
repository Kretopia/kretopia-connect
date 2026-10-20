// A signed-out visitor to an invitation link can open a read-only preview of the project. The server mints the
// preview token only for a pending invitation, and requires the secret carried by the emailed link (`?t=`) when
// the invitation has one. Older invitations have none, so the secret is optional here.

// Deliberately loose: the real supabase client and a test double both fit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function mintGuestInviteToken(
  client: Client,
  projectId: string,
  email: string,
  secret?: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await client.rpc("get_or_create_guest_token_for_invite", {
      _project_id: projectId,
      _email: email,
      ...(secret ? { _secret: secret } : {}),
    });
    if (error) return null;
    return typeof data === "string" && data ? data : null;
  } catch {
    return null;
  }
}
