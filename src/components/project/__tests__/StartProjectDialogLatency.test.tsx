import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Creating a project takes the member into it as soon as the project and its collaborator are saved. Telling the collaborator (an
// in-app notification, then an invitation email through an edge function) used to be awaited one after the other first, so the member
// waited on two more round trips (the slowest an email function) for something they did not need to see.
const world = vi.hoisted(() => ({
  calls: [] as string[],
  navigate: vi.fn(),
  toast: vi.fn(),
  notifyUser: vi.fn(),
  invoke: vi.fn(),
  failCollaborator: false,
}));

vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<typeof import("react-router-dom")>()), useNavigate: () => world.navigate }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: world.toast }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), EventCategory: { COLLABORATION: "collaboration" } }));
vi.mock("@/components/brand/KretopiaLoader", () => ({ KretopiaSpinner: () => <span /> }));
vi.mock("@/lib/notifyUser", () => ({ notifyUser: (...args: unknown[]) => world.notifyUser(...args) }));
vi.mock("@/integrations/supabase/client", () => {
  const table = (name: string) => {
    let op = "select";
    const chain: Record<string, unknown> = {};
    const answer = () => {
      world.calls.push(`${name}.${op}`);
      if (name === "projects") return { data: { id: "project-1" }, error: null };
      if (name === "profiles") return { data: { full_name: "Alex Rivera" }, error: null };
      if (name === "project_collaborators" && op === "insert") return world.failCollaborator ? { data: null, error: { message: "denied" } } : { data: { id: "collab-1" }, error: null };
      return { data: null, error: null };
    };
    chain.insert = () => ((op = "insert"), chain);
    chain.update = () => ((op = "update"), chain);
    for (const method of ["select", "eq"]) chain[method] = () => chain;
    chain.single = async () => answer();
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer()).then(resolve);
    return chain;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "member-1" } } }) },
      from: (name: string) => table(name),
      functions: { invoke: (...args: unknown[]) => world.invoke(...args) },
    },
  };
});

import { StartProjectDialog } from "../StartProjectDialog";

beforeEach(() => {
  world.calls = [];
  world.navigate.mockReset();
  world.toast.mockReset();
  // Both notifications are slow: they never answer. The member must not be waiting for them.
  world.notifyUser.mockReset();
  world.notifyUser.mockImplementation(() => new Promise(() => {}));
  world.invoke.mockReset();
  world.invoke.mockImplementation(() => new Promise(() => {}));
  world.failCollaborator = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function createProject(onOpenChange = vi.fn()) {
  render(
    <MemoryRouter>
      <StartProjectDialog open onOpenChange={onOpenChange} collaborator={{ id: "member-2", name: "Sam Lee", role: "Editor" }} currentUserRole="Director" />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByText("Custom Project"));
  fireEvent.change(await screen.findByLabelText(/Project Name/), { target: { value: "Autumn Lookbook" } });
  fireEvent.click(screen.getByRole("button", { name: /Create Project/ }));
  return onOpenChange;
}

describe("creating a project with a collaborator", () => {
  it("takes the member into the project without waiting for the notification or the invitation email", async () => {
    const onOpenChange = await createProject();
    await waitFor(() => expect(world.navigate).toHaveBeenCalledWith("/desk/project-1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(world.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Project created!" }));
    // What is stored before the member moves on: the project, its engagement and the accepted collaborator.
    expect(world.calls).toEqual(expect.arrayContaining(["projects.insert", "engagements.insert", "project_collaborators.insert", "project_collaborators.update"]));
  });

  it("still tells the collaborator, from the background, with the name the profile read gave", async () => {
    await createProject();
    await waitFor(() => expect(world.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ userId: "member-2", actionUrl: "/desk/project-1", message: expect.stringContaining("Alex Rivera") })));
  });

  it("sends the invitation email once the notification is out, and a failure in either never reaches the member", async () => {
    world.notifyUser.mockResolvedValue(undefined);
    world.invoke.mockRejectedValue(new Error("email function down"));
    await createProject();
    await waitFor(() => expect(world.invoke).toHaveBeenCalledWith("send-project-invitation", expect.objectContaining({ body: expect.objectContaining({ projectId: "project-1", inviteeUserId: "member-2", inviterName: "Alex Rivera" }) })));
    await waitFor(() => expect(world.navigate).toHaveBeenCalledWith("/desk/project-1"));
    expect(world.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Failed to create project" }));
  });
});
