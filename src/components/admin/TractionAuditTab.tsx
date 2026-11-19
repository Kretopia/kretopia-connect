import { useState } from "react";
import { Activity, Download, FileCheck2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AUDIT_PERIOD, AUDIT_TIMEZONE, auditPeriodEnd, meaningfulEvents, metricValue, tractionMetrics, unavailableReason } from "@/lib/tractionAudit";
import evidence from "./traction-audit-evidence.json";

function exportAudit() {
  const blob = new Blob([JSON.stringify({ evidence, timezone: AUDIT_TIMEZONE, period: { ...AUDIT_PERIOD, observedEnd: auditPeriodEnd(evidence.executedAt) }, metrics: tractionMetrics, exclusions: { total: null, byReason: null, external: null, ambiguous: null }, activity: { daily: null, weekly: null, monthly: null, status: "NOT VERIFIED" } }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "Kretopia-traction-audit-2026-11-19.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MissingData({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-40 flex-col items-center justify-center gap-3 border-y border-border py-7 text-center"><Activity className="h-6 w-6 text-muted-foreground" /><h3 className="font-semibold">{title}</h3><Badge variant="outline">NOT VERIFIED</Badge><p className="max-w-xl text-sm text-muted-foreground">{detail}</p></div>;
}

export function TractionAuditTab() {
  const [period, setPeriod] = useState("daily");
  const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: AUDIT_TIMEZONE, dateStyle: "long", timeStyle: "long" }).format(new Date(evidence.executedAt));
  return <div className="space-y-9">
    <header className="space-y-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><BrandLogo size="sm" /><Button variant="outline" onClick={exportAudit}><Download className="mr-2 h-4 w-4" />Export audit</Button></div>
      <div><p className="text-xs font-semibold uppercase text-muted-foreground">Production intelligence · Read-only snapshot</p><h2 className="mt-2 text-2xl font-bold">Traction, with evidence.</h2></div>
      <p className="text-sm text-muted-foreground">19 August–19 November 2026 · {AUDIT_TIMEZONE} · Today is partial.</p>
      <p className="text-xs text-muted-foreground">Executed {stamp} · UTC {evidence.executedAt}</p>
      <div role="status" className="border-l-2 border-warning bg-muted/40 py-3 pl-4 pr-3"><p className="font-semibold">Production data access is incomplete</p><p className="mt-1 text-sm text-muted-foreground">The published app reads the legacy service. The accessible Cloud database is separate and lacks the required product tables. Missing data is not zero traction.</p></div>
    </header>

    <section aria-labelledby="traction-overview"><h3 id="traction-overview" className="mb-4 text-lg font-semibold">Executive overview</h3><div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{tractionMetrics.map(metric => <article key={metric.id} className="min-w-0 rounded-lg border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{metric.label}</p><p className="my-3 text-3xl font-semibold">{metricValue(metric)}</p><Badge variant="outline" className="text-[10px]">{metric.status}</Badge></article>)}</div><p className="mt-3 text-sm text-muted-foreground">{unavailableReason}</p></section>

    <section aria-labelledby="traction-growth"><h3 id="traction-growth" className="mb-4 text-lg font-semibold">User growth & meaningful activity</h3><Tabs value={period} onValueChange={setPeriod}><TabsList><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="weekly">Weekly</TabsTrigger><TabsTrigger value="monthly">Monthly</TabsTrigger></TabsList>{["daily", "weekly", "monthly"].map(value => <TabsContent key={value} value={value}><MissingData title={`${value === "daily" ? "DAU" : value === "weekly" ? "WAU" : "MAU"} and registrations unavailable`} detail="No verified external-user cohort or production activity history is accessible. Visits, logins and registrations are not active users." /></TabsContent>)}</Tabs><p className="mt-3 text-sm text-muted-foreground">Weeks: Monday 00:00 to next Monday, Asia/Makassar. Months: calendar months; August and November are partial. No simulated chart or zero-filled time series.</p></section>

    <section aria-labelledby="traction-adoption"><h3 id="traction-adoption" className="mb-4 text-lg font-semibold">Product adoption & segmentation</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-3 pr-3">Metric</th><th className="p-3">Creatives</th><th className="p-3">Companies</th></tr></thead><tbody>{tractionMetrics.map(metric => <tr key={metric.id} className="border-b border-border"><th className="py-3 pr-3 font-medium">{metric.label}</th><td className="p-3 text-muted-foreground">Unavailable</td><td className="p-3 text-muted-foreground">Unavailable</td></tr>)}</tbody></table></div><p className="mt-3 text-sm text-muted-foreground">Adoption percentages, unique participants, lifecycle counts and unknown account classifications cannot be calculated.</p></section>

    <section aria-labelledby="traction-commercial"><h3 id="traction-commercial" className="mb-4 text-lg font-semibold">Commercial & operational traction</h3><MissingData title="Co-signatures, invoices & outcomes" detail="Completed versus pending co-signatures, invoice users, issued/paid/draft/cancelled distributions, monthly usage and amounts by currency are unavailable. Company credit associations are not verified customer relationships." /></section>

    <section aria-labelledby="traction-quality" className="space-y-4"><h3 id="traction-quality" className="text-lg font-semibold">Data quality & exclusions</h3><div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" /><p className="text-sm text-muted-foreground">Exclude admins, tests, founders, team and internal companies; match ethan+, thrive+, kretopia.com and kretopiaai internally. Ambiguous accounts stay outside the external cohort. Apply the same cohort to every owner and both match/signature participants. Exclusion totals and reason counts: NOT VERIFIED.</p></div><p className="text-sm text-muted-foreground">Historical continuity: {evidence.historicalContinuity}. Earliest reliable activity date, retention, session duration, orphan records and duplicate rates: NOT VERIFIED.</p><details className="border-y border-border py-4"><summary className="cursor-pointer font-medium">Environment evidence</summary><dl className="mt-4 space-y-2 text-sm"><div><dt className="font-medium">Published app</dt><dd className="text-muted-foreground">{evidence.productionSource} · request confirmed HTTP 200</dd></div><div><dt className="font-medium">Accessible audit database</dt><dd className="text-muted-foreground">{evidence.accessibleSource} · {evidence.databaseVersion}</dd></div><div><dt className="font-medium">Cloud-only auth count</dt><dd className="text-muted-foreground">{evidence.cloudAuthAccounts} · VERIFIED for Cloud only, never the production user count</dd></div><div><dt className="font-medium">Missing required tables</dt><dd className="break-words text-muted-foreground">{evidence.missingSources.join(", ")}</dd></div></dl></details></section>

    <section aria-labelledby="traction-definitions"><h3 id="traction-definitions" className="mb-4 flex items-center gap-2 text-lg font-semibold"><FileCheck2 className="h-5 w-5" />Metric definitions & source candidates</h3><p className="mb-4 text-sm text-muted-foreground">Source candidates below come from application code, not an inspected production schema.</p>{tractionMetrics.map(metric => <details key={metric.id} className="border-b border-border py-3"><summary className="cursor-pointer text-sm font-medium">{metric.label}</summary><p className="mt-3 break-words font-mono text-xs text-muted-foreground">{metric.source}</p><p className="mt-2 text-sm text-muted-foreground">{metric.definition}</p></details>)}<p className="mt-4 text-sm text-muted-foreground">Candidate meaningful events: {meaningfulEvents.join(", ")}. Validate successful writes and event coverage before computing activity; reads alone are not completion.</p></section>
  </div>;
}