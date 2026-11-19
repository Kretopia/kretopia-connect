export type AuditStatus = "VERIFIED" | "PARTIALLY VERIFIED" | "NOT VERIFIED" | "UNAVAILABLE";
export interface AuditMetric {
  id: string;
  label: string;
  source: string;
  definition: string;
  status: AuditStatus;
  value: number | null;
}

export function metricValue(metric: AuditMetric): string {
  return metric.status === "VERIFIED" && metric.value !== null ? metric.value.toLocaleString("en-US") : "—";
}

export const AUDIT_TIMEZONE = "Asia/Makassar";
export const AUDIT_PERIOD = { start: "2026-08-18T16:00:00Z", requestedEndExclusive: "2026-11-19T16:00:00Z" };
export const unavailableReason = "Production records are not accessible through the current read-only connection. External-account exclusions cannot be verified.";

export const tractionMetrics: AuditMetric[] = [
  ["users", "Lifetime external users", "auth.users + profiles + user_roles", "Distinct registered account IDs, excluding internal, admin, test, team and ambiguous accounts; imported directory identities are not registrations."],
  ["creatives", "Creative accounts", "profiles.account_type", "External registered accounts classified as individual; unknown account types reported separately."],
  ["companies", "Company accounts", "profiles.account_type", "External registered accounts classified as company."],
  ["passports", "Completed Passports", "profiles + analytics_events", "Separate profile existence, onboarding_started_at and onboarding_completed. Validate completion against the actual save path; do not infer a completion date from profile creation."],
  ["uploads", "Uploaded portfolio projects", "credits + deleted_credits", "Distinct owner-uploaded records and owners; validate source, media and lifecycle. Imported or publicly sourced credits are not uploads."],
  ["matches", "Successful user matches", "matches + swipes + connections", "Unique unordered external-user pairs with match_type=creator, active match and reciprocal profile right-swipes. Pending interests and accepted connections alone are not successful Match events."],
  ["studio", "Studio projects", "projects + analytics_events", "Distinct external-owned projects confirmed through Studio; verify entry provenance. Do not equate every projects row with a Studio-created project."],
  ["scout", "Scout discoveries", "analytics_events + scouted_gigs + saved_opportunities + applications", "Separate returned recommendations, viewed opportunities, saved opportunities, applications and confirmed outcomes; catalog size is not discovery usage."],
  ["cosigns", "Co-signed records", "credit_endorsements + credits", "Accepted endorsements with responded_at and valid credit; distinguish distinct credit IDs from individual signatures. Both registered participants must meet the external cohort rule."],
  ["invoice-users", "Invoice users", "invoices.issued_by", "Distinct external issuers of actual invoice documents, excluding quotes; separate draft, sent, paid and cancelled statuses."],
].map(([id, label, source, definition]) => ({ id, label, source, definition, status: "UNAVAILABLE", value: null }));

export const meaningfulEvents = ["profile_updated", "portfolio_item_added", "swipe", "message_sent", "project_created", "project_task_completed", "project_file_shared", "opportunity_applied", "new_room_project_confirmed"];

export function auditPeriodEnd(executedAt: string): string {
  const timestamp = Date.parse(executedAt);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid audit timestamp");
  return new Date(Math.min(timestamp, Date.parse(AUDIT_PERIOD.requestedEndExclusive))).toISOString();
}