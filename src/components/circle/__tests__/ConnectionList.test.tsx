import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/circle/NetworkVisualization", () => ({ NetworkVisualization: () => <div data-testid="network-visual" /> }));
vi.mock("@/components/InviteDialog", () => ({ InviteDialog: () => null }));
let credits: { user_id: string; project_name: string; role: string }[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ in: () => ({ order: () => Promise.resolve({ data: credits }) }) }) }) },
}));

import { ConnectionList } from "../ConnectionList";

const person = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  user_id: id, full_name: name, role: "Editor", bio: null, avatar_url: null, location: null, badge: "", level: 1, ...extra,
});
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

const renderList = (props: Partial<React.ComponentProps<typeof ConnectionList>> = {}) => {
  const onMessage = vi.fn();
  render(
    <MemoryRouter initialEntries={["/match?tab=connected"]}>
      <Routes>
        <Route path="/match" element={<ConnectionList connections={[]} loading={false} onMessage={onMessage} {...props} />} />
        <Route path="/profile/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return { onMessage };
};

beforeEach(() => {
  credits = [];
});

describe("ConnectionList: a connection is the shared profile card", () => {
  const ana = person("a", "Ana Ruiz", { role: "Colorist", location: "Lisbon", badge: "og", bio: "Colour for film.", cover_image_url: "https://x.test/cover.jpg" });
  const ben = person("b", "Ben Hart");

  it("draws each person as a ProfileCard: name, role and place, badge, bio, and their most recent credit", async () => {
    credits = [{ user_id: "a", project_name: "Night Train", role: "Colorist" }, { user_id: "a", project_name: "Older", role: "Editor" }];
    renderList({ connections: [ana, ben] });
    const card = within(screen.getByTestId("connection-a"));
    // the name is the card's title, and the title is its link to the Passport
    expect(card.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "View Ana Ruiz's Passport" })).toBeInTheDocument();
    expect(card.getByText("Colorist · Lisbon")).toBeInTheDocument();
    expect(card.getByText("OG")).toBeInTheDocument();
    expect(card.getByText("Colour for film.")).toBeInTheDocument();
    await waitFor(() => expect(card.getByText("Colorist on Night Train")).toBeInTheDocument());
    expect(card.queryByText(/Older/)).toBeNull();
    // the other person has no credit, bio or badge, and nothing is invented for them
    const other = within(screen.getByTestId("connection-b"));
    expect(other.getByText("Editor")).toBeInTheDocument();
    expect(other.queryByText(/ on /)).toBeNull();
  });

  it("is the shell: a 16:9 cover with the person's picture, the rounded face, one list item per person", () => {
    const { container } = render(
      <MemoryRouter><ConnectionList connections={[ana]} loading={false} onMessage={() => {}} /></MemoryRouter>,
    );
    expect(screen.getByRole("list", { name: "Your collaborators" }).querySelectorAll(":scope > li")).toHaveLength(1);
    expect(container.querySelector(".aspect-\\[16\\/9\\]")).not.toBeNull();
    expect(container.querySelector(".rounded-2xl")).not.toBeNull();
    expect(container.querySelector('img[src="https://x.test/cover.jpg"]')).not.toBeNull();
  });

  it("messages that person from the button, without opening their Passport", () => {
    const { onMessage } = renderList({ connections: [ana, ben] });
    fireEvent.click(screen.getByRole("button", { name: "Message Ben Hart" }));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith("b");
    expect(screen.queryByTestId("where")).toBeNull();
  });

  it("opens their Passport from the card", () => {
    const { onMessage } = renderList({ connections: [ana] });
    fireEvent.click(screen.getByRole("button", { name: "View Ana Ruiz's Passport" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/profile/a");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("shows a card-shaped placeholder while loading, and no person", () => {
    const { container } = render(
      <MemoryRouter><ConnectionList connections={[ana]} loading onMessage={() => {}} /></MemoryRouter>,
    );
    expect(screen.queryByText("Ana Ruiz")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("with no connections it shows the network, not an empty list", () => {
    renderList({ connections: [] });
    expect(screen.getByTestId("network-visual")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
