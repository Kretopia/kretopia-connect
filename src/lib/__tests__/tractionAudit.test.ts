import { describe, expect, it } from "vitest";
import { AUDIT_PERIOD, AUDIT_TIMEZONE, auditPeriodEnd, metricValue, tractionMetrics } from "../tractionAudit";

describe("evidence-only production traction", () => {
  it("does not turn unavailable product records into zero users", () => {
    expect(tractionMetrics.find(metric => metric.id === "users")?.value).toBeNull();
    expect(tractionMetrics.every(metric => metric.value === null && metricValue(metric) === "—")).toBe(true);
  });
  it("only renders numeric evidence when it is verified", () => {
    const metric = tractionMetrics[0];
    if (!metric) throw new Error("Missing metric");
    expect(metricValue({ ...metric, status: "NOT VERIFIED", value: 199 })).toBe("—");
    expect(metricValue({ ...metric, status: "VERIFIED", value: 0 })).toBe("0");
  });
  it("reports August 19 through November 19 in Asia/Makassar without counting future activity", () => {
    expect(AUDIT_TIMEZONE).toBe("Asia/Makassar");
    expect(AUDIT_PERIOD.start).toBe("2026-08-18T16:00:00Z");
    expect(AUDIT_PERIOD.requestedEndExclusive).toBe("2026-11-19T16:00:00Z");
    expect(auditPeriodEnd("2026-11-19T07:48:57.484126Z")).toBe("2026-11-19T07:48:57.484Z");
    expect(auditPeriodEnd("2026-11-20T00:00:00Z")).toBe("2026-11-19T16:00:00.000Z");
  });
});