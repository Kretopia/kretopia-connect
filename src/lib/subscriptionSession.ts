type SessionClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { access_token: string; user: { id: string } } | null }; error?: unknown }>;
    getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
};

/** Session storage is not proof that this backend still recognizes the account. */
export async function validatedSubscriptionToken(client: SessionClient, userId: string): Promise<string | null> {
  const { data, error } = await client.auth.getSession();
  const session = data.session;
  if (error || !session?.access_token || session.user.id !== userId) return null;
  const result = await client.auth.getUser(session.access_token);
  if (result.error || result.data.user?.id !== userId) return null;
  return session.access_token;
}