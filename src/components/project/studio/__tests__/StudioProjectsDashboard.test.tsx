import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StudioProjectsDashboard } from "../StudioProjectsDashboard";

// Only useNavigate is overridden (to capture its call args) -- everything
// else, including MemoryRouter and real route matching, is untouched.
const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

const projects = [
  { id: "a", title: "Carnival Film", status: "active", updated_at: new Date().toISOString(), client_name: "Spice House" },
  { id: "b", title: "Album Rollout", status: "completed", updated_at: new Date().toISOString(), client_name: null },
];

const renderDash = (props: Partial<React.ComponentProps<typeof StudioProjectsDashboard>> = {}) =>
  render(
    <MemoryRouter>
      <StudioProjectsDashboard
        projects={projects as any}
        invoicesByProject={{ a: "invoiced", b: "unsent" }}
        onCreate={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );

describe("StudioProjectsDashboard", () => {
  it("removes the redundant projects heading and keeps the carousel", () => {
    const { container } = renderDash();
    expect(screen.queryByRole("heading", { name: "Kretopia Projects" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Studio projects" })).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toContain("loose");
  });

  it("renders both projects with a next action", () => {
    renderDash();
    expect(screen.getByText("Carnival Film")).toBeInTheDocument();
    expect(screen.getByText("Album Rollout")).toBeInTheDocument();
    expect(screen.getByText("Open the work feed")).toBeInTheDocument();
    expect(screen.getByText("Draft the invoice")).toBeInTheDocument();
  });

  it("filters via the compact status selector", () => {
    renderDash();
    fireEvent.click(screen.getByRole("combobox", { name: "Project status" }));
    fireEvent.click(screen.getByRole("option", { name: "Active" }));
    expect(screen.getByText("Carnival Film")).toBeInTheDocument();
    expect(screen.queryByText("Album Rollout")).not.toBeInTheDocument();
  });

  it("searches by title", () => {
    renderDash();
    fireEvent.change(screen.getByLabelText("Search Projects"), { target: { value: "album" } });
    expect(screen.queryByText("Carnival Film")).not.toBeInTheDocument();
    expect(screen.getByText("Album Rollout")).toBeInTheDocument();
  });

  it("hides every money signal when the viewer may not see money", () => {
    const { container } = renderDash({ canSeeMoney: false });
    expect(container.textContent).not.toContain("Awaiting payment");
    expect(container.textContent).not.toContain("Invoiced");
    expect(container.textContent).not.toContain("Draft the invoice");
  });

  it("gates money per-project when moneyVisibleByProject is provided, not globally", () => {
    // "a" (Carnival Film) is owner-visible, "b" (Album Rollout) is not --
    // this is the real shape of a viewer's dashboard mixing roles across
    // Projects, which a single canSeeMoney boolean can't express.
    renderDash({ canSeeMoney: true, moneyVisibleByProject: { a: true, b: false } });
    const carnivalRow = screen.getByText("Carnival Film").closest("li")!;
    const albumRow = screen.getByText("Album Rollout").closest("li")!;
    expect(carnivalRow.textContent).toContain("Invoiced");
    expect(albumRow.textContent).not.toContain("No invoice");
    expect(albumRow.textContent).not.toContain("Invoiced");
  });

  it("treats a project missing from moneyVisibleByProject as not visible (fails closed)", () => {
    renderDash({ moneyVisibleByProject: { a: true } }); // "b" intentionally absent
    const albumRow = screen.getByText("Album Rollout").closest("li")!;
    expect(albumRow.textContent).not.toContain("No invoice");
    expect(albumRow.textContent).toContain("Review the delivery");
  });

  it("shows a creation-led empty state with no dead end", () => {
    renderDash({ projects: [] });
    expect(screen.getByText("No Projects yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create your first Project/i })).toBeInTheDocument();
  });

  it("renders loading and error states", () => {
    renderDash({ loading: true });
    expect(screen.getByText(/Loading your Projects/)).toBeInTheDocument();
    renderDash({ error: "network down" });
    expect(screen.getByRole("alert")).toHaveTextContent("network down");
  });

  it("navigates to the Project on row click, using its real id", () => {
    renderDash();
    fireEvent.click(screen.getByText("Carnival Film"));
    expect(mocks.navigate).toHaveBeenCalledWith("/desk/a");
  });
});

describe("StudioProjectsDashboard carousel", () => {
  afterEach(() => {
    mocks.navigate.mockClear();
    // Restore jsdom's default viewport between tests.
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
  });

  const manyProjects = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      title: `Project ${i}`,
      status: i === 0 ? "completed" : "active", // p0 is the one money-actionable row
      updated_at: new Date(2026, 0, i + 1).toISOString(),
      client_name: null,
    }));

  it("keeps every project in a single scrollable row", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    const list = manyProjects(9);
    render(
      <MemoryRouter>
        <StudioProjectsDashboard
          projects={list as any}
          invoicesByProject={{ p0: "unsent" }}
          onCreate={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("9 projects")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(9);
    expect(screen.getByRole("list", { name: "Studio projects" })).toHaveClass("overflow-x-auto", "flex");
  });

  it("keeps all projects accessible on a mobile-width viewport", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 });
    const list = manyProjects(9);
    render(
      <MemoryRouter>
        <StudioProjectsDashboard projects={list as any} onCreate={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("listitem").length).toBe(9);
  });

  it("prioritizes the money-actionable project into the default subset even when it's the oldest row", () => {
    // p0 is "completed" + unsent invoice but has the oldest updated_at.
    const list = manyProjects(9);
    render(
      <MemoryRouter>
        <StudioProjectsDashboard
          projects={list as any}
          invoicesByProject={{ p0: "unsent" }}
          onCreate={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Project 0")).toBeInTheDocument();
  });

  it("does not display a See all toggle", () => {
    render(
      <MemoryRouter>
        <StudioProjectsDashboard projects={projects as any} onCreate={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/See all/)).not.toBeInTheDocument();
  });

  it("provides labelled carousel navigation without collapsing the cards", () => {
    const list = manyProjects(9);
    render(
      <MemoryRouter>
        <StudioProjectsDashboard projects={list as any} onCreate={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("listitem").length).toBe(9);
    expect(screen.getByRole("button", { name: "Previous project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next project" })).toBeInTheDocument();
  });
});
