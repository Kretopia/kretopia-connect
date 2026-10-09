// What really happened after asking to connect with someone.
//
// create_bidirectional_connection now only produces an ACCEPTED connection when there is evidence the other
// person agreed (mutual swipe, they asked first, they messaged you, or the founder welcome account);
// otherwise it sends a request. Screens must say which one it was instead of announcing "Connected!".

export type ConnectionState = "accepted" | "pending" | "none";

type Row = { status: string | null };
type Q = {
  select: (cols: string) => Q;
  or: (filter: string) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
};
export type ConnectionsClient = { from: (table: string) => Q };

export async function connectionStateWith(
  client: ConnectionsClient,
  userId: string,
  otherId: string,
): Promise<ConnectionState> {
  const { data, error } = await client
    .from("connections")
    .select("status")
    .or(
      `and(user_id.eq.${userId},connected_user_id.eq.${otherId}),and(user_id.eq.${otherId},connected_user_id.eq.${userId})`,
    );
  if (error || !data?.length) return "none";
  if (data.some((r) => r.status === "accepted")) return "accepted";
  if (data.some((r) => r.status === "pending")) return "pending";
  return "none";
}
