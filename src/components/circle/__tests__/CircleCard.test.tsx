import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CircleCard, type CircleData } from "../CircleCard";

const crew = (over: Partial<CircleData> = {}): CircleData => ({
  id: "c1", title: "Night Owls", description: "A room for people who edit after midnight.", category: "film", icon_emoji: "🦉", cover_url: null,
  member_count: 12, message_count: 30, created_by: "u1", created_at: new Date(Date.now() - 90 * 86_400_000).toISOString(), is_active: true,
  is_private: false, is_paid: false, price_monthly: 0, currency: "USD", circle_type: "crew", invite_code: null, rules: null, ...over,
});

const draw = (over: Partial<CircleData> = {}, onClick = vi.fn()) => {
  const view = render(<MemoryRouter><CircleCard circle={crew(over)} onClick={onClick} /></MemoryRouter>);
  return { ...view, onClick };
};
const card = () => screen.getByTestId("crew-card-c1");

describe("CircleCard: a Crew is the shared card", () => {
  it("names the Crew, who runs it, what it is about, and how many people and messages it has", () => {
    draw({ creator_name: "Mira Soto" });
    expect(within(card()).getByText("Night Owls")).toBeInTheDocument();
    expect(card().querySelector('[data-card-part="meta"]')).toHaveTextContent("by Mira Soto");
    expect(card()).toHaveTextContent("A room for people who edit after midnight.");
    expect(card().querySelector('[data-card-part="tags"]')).toHaveTextContent("12 members");
    expect(card().querySelector('[data-card-part="tags"]')).toHaveTextContent("30 messages");
  });

  it("leaves out what the Crew does not have: no messages, no admin, no creator, no description", () => {
    draw({ message_count: 0, description: null });
    const tags = card().querySelector('[data-card-part="tags"]') as HTMLElement;
    expect(tags).toHaveTextContent("12 members");
    expect(tags).not.toHaveTextContent(/messages|Admin/);
    expect(card().querySelector('[data-card-part="meta"]')).toBeNull();
    expect(card().querySelector('[data-card-part="description"]')).toBeNull();
  });

  it("says Admin to an admin, and abbreviates a very large message count", () => {
    draw({ user_role: "admin", message_count: 2400 });
    const tags = card().querySelector('[data-card-part="tags"]') as HTMLElement;
    expect(tags).toHaveTextContent("Admin");
    expect(tags).toHaveTextContent("2.4k messages");
  });

  it("says how active it is in words, only when it is", () => {
    const { unmount } = draw({ message_count: 120 });
    expect(card().querySelector('[data-card-part="meta"]')).toHaveTextContent("Active");
    unmount();
    const second = draw({ message_count: 400, creator_name: "Mira Soto" });
    expect(card().querySelector('[data-card-part="meta"]')).toHaveTextContent("by Mira Soto · Very Active");
    second.unmount();
    draw({ message_count: 10 });
    expect(card().querySelector('[data-card-part="meta"]')).toBeNull();
  });

  it("says in words on the cover whether it is new, joined, paid or private", () => {
    const { unmount } = draw({ created_at: new Date().toISOString(), is_member: true, is_private: true });
    const cover = card().querySelector('[data-card-part="cover"]') as HTMLElement;
    expect(cover).toHaveTextContent("New");
    expect(cover).toHaveTextContent("Joined");
    expect(cover).toHaveTextContent("Private");
    unmount();
    draw({ is_paid: true, price_monthly: 9 });
    const paidCover = card().querySelector('[data-card-part="cover"]') as HTMLElement;
    expect(paidCover).toHaveTextContent("9/mo");
    expect(paidCover).not.toHaveTextContent(/Joined|Private|New/);
  });

  it("does not offer to buy into a Crew the person already belongs to", () => {
    draw({ is_paid: true, price_monthly: 9, is_member: true });
    expect(card().querySelector('[data-card-part="cover"]')).toHaveTextContent("Joined");
    expect(card().querySelector('[data-card-part="cover"]')).not.toHaveTextContent("9/mo");
  });

  it("draws its picture with the emoji beside it, or its own gradient and emoji when there is no picture or it fails", () => {
    const { container, unmount } = draw({ cover_url: "https://x.test/crew.jpg" });
    const img = container.querySelector('img[src="https://x.test/crew.jpg"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(card().querySelector('[data-card-part="cover"]')).toHaveTextContent("🦉");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(card().querySelector('[data-card-part="cover"] .bg-gradient-to-br')).not.toBeNull();
    expect(card().querySelector('[data-card-part="cover"]')).toHaveTextContent("🦉");
    unmount();
    draw({ icon_emoji: "" });
    expect(card().querySelector('[data-card-part="cover"]')).toHaveTextContent("👥");
  });
});

describe("CircleCard: what it does", () => {
  it("opens the Crew from the title, and from its button, and says which it is", () => {
    const first = draw({ is_member: true });
    fireEvent.click(screen.getByRole("button", { name: "Night Owls" }));
    expect(first.onClick).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Open crew/ }));
    expect(first.onClick).toHaveBeenCalledTimes(2);
    first.unmount();
    draw({ is_member: false });
    expect(screen.getByRole("button", { name: /View crew/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open crew/ })).toBeNull();
  });

  it("is one target for the whole card, so it can be reached and opened by keyboard", () => {
    draw();
    expect(card().querySelector('[data-card-part="title"]')!.className).toContain("after:absolute");
    expect(card().querySelector('[data-card-part="title"]')!.tagName).toBe("BUTTON");
  });
});
