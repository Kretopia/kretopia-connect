// Who is calling an enrichment function: the platform (service role bearer, from batch-enrich-profiles and cron) or a member
// with a verified session, with their admin role read server-side. The decision about WHICH profile they may enrich is
// _shared/enrichmentAccess.ts. A service-role bearer is not a session, so it never goes through requireAiCaller.
import { constantTimeEqual } from "./guard.ts";
import { requireAiCaller } from "./aiPerimeter.ts";
import type { EnrichmentCaller } from "./enrichmentAccess.ts";

declare const Deno: { env: { get(name: string): string | undefined } };

/** The one query this file makes, as a structural type so the module stays testable without the SDK. */
interface RoleReader {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown }> } };
    };
  };
}

export async function resolveEnrichmentCaller(req: Request, feature: string, db: RoleReader): Promise<EnrichmentCaller> {
  const bearer = (req.headers.get("Authorization") ?? "").match(/^Bearer ([^\s]+)$/)?.[1];
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (bearer && serviceKey && (await constantTimeEqual(bearer, serviceKey))) return { kind: "service" };

  // Verifies the session on the account backend and rate-limits it; throws a 401/429 GuardError otherwise.
  const user = await requireAiCaller(req, feature);
  // A role lookup that failed grants nothing: the caller is treated as a member and may enrich their own profile only.
  const { data: role } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  return { kind: "user", id: user.id, isAdmin: !!role };
}
