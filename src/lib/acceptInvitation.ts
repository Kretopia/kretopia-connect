// Accept the invitation addressed to the signed-in person, by account or by their
// confirmed email. Done server-side (supabase/functions/accept-project-invitation):
// an invitation sent to an email address has no user_id, so row-level security lets
// the browser neither read nor update it. Accepting it from here used to report
// "not found", or a success that changed nothing.

export type AcceptResult =
  | { ok: true; status: "accepted" | "already_member" }
  /** `code` comes from the server (no_invitation, email_not_confirmed, ...), or is
   *  "unavailable" when the service couldn't be reached, so callers can fall back. */
  | { ok: false; code: string; message: string };

// Deliberately loose: the real supabase client and a test double both fit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

const messageOf = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String((e as { message: unknown }).message)
      : fallback;

export async function acceptInvitation(client: Client, projectId: string): Promise<AcceptResult> {
  try {
    const { data, error } = await client.functions.invoke("accept-project-invitation", { body: { projectId } });
    if (error) {
      // supabase-js hides the JSON body of a non-2xx answer inside error.context
      let body: { error?: string; code?: string } | null = null;
      try {
        body = await error.context?.json?.();
      } catch {
        /* no body */
      }
      return {
        ok: false,
        code: body?.code ?? "unavailable",
        message: body?.error ?? messageOf(error, "Couldn't reach the invitation service."),
      };
    }
    if (data?.status === "accepted" || data?.status === "already_member") return { ok: true, status: data.status };
    return { ok: false, code: data?.code ?? "unknown", message: data?.error ?? "Couldn't accept the invitation." };
  } catch (e) {
    return { ok: false, code: "unavailable", message: messageOf(e, "Couldn't reach the invitation service.") };
  }
}
