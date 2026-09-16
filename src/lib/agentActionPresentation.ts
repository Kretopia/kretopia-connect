import type { AgentResultCardData } from "@/components/agent/AgentResultCard";
import type { OrchAction } from "@/lib/agentOrchestrator";

/**
 * Map an executed orchestrator action to a tappable result card rendered
 * inside the Thrive chat drawer. Add a new branch here when a tool ships a
 * useful destination the user should jump to after Thrive runs it.
 *
 * Tools without a card just render the chat acknowledgement.
 */
export const resultCardForAction = (action: OrchAction): AgentResultCardData | null => {
  if (action.status !== "auto_executed" && action.status !== "executed") return null;

  const result = (action.result ?? {}) as any;
  // Tool handlers sometimes wrap their payload in { result: {...} } and
  // sometimes return it flat — accept both.
  const p = (result.result ?? result) as any;
  const args = (action.tool_args ?? {}) as any;

  const projectHref = p.project_id ? `/desk/${p.project_id}` : null;
  const projectTitle = p.project_title || p.title || "your project";

  switch (action.tool_name) {
    // ----- Sponsorship & outreach -----
    case "find_sponsors": {
      const count = Array.isArray(p.leads) ? p.leads.length : p.count;
      const href = p.project_id ? `/desk/${p.project_id}?section=sponsors` : "/intel?tab=sponsors";
      return {
        id: action.id,
        icon: "sponsor",
        title: count ? `${count} sponsor lead${count === 1 ? "" : "s"} found` : "Sponsor leads ready",
        subtitle: p.project_title
          ? `Review names, contacts, and match reasons inside ${p.project_title}.`
          : "Names, contacts, sources, and match reasons saved to Intel.",
        href,
        cta: p.project_id ? "Open Sponsors" : "Open Intel",
      };
    }
    case "research_web": {
      const count = Array.isArray(p.leads) ? p.leads.length : (p.count ?? 0);
      const saved = p.saved_count ?? 0;
      const q = p.query ? String(p.query) : args.query ? String(args.query) : "your search";
      const loc = p.location ? ` in ${p.location}` : "";
      return {
        id: action.id,
        icon: "sponsor",
        title: count
          ? `${count} lead${count === 1 ? "" : "s"} found${loc ? ` ·${loc}` : ""}`
          : "No leads found — try a more specific query",
        subtitle: saved
          ? `Saved to your Rolodex — open to review, tag, and start outreach.`
          : `Open your Rolodex to review "${q}".`,
        href: p.action_url || "/sales",
        cta: "Open Rolodex",
      };
    }
    case "draft_outreach_email":
    case "draft_outreach": {
      return {
        id: action.id,
        icon: "outreach",
        title: p.recipient_name
          ? `Outreach draft for ${p.recipient_name}`
          : "Outreach draft ready",
        subtitle: "Review and personalize before sending.",
        href: p.action_url || "/inbox",
        cta: "Review draft",
      };
    }
    case "chase_followups": {
      const count = Array.isArray(p.drafts) ? p.drafts.length : (p.count ?? 0);
      return {
        id: action.id,
        icon: "outreach",
        title: count
          ? `${count} follow-up${count === 1 ? "" : "s"} drafted`
          : "No follow-ups needed right now",
        subtitle: count ? "Review the chase messages before they go out." : undefined,
        href: count ? "/inbox" : null,
        cta: "Review",
      };
    }
    case "apply_to_gig":
    case "draft_gig_application": {
      return {
        id: action.id,
        icon: "outreach",
        title: p.gig_title ? `Application drafted: ${p.gig_title}` : "Gig application drafted",
        subtitle: "Tweak the cover letter, then submit.",
        href: p.action_url || (p.gig_id ? `/gigs/${p.gig_id}` : "/gigs"),
        cta: "Review",
      };
    }

    // ----- Money & quotes -----
    case "draft_invoice":
    case "draft_milestone_invoice": {
      const amount = p.amount ?? p.total ?? args.amount;
      const currency = p.currency ?? args.currency ?? "USD";
      const amountLabel =
        amount != null ? `${currency} ${Number(amount).toLocaleString()}` : "Draft invoice";
      return {
        id: action.id,
        icon: "invoice",
        title: `${amountLabel} draft ready`,
        subtitle: projectTitle
          ? `For ${projectTitle} — review before sending.`
          : "Review before sending.",
        href: p.action_url || (p.invoice_id ? `/thrivepay?invoice=${p.invoice_id}` : "/thrivepay"),
        cta: "Open Pay",
      };
    }
    case "draft_quote": {
      const amount = p.amount ?? p.total ?? args.amount;
      const currency = p.currency ?? args.currency ?? "USD";
      const amountLabel = amount != null ? `${currency} ${Number(amount).toLocaleString()}` : "Quote";
      return {
        id: action.id,
        icon: "quote",
        title: `${amountLabel} quote drafted`,
        subtitle: projectTitle ? `For ${projectTitle} — review and send.` : "Review and send.",
        href: p.action_url || (p.quote_id ? `/thrivepay?quote=${p.quote_id}` : "/thrivepay"),
        cta: "Open Pay",
      };
    }
    case "charge_card": {
      const amount = p.amount ?? args.amount;
      const currency = p.currency ?? args.currency ?? "USD";
      return {
        id: action.id,
        icon: "money",
        title: amount
          ? `${currency} ${Number(amount).toLocaleString()} charged`
          : "Charge captured",
        subtitle: "Receipt saved to Pay.",
        href: "/thrivepay",
        cta: "Open Pay",
      };
    }
    case "weekly_money_summary": {
      return {
        id: action.id,
        icon: "money",
        title: "Money summary ready",
        subtitle: "Review invoices and payment next steps.",
        href: "/thrivepay",
        cta: "Open Pay",
      };
    }

    // ----- Projects, tasks, collaborators -----
    case "create_project": {
      return {
        id: action.id,
        icon: "project",
        title: p.title ? `Studio created: ${p.title}` : "New Studio created",
        subtitle: "Drop a brief or invite collaborators to get rolling.",
        href: projectHref || "/desk",
        cta: "Open Studio",
      };
    }
    case "create_task": {
      return {
        id: action.id,
        icon: "project",
        title: p.task_title || args.title ? `Task added: ${p.task_title || args.title}` : "Task added",
        subtitle: projectTitle ? `On ${projectTitle}.` : undefined,
        href: projectHref,
        cta: "Open tasks",
      };
    }
    case "mark_task_done": {
      return {
        id: action.id,
        icon: "project",
        title: p.task_title ? `Task done: ${p.task_title}` : "Task marked done",
        subtitle: projectTitle ? `On ${projectTitle}.` : undefined,
        href: projectHref,
        cta: "Open tasks",
      };
    }
    case "assign_task": {
      return {
        id: action.id,
        icon: "talent",
        title: p.task_title
          ? `Assigned ${p.task_title} → ${p.assignee_name ?? "collaborator"}`
          : "Task assigned",
        href: projectHref,
        cta: "Open tasks",
      };
    }
    case "add_collaborator": {
      return {
        id: action.id,
        icon: "talent",
        title: p.added_name
          ? `${p.added_name} added to ${projectTitle}`
          : `Collaborator added to ${projectTitle}`,
        subtitle: "They'll see the Studio next time they open Thrive.",
        href: p.action_url || projectHref,
        cta: "Open Studio",
      };
    }
    case "archive_project": {
      return {
        id: action.id,
        icon: "project",
        title: `${projectTitle} archived`,
        subtitle: "You can restore it from your Studios list.",
        href: "/desk",
        cta: "Open Studios",
      };
    }
    case "get_project_summary": {
      return {
        id: action.id,
        icon: "project",
        title: `Status: ${projectTitle}`,
        subtitle: p.summary ? String(p.summary).slice(0, 90) : undefined,
        href: projectHref,
        cta: "Open Studio",
      };
    }
    case "generate_milestones": {
      const count = Array.isArray(p.milestones) ? p.milestones.length : p.count;
      return {
        id: action.id,
        icon: "project",
        title: count ? `${count} milestones generated` : "Milestones drafted",
        subtitle: projectTitle ? `On ${projectTitle}.` : undefined,
        href: projectHref,
        cta: "Open Studio",
      };
    }

    // ----- Credits & verification -----
    case "add_credit":
    case "draft_credit": {
      return {
        id: action.id,
        icon: "generic",
        title: p.credit_title ? `Credit drafted: ${p.credit_title}` : "Credit drafted",
        subtitle: "Add collaborators and publish to your Passport.",
        href: p.action_url || (p.credit_id ? `/credits/${p.credit_id}` : "/profile"),
        cta: "Open credit",
      };
    }

    // ----- Events & gigs -----
    case "create_event": {
      return {
        id: action.id,
        icon: "event",
        title: p.event_title ? `Event created: ${p.event_title}` : "Event created",
        subtitle: "Add cover art, ticket tiers, and invite guests.",
        href: p.action_url || (p.event_id ? `/event/${p.event_id}` : "/events"),
        cta: "Open event",
      };
    }
    case "generate_event_cover": {
      return {
        id: action.id,
        icon: "event",
        title: "Event cover generated",
        subtitle: "Preview, swap, or regenerate.",
        href: p.action_url || (p.event_id ? `/event/${p.event_id}` : null),
        cta: "View event",
      };
    }
    case "create_gig": {
      return {
        id: action.id,
        icon: "outreach",
        title: p.gig_title ? `Gig posted: ${p.gig_title}` : "Gig drafted",
        subtitle: "Review the brief and publish when ready.",
        href: p.action_url || (p.gig_id ? `/gigs/${p.gig_id}` : "/gigs"),
        cta: "Open gig",
      };
    }

    // ----- People & enrichment -----
    case "find_user": {
      const matches = Array.isArray(p.candidates) ? p.candidates.length : p.count;
      return {
        id: action.id,
        icon: "talent",
        title: matches ? `${matches} match${matches === 1 ? "" : "es"} found` : "No match found",
        subtitle: matches ? "Tell Thrive which one — she'll continue from there." : undefined,
        href: null,
      };
    }
    case "analyze_profile_url": {
      return {
        id: action.id,
        icon: "talent",
        title: p.name ? `Imported: ${p.name}` : "Profile imported",
        subtitle: "Pulled into your Rolodex with credits + contact info.",
        href: p.action_url || "/sales",
        cta: "Open Rolodex",
      };
    }
    case "enrich_profile": {
      return {
        id: action.id,
        icon: "talent",
        title: "Passport enriched",
        subtitle: "New links, credits, or press added to your profile.",
        href: "/profile",
        cta: "Open Passport",
      };
    }
    case "mark_lead": {
      return {
        id: action.id,
        icon: "outreach",
        title: p.lead_name ? `${p.lead_name} added to pipeline` : "Lead added to pipeline",
        href: "/sales",
        cta: "Open Rolodex",
      };
    }

    // ----- Memory ops are intentionally silent (no card) -----
    case "remember":
    case "recall_memory":
    case "forget_memory":
      return null;

    default:
      return null;
  }
};
