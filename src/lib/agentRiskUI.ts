// UI helpers for surfacing agent action risk + friendly trigger labels.
// Used by AgentApprovalCard + ApprovalsHub so the user always knows
// what an automation will do AND why it's being proposed.

import type { OrchRiskLevel } from "./agentOrchestrator";

export interface RiskPill {
  label: string;
  className: string;
  description: string;
}

export function riskPill(level: OrchRiskLevel | undefined | null): RiskPill {
  switch (level) {
    case "safe_auto":
      return {
        label: "Low risk",
        className: "bg-energy/15 text-energy border-energy/30",
        description: "Reversible. Won't notify anyone outside Kretopia.",
      };
    case "locked":
      return {
        label: "Locked",
        className: "bg-destructive/15 text-destructive border-destructive/30",
        description: "Sensitive. Requires explicit approval every time.",
      };
    case "requires_approval":
    default:
      return {
        label: "Needs approval",
        className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        description: "Sends a message, spends money, or contacts someone outside Kretopia.",
      };
  }
}

// Friendly description of what a tool actually does — shown to the user
// so they don't have to decode "send_invoice_chase".
const TOOL_LABELS: Record<string, { what: string; why?: string }> = {
  send_invoice_chase: {
    what: "Send a polite payment reminder email.",
    why: "An invoice has been unpaid for a while.",
  },
  draft_outreach_email: {
    what: "Draft a personalized pitch to a sponsor lead.",
    why: "A new sponsor lead matches your profile.",
  },
  send_outreach_draft: {
    what: "Send the drafted outreach email.",
  },
  draft_invoice: {
    what: "Create a draft invoice.",
  },
  start_video_call: {
    what: "Start a video call in this project.",
  },
  add_credit: {
    what: "Add a credit to your profile.",
  },
  add_collaborator: { what: "Add someone to this project as a collaborator." },
  remove_collaborator: { what: "Remove someone from this project." },
  remember: { what: "Save a fact to long-term memory." },
  recall_memory: { what: "Look up something from your memory." },
  forget_memory: { what: "Forget a stored fact." },
};

export function toolFriendly(toolName: string): { what: string; why?: string } {
  if (TOOL_LABELS[toolName]) return TOOL_LABELS[toolName];
  // Fallback: humanize "snake_case_tool_name" → "Snake case tool name."
  const what = toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + ".";
  return { what };
}

// Map an outreach draft's `source` + meta into a short trigger pill.
export interface DraftTrigger {
  label: string;        // shown as a pill, e.g. "Unpaid invoice"
  reason: string;       // shown as a "Why" sentence
}

export function draftTrigger(
  source: string | null | undefined,
  meta: Record<string, unknown> | null | undefined,
): DraftTrigger {
  const m = (meta ?? {}) as Record<string, any>;
  switch (source) {
    case "chase_invoice": {
      const days = m.days_overdue ?? m.days_unpaid;
      const number = m.invoice_number ? `#${m.invoice_number}` : "";
      const amount = m.amount_label ?? m.amount;
      return {
        label: "Unpaid invoice",
        reason: [
          `Invoice ${number}`.trim(),
          amount ? `(${amount})` : "",
          days ? `is ${days} days overdue.` : "is overdue.",
        ].filter(Boolean).join(" "),
      };
    }
    case "auto_outreach":
    case "sponsor_lead": {
      const brand = m.brand_name ?? m.brand;
      return {
        label: "Sponsor lead",
        reason: brand
          ? `${brand} looks like a strong fit for your profile.`
          : "A new sponsor lead matches your profile.",
      };
    }
    case "manual":
      return { label: "You drafted this", reason: "You started this draft from Copilot." };
    default:
      return {
        label: "Suggested by Thrive",
        reason: "Thrive surfaced this based on recent activity.",
      };
  }
}
