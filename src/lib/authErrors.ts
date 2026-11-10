/**
 * What kind of failure a sign-up call came back with, read from the server's own status and code first and its words second.
 *
 * The classification used to test the words in one order ("password", then "email", then "rate"), so "email rate limit exceeded" (the
 * limit on confirmation emails, which can turn away every new member for the rest of the hour) was filed under "invalid_email" in the
 * funnel and the person was shown the server's raw sentence. A limit is now named as one, first.
 */
export type SignupErrorKind = "already_registered" | "rate_limited" | "weak_password" | "network_error" | "invalid_email" | "other";

interface ErrorLike {
  message?: string | null;
  status?: number | null;
  code?: string | null;
  name?: string | null;
}

const asErrorLike = (error: unknown): ErrorLike =>
  error && typeof error === "object" ? (error as ErrorLike) : { message: typeof error === "string" ? error : "" };

export function classifySignupError(error: unknown): SignupErrorKind {
  const { message, status, code, name } = asErrorLike(error);
  const text = (message ?? "").toLowerCase();
  const errorCode = (code ?? "").toLowerCase();

  if (errorCode === "user_already_exists" || errorCode === "email_exists" || text.includes("already registered")) return "already_registered";
  if (status === 429 || errorCode.startsWith("over_") || text.includes("rate limit") || text.includes("too many") || text.includes("for security purposes")) {
    return "rate_limited";
  }
  if (errorCode === "weak_password" || text.includes("password")) return "weak_password";
  if (text.includes("failed to fetch") || text.includes("networkerror") || name === "AuthRetryableFetchError") return "network_error";
  if (text.includes("email")) return "invalid_email";
  return "other";
}

/** What a person is told about a limit: honest about it, and what to do. Never the server's raw sentence. */
export const RATE_LIMIT_NOTICE = {
  title: "Too many sign-up attempts",
  description: "We can only send so many confirmation emails at a time. Wait a minute, then try again.",
} as const;
