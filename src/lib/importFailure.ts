// What a failed website import (or a dropped Kreto request) means, in words people can act on. "Load failed" is Safari's
// text for a network-level fetch failure (Chrome says "Failed to fetch"): showing it raw tells nobody anything. Every message
// keeps the person's input and names the manual way forward; none claims the import worked or is supported when it is not.

export type ImportFailureCode =
  | "invalid_url" // not a public http(s) page
  | "unsupported" // the site blocks automated reading (LinkedIn, 999, bot walls)
  | "auth" // signed out / session expired
  | "rate_limited" // too many imports in a short time (perimeter or provider)
  | "quota" // the import allowance is used up
  | "timeout" // the site or the reader took too long
  | "unreachable" // no readable content came back
  | "network" // the connection dropped before an answer arrived
  | "upstream" // the reading/extraction service failed
  | "unknown";

export interface ImportFailure {
  code: ImportFailureCode;
  message: string;
}

const MANUAL = "You can add your work manually instead.";

export const IMPORT_FAILURE_MESSAGES: Record<ImportFailureCode, string> = {
  invalid_url: "That doesn't look like a public web page. Check the link (it should start with https://).",
  unsupported: `This site doesn't allow automatic import. ${MANUAL}`,
  auth: "Your session expired. Sign in again, then retry. Your link is kept.",
  rate_limited: "Too many imports in a short time. Wait a minute, then retry. Your link is kept.",
  quota: `You've used today's import allowance. ${MANUAL}`,
  timeout: `The site took too long to answer. Retry, or ${MANUAL.charAt(0).toLowerCase()}${MANUAL.slice(1)}`,
  unreachable: `Kreto couldn't read anything from this page. ${MANUAL}`,
  network: "The connection dropped before the import finished. Your link is kept: check your connection and retry.",
  upstream: `The import service didn't answer properly. Retry in a moment, or ${MANUAL.charAt(0).toLowerCase()}${MANUAL.slice(1)}`,
  unknown: `The import didn't finish. ${MANUAL}`,
};

const SERVER_CODES = new Set<ImportFailureCode>(["invalid_url", "unsupported", "auth", "rate_limited", "quota", "timeout", "unreachable", "network", "upstream"]);

/** A fetch that never got an HTTP answer: Safari "Load failed", Chrome "Failed to fetch", Firefox "NetworkError…". */
export function isNetworkFailure(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  if (!e) return false;
  if (e.name === "FunctionsFetchError" || e.name === "FunctionsRelayError") return true;
  return /load failed|failed to fetch|networkerror|network request failed|the network connection was lost/i.test(e.message ?? "");
}

const byStatus = (status: number): ImportFailureCode =>
  status === 400 || status === 422 ? "invalid_url"
    : status === 401 || status === 403 ? "auth"
      : status === 402 ? "quota"
        : status === 429 ? "rate_limited"
          : status === 408 || status === 504 ? "timeout"
            : status >= 500 ? "upstream"
              : "unknown";

/**
 * Classifies the result of `supabase.functions.invoke("analyze-profile-url")`: a body with `{ success: false, code }`, a
 * non-2xx answer (FunctionsHttpError, whose `context` is the Response), or a request that never got an answer.
 */
export async function classifyImportFailure(result: { data?: unknown; error?: unknown }): Promise<ImportFailure> {
  const data = (result.data ?? null) as { code?: string; isLinkedInBlock?: boolean; error?: string } | null;
  if (data?.isLinkedInBlock) return { code: "unsupported", message: IMPORT_FAILURE_MESSAGES.unsupported };
  if (data?.code && SERVER_CODES.has(data.code as ImportFailureCode)) {
    const code = data.code as ImportFailureCode;
    return { code, message: IMPORT_FAILURE_MESSAGES[code] };
  }
  const err = result.error as { name?: string; context?: unknown } | undefined;
  if (err) {
    if (isNetworkFailure(err)) return { code: "network", message: IMPORT_FAILURE_MESSAGES.network };
    const res = err.context as { status?: number; clone?: () => Response } | undefined;
    if (res && typeof res.status === "number") {
      // The function may still have said which kind of failure it was.
      try {
        const body = (await (res.clone ? res.clone() : (res as Response)).json()) as { code?: string };
        if (body?.code && SERVER_CODES.has(body.code as ImportFailureCode)) {
          const code = body.code as ImportFailureCode;
          return { code, message: IMPORT_FAILURE_MESSAGES[code] };
        }
      } catch { /* not JSON: fall back to the status */ }
      const code = byStatus(res.status);
      return { code, message: IMPORT_FAILURE_MESSAGES[code] };
    }
  }
  return { code: "unknown", message: IMPORT_FAILURE_MESSAGES.unknown };
}

/** Kreto chat: a request that never got an answer, in words (the draft is kept by the caller). */
export function describeKretoNetworkFailure(err: unknown): string {
  if (isNetworkFailure(err)) return "The connection to Kreto dropped before a reply arrived. Your message is kept: check your connection and try again.";
  return err instanceof Error && err.message ? err.message : "Network error";
}
