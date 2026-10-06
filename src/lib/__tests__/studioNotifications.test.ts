import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyUser = vi.fn(async (_p: unknown) => {});
vi.mock("@/lib/notifyUser", () => ({ notifyUser: (p: unknown) => notifyUser(p) }));

// Minimal stand-in for the supabase query builder: every filter returns the
// builder; awaiting it (or maybeSingle) resolves from the per-table fixture.
let fixtures: Record<string, any> = {};
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const q: any = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: fixtures[table]?.single ?? null, error: null }),
        then: (res: any) => res({ data: fixtures[table]?.list ?? [], error: null }),
      };
      return q;
    },
  },
}));

import {
  DEEP_LINK_TABS, deliverableDecisionDraft, notifyDeliverableDecision, notifyReviewRequested,
  notifyTaskAssigned, parseDeepLinkTab, pickRecipients, reviewRequestedDraft, studioLink, taskAssignedDraft,
} from "../studioNotifications";

beforeEach(() => {
  notifyUser.mockClear();
  fixtures = {
    projects: { single: { created_by: "owner", title: "Summer Campaign" } },
    project_collaborators: { list: [{ user_id: "client1" }, { user_id: "client1" }] },
  };
});

const sentTo = () => notifyUser.mock.calls.map((c) => (c[0] as any).userId).sort();

describe("deep links", () => {
  it("accepts only the tabs every member may open", () => {
    for (const tab of DEEP_LINK_TABS) expect(parseDeepLinkTab(tab)).toBe(tab);
    for (const bad of ["finance", "contracts", "", null, undefined, "messages ", "../x", "messages&x=1"]) {
      expect(parseDeepLinkTab(bad as any)).toBeNull();
    }
  });
  it("builds /desk links the page can read back", () => {
    expect(studioLink("p1", "messages")).toBe("/desk/p1?tab=messages");
    expect(parseDeepLinkTab(new URL(`https://x${studioLink("p1", "tasks")}`).searchParams.get("tab"))).toBe("tasks");
  });
});

describe("pickRecipients", () => {
  it("drops the actor, empties and duplicates", () => {
    expect(pickRecipients(["a", "me", null, undefined, "a", "b"], "me")).toEqual(["a", "b"]);
    expect(pickRecipients(["me"], "me")).toEqual([]);
  });
});

describe("drafts", () => {
  it("review request goes to the brief tab with a clear action", () => {
    const d = reviewRequestedDraft({ projectId: "p1", projectTitle: "Summer Campaign", deliverableTitle: "Logo" });
    expect(d).toMatchObject({ type: "deliverable_review_requested", link: "/desk/p1?tab=brief", actionText: "Review deliverable", category: "project" });
    expect(d.message).toBe('"Logo" in Summer Campaign');
  });
  it("approval vs changes requested, with the note only on changes", () => {
    const base = { projectId: "p1", projectTitle: "Summer Campaign", deliverableTitle: "Logo" };
    const ok = deliverableDecisionDraft({ ...base, decision: "approved", note: "looks great" });
    expect(ok).toMatchObject({ title: "Deliverable approved", type: "deliverable_approved" });
    expect(ok.message).not.toContain("looks great");
    const changes = deliverableDecisionDraft({ ...base, decision: "rejected", note: "  make it bolder " });
    expect(changes).toMatchObject({ title: "Changes requested", type: "deliverable_changes_requested", priority: "high" });
    expect(changes.message).toBe('"Logo" in Summer Campaign — make it bolder');
  });
  it("truncates long titles and notes", () => {
    const d = deliverableDecisionDraft({ projectId: "p", projectTitle: "T", deliverableTitle: "x".repeat(200), decision: "rejected", note: "y".repeat(300) });
    expect(d.message.length).toBeLessThan(260);
    expect(d.message).toContain("…");
  });
  it("task assigned goes to the tasks tab", () => {
    expect(taskAssignedDraft({ projectId: "p1", projectTitle: "Summer Campaign", taskTitle: "Book venue" }))
      .toMatchObject({ type: "task_assigned", link: "/desk/p1?tab=tasks", title: "New task assigned to you" });
  });
});

describe("notifyReviewRequested", () => {
  it("asks the owner and client collaborators, once each", async () => {
    await notifyReviewRequested({ projectId: "p1", projectTitle: "Summer Campaign", deliverableTitle: "Logo", actorId: "creative1" });
    expect(sentTo()).toEqual(["client1", "owner"]);
    expect((notifyUser.mock.calls[0][0] as any).type).toBe("deliverable_review_requested");
  });
  it("never notifies the person who submitted", async () => {
    await notifyReviewRequested({ projectId: "p1", projectTitle: "T", deliverableTitle: "Logo", actorId: "owner" });
    expect(sentTo()).toEqual(["client1"]);
  });
  it("does nothing when nobody else can review", async () => {
    fixtures.project_collaborators = { list: [] };
    await notifyReviewRequested({ projectId: "p1", projectTitle: "T", deliverableTitle: "Logo", actorId: "owner" });
    expect(notifyUser).not.toHaveBeenCalled();
  });
  it("looks up the project title when it isn't passed", async () => {
    await notifyReviewRequested({ projectId: "p1", deliverableTitle: "Logo", actorId: "creative1" });
    expect((notifyUser.mock.calls[0][0] as any).message).toBe('"Logo" in Summer Campaign');
  });
});

describe("notifyDeliverableDecision", () => {
  it("tells the submitter and the assignee, but not the reviewer", async () => {
    await notifyDeliverableDecision({
      projectId: "p1", projectTitle: "T", deliverableTitle: "Logo", decision: "approved",
      recipientIds: ["creative1", "creative2", null], actorId: "owner",
    });
    expect(sentTo()).toEqual(["creative1", "creative2"]);
  });
  it("skips when the reviewer is the only person involved", async () => {
    await notifyDeliverableDecision({
      projectId: "p1", projectTitle: "T", deliverableTitle: "Logo", decision: "rejected",
      recipientIds: ["owner", "owner"], actorId: "owner",
    });
    expect(notifyUser).not.toHaveBeenCalled();
  });
});

describe("notifyTaskAssigned", () => {
  it("notifies the assignee", async () => {
    await notifyTaskAssigned({ projectId: "p1", taskTitle: "Book venue", assigneeId: "creative1", actorId: "owner" });
    expect(sentTo()).toEqual(["creative1"]);
  });
  it("does not notify when you assign a task to yourself or to nobody", async () => {
    await notifyTaskAssigned({ projectId: "p1", taskTitle: "x", assigneeId: "owner", actorId: "owner" });
    await notifyTaskAssigned({ projectId: "p1", taskTitle: "x", assigneeId: null, actorId: "owner" });
    expect(notifyUser).not.toHaveBeenCalled();
  });
});
