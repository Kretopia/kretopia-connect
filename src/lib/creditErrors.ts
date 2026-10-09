// What to tell a person when adding or changing a credit fails.
//
// The forms used to print the raw database message ("duplicate key value violates unique constraint
// credits_dedup_idx ...") or a bare "Failed to add credit". Raw messages leak internal names and do not
// say what to do; a bare failure hides that the credit already exists (the database refuses duplicates,
// which is the right behaviour: a retry after a timeout must not create a second credit).

export interface ExplainedCreditError {
  message: string;
  /** The same credit already exists: not a failure to retry, a thing to open instead. */
  duplicate: boolean;
  /** The person's input is intact and a retry is reasonable. */
  retryable: boolean;
}

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

export function explainCreditError(error: unknown): ExplainedCreditError {
  const e = (error ?? {}) as ErrorLike;
  const text = String(e?.message ?? "");

  if (e?.code === "23505" || /duplicate key|unique constraint/i.test(text)) {
    return {
      message: "You already have this credit (same project and role). Open the existing one to edit it.",
      duplicate: true,
      retryable: false,
    };
  }
  if (/JWT expired|invalid jwt|not authenticated|refresh_token/i.test(text) || e?.status === 401) {
    return {
      message: "Your session expired. Sign in again: what you typed is kept on this device.",
      duplicate: false,
      retryable: true,
    };
  }
  if (e?.code === "42501" || /row-level security|permission denied/i.test(text) || e?.status === 403) {
    return {
      message: "You don't have permission to add this credit to that profile.",
      duplicate: false,
      retryable: false,
    };
  }
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(text)) {
    return {
      message: "No connection. What you typed is kept, try again when you're back online.",
      duplicate: false,
      retryable: true,
    };
  }
  return {
    message: "The credit could not be added. What you typed is kept, try again in a moment.",
    duplicate: false,
    retryable: true,
  };
}
