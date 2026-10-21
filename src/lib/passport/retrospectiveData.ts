// What the retrospective reads, and nothing more. Every query is the owner's own rows (row-level security already
// limits the tables to them): their credits, the co-signs they asked for and the co-signs they gave. Rows are
// filtered by the period on the server so a long history is not downloaded to count one year.

import type { RetroCoSign, RetroCredit } from "./retrospective";
import { retroPeriod } from "./retrospective";

export const RETRO_ROW_LIMIT = 5000;

// The slice of the Supabase client used here, so the queries can be checked without a network.
type Query = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> & Record<string, (...args: unknown[]) => Query>;
export interface RetroClient {
  from: (table: string) => { select: (columns: string) => Query };
}

export interface RetroInputs {
  credits: RetroCredit[];
  received: RetroCoSign[];
  given: RetroCoSign[];
  /** True when a query hit the row cap, so the counts may be short. */
  truncated: boolean;
}

async function run(query: Query, label: string): Promise<unknown[]> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

export async function loadRetrospectiveInputs(client: RetroClient, userId: string, year: number): Promise<RetroInputs> {
  const { start, end } = retroPeriod(year);
  const from = start.toISOString();
  const to = end.toISOString();

  const credits = client.from("credits").select("created_at, source, verification_status, endorsement_count, ai_confidence, media_type")
    .eq("user_id", userId).gte("created_at", from).lt("created_at", to).range(0, RETRO_ROW_LIMIT - 1);
  const received = client.from("credit_endorsements").select("responded_at")
    .eq("requested_by", userId).eq("status", "accepted").gte("responded_at", from).lt("responded_at", to).range(0, RETRO_ROW_LIMIT - 1);
  const given = client.from("credit_endorsements").select("responded_at")
    .eq("endorser_id", userId).neq("requested_by", userId).eq("status", "accepted").gte("responded_at", from).lt("responded_at", to).range(0, RETRO_ROW_LIMIT - 1);

  const [c, r, g] = await Promise.all([run(credits, "credits"), run(received, "co-signs received"), run(given, "co-signs given")]);
  return {
    credits: c as RetroCredit[],
    received: r as RetroCoSign[],
    given: g as RetroCoSign[],
    truncated: [c, r, g].some((rows) => rows.length >= RETRO_ROW_LIMIT),
  };
}

/** The date of the earliest credit, to know which years to offer. Null when there is none or it cannot be read. */
export async function loadEarliestActivity(client: RetroClient, userId: string): Promise<string | null> {
  const rows = (await run(client.from("credits").select("created_at").eq("user_id", userId).order("created_at", { ascending: true }).limit(1), "earliest credit")) as Array<{ created_at?: string | null }>;
  return rows[0]?.created_at ?? null;
}
