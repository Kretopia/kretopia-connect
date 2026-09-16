// Derive tappable AgentResultCards from completed plan steps.
// Each tool returns slightly different shapes, so we map per tool_name and fall
// back to common fields (action_url, count, title) when present.
import type { AgentResultCardData } from "@/components/agent/AgentResultCard";

interface PlanStepLike {
  index: number;
  tool_name: string;
  label: string;
  status: string;
  result?: any;
}

const len = (v: any) =>
  Array.isArray(v) ? v.length :
  typeof v === "number" ? v :
  undefined;

export function deriveResultCards(steps: PlanStepLike[]): AgentResultCardData[] {
  const cards: AgentResultCardData[] = [];

  for (const s of steps) {
    if (s.status !== "succeeded" || !s.result) continue;
    const r = s.result;
    const id = `step-${s.index}`;

    // 1) Honor an explicit card emitted by a tool
    if (r.card && typeof r.card === "object") {
      cards.push({ id, icon: "generic", ...r.card });
      continue;
    }

    // 2) Per-tool mapping
    switch (s.tool_name) {
      case "create_project":
      case "spin_workspace": {
        const projectId = r.project_id ?? r.project?.id ?? r.id;
        const title = r.project?.title ?? r.title ?? s.label;
        if (projectId) {
          cards.push({
            id, icon: "project",
            title: `Workspace ready: ${title}`,
            subtitle: "Open the Studio Room to keep going.",
            href: `/desk/${projectId}`,
          });
        }
        break;
      }
      case "find_talent": {
        const n = len(r.candidates) ?? len(r.matches) ?? len(r.results);
        if (n) cards.push({
          id, icon: "talent",
          title: `${n} candidate${n === 1 ? "" : "s"} found`,
          subtitle: "Review and connect.",
          href: "/match",
        });
        break;
      }
      case "scout_sponsors":
      case "find_sponsors": {
        const n = len(r.sponsors) ?? len(r.leads) ?? len(r.candidates);
        cards.push({
          id, icon: "sponsor",
          title: n ? `${n} potential sponsor${n === 1 ? "" : "s"} found` : "Sponsor list ready",
          subtitle: "Review and approve outreach.",
          href: "/intel",
        });
        break;
      }
      case "research_web": {
        const n = len(r.leads) ?? len(r.results) ?? r.count;
        const saved = r.saved_count;
        cards.push({
          id, icon: "sponsor",
          title: n ? `${n} lead${n === 1 ? "" : "s"} found` : "No leads found",
          subtitle: saved
            ? "Saved to your Rolodex — review and start outreach."
            : "Open your Rolodex to review.",
          href: r.action_url ?? "/sales",
          cta: "Open Rolodex",
        });
        break;
      }
      case "draft_outreach":
      case "draft_dm":
      case "send_dm": {
        const n = len(r.drafts) ?? len(r.messages) ?? 1;
        cards.push({
          id, icon: "outreach",
          title: n > 1 ? `${n} outreach drafts ready` : "Outreach draft ready",
          subtitle: "Tap to review before sending.",
          href: r.action_url ?? "/inbox",
        });
        break;
      }
      case "draft_invoice": {
        const amount = r.amount ?? r.invoice?.amount;
        const currency = r.currency ?? r.invoice?.currency ?? "USD";
        cards.push({
          id, icon: "invoice",
          title: amount ? `Invoice drafted · ${currency} ${amount}` : "Invoice drafted",
          subtitle: "Review and send from KrePay.",
          href: r.action_url ?? "/thrivepay",
        });
        break;
      }
      case "draft_quote": {
        cards.push({
          id, icon: "quote",
          title: "Quote drafted",
          subtitle: "Review pricing before sending.",
          href: r.action_url ?? "/thrivepay",
        });
        break;
      }
      case "create_event":
      case "rsvp_event": {
        cards.push({
          id, icon: "event",
          title: r.title ? `Event ready: ${r.title}` : "Event ready",
          href: r.action_url ?? (r.event_id ? `/event/${r.event_id}` : null),
        });
        break;
      }
      default: {
        // Generic fallback — only emit if there's a useful action_url
        if (r.action_url) {
          cards.push({
            id, icon: "generic",
            title: r.title ?? s.label,
            subtitle: r.subtitle,
            href: r.action_url,
          });
        }
      }
    }
  }

  return cards;
}
