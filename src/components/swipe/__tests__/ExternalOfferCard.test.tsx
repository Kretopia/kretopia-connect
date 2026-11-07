import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ExternalOfferCard } from "../ExternalOfferCard";
import type { PublicListing } from "@/components/external/PublishedExternalListings";

/**
 * An offer found outside Kretopia, as a card in the Match deck: it says what it is, answers like a person's card (buttons, swipe,
 * arrow keys), and the only thing that leaves the page is the explicit "Open at source".
 */
const offer = (over: Partial<PublicListing> = {}): PublicListing => ({
  id: "l1", kind: "gig", status: "published", title: "Graphic Designer & Video Editor", original_publisher: "BlueTuskr", location: "Anywhere", remote_scope: "remote",
  source_published_at: null, deadline_at: null, apply_url: "https://remoteok.com/remote-jobs/x-1137507", excerpt: "A full-service e-commerce growth agency is hiring.",
  last_checked_at: new Date(Date.now() - 86_400_000).toISOString(), source_provider: "remoteok", claimed: false, ...over,
});

const onInterested = vi.fn();
const onPass = vi.fn();
const renderCard = (o = offer()) =>
  render(
    <MemoryRouter>
      <ExternalOfferCard offer={o} onInterested={onInterested} onPass={onPass} />
    </MemoryRouter>,
  );

beforeEach(() => {
  onInterested.mockClear();
  onPass.mockClear();
});

describe("ExternalOfferCard: what it says", () => {
  it("labels the offer External and Unclaimed, with its source and when it was last checked", () => {
    renderCard();
    const labels = screen.getByTestId("listing-labels");
    expect(labels).toHaveTextContent("External");
    expect(labels).toHaveTextContent("Unclaimed");
    expect(labels).toHaveTextContent("Last checked yesterday");
    expect(labels).toHaveTextContent("via Remote OK");
  });

  it("shows the title, who published it and where, and the short excerpt", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Graphic Designer & Video Editor" })).toBeInTheDocument();
    expect(screen.getByText("BlueTuskr · Anywhere · Remote")).toBeInTheDocument();
    expect(screen.getByText("A full-service e-commerce growth agency is hiring.")).toBeInTheDocument();
  });

  it("is honest that Kretopia is not the publisher and sends nothing, and links to the listing's own page", () => {
    renderCard();
    const note = screen.getByText(/found outside kretopia/i);
    expect(note).toHaveTextContent("is not the publisher");
    expect(note).toHaveTextContent("sends nothing: no message, no application");
    expect(within(note).getByRole("link", { name: "Details" })).toHaveAttribute("href", "/listing/l1");
  });

  it("a claimed offer says Claimed", () => {
    renderCard(offer({ claimed: true }));
    expect(screen.getByTestId("listing-labels")).toHaveTextContent("Claimed");
  });

  it("a link to any other source stays nofollow", () => {
    renderCard(offer({ source_provider: "jobicy", apply_url: "https://jobicy.com/jobs/1-x" }));
    const open = screen.getByRole("link", { name: /at the source/i });
    expect(open).toHaveAttribute("href", "https://jobicy.com/jobs/1-x");
    expect(open.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it("a Himalayas offer is credited by name and opens the job's own Himalayas page with utm_source=api", () => {
    const page = "https://himalayas.app/companies/customer-io/jobs/senior-brand-designer";
    renderCard(offer({ source_provider: "himalayas", apply_url: page }));
    expect(screen.getByTestId("listing-labels")).toHaveTextContent("via Himalayas");
    const open = screen.getByRole("link", { name: /at the source/i });
    expect(open).toHaveAttribute("href", `${page}?utm_source=api`);
    expect(open.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it("never promises a match, a connection or a reply", () => {
    renderCard();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/match|connect|they will|we will contact|apply for you/i);
  });
});

describe("ExternalOfferCard: what it does", () => {
  it("'Open at source' is a plain link to the publisher's page, in a new tab, and answers nothing", () => {
    renderCard();
    const open = screen.getByRole("link", { name: /open graphic designer & video editor at the source/i });
    expect(open).toHaveAttribute("href", "https://remoteok.com/remote-jobs/x-1137507");
    expect(open).toHaveAttribute("target", "_blank");
    expect(open.getAttribute("rel")).toMatch(/noopener/);
    // Remote OK's API terms ask for a followed link back; every other source's link stays nofollow.
    expect(open.getAttribute("rel")).not.toMatch(/nofollow/);
    fireEvent.click(open);
    expect(onInterested).not.toHaveBeenCalled();
    expect(onPass).not.toHaveBeenCalled();
  });

  it("without a destination there is no 'Open at source' to offer", () => {
    renderCard(offer({ apply_url: null }));
    expect(screen.queryByRole("link", { name: /at the source/i })).not.toBeInTheDocument();
  });

  it("'Interested' answers 'interested' for this offer, once, and opens nothing by itself", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /interested/i }));
    await waitFor(() => expect(onInterested).toHaveBeenCalledTimes(1));
    expect(onInterested).toHaveBeenCalledWith(expect.objectContaining({ id: "l1" }));
    expect(onPass).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("'Pass' passes on this offer, once", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Pass on Graphic Designer & Video Editor" }));
    await waitFor(() => expect(onPass).toHaveBeenCalledTimes(1));
    expect(onPass).toHaveBeenCalledWith(expect.objectContaining({ id: "l1" }));
    expect(onInterested).not.toHaveBeenCalled();
  });

  it("the arrow keys answer like a person's card: left passes, right is interested", async () => {
    const first = renderCard();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(onPass).toHaveBeenCalledTimes(1));
    expect(onInterested).not.toHaveBeenCalled();
    first.unmount();
    onPass.mockClear();
    renderCard(offer({ id: "l2", title: "Colourist" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(onInterested).toHaveBeenCalledTimes(1));
    expect(onPass).not.toHaveBeenCalled();
  });

  it("does not hijack the arrow keys while someone is typing", () => {
    renderCard();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(onPass).not.toHaveBeenCalled();
    expect(onInterested).not.toHaveBeenCalled();
    input.remove();
  });
});

describe("ExternalOfferCard: the shared card shape", () => {
  const draw = (variant?: "default" | "shell", o = offer()) =>
    render(
      <MemoryRouter>
        <ExternalOfferCard offer={o} onInterested={onInterested} onPass={onPass} variant={variant} />
      </MemoryRouter>,
    );
  const title = () => screen.getByRole("heading", { name: "Graphic Designer & Video Editor" });
  const frame = () => screen.getByTestId("external-offer-card").closest(".w-full.min-w-0") as HTMLElement;
  const interested = () => screen.getByRole("button", { name: /interested/i });
  const pass = () => screen.getByRole("button", { name: "Pass on Graphic Designer & Video Editor" });

  it("is drawn as it always was unless the deck asks for the shared shape", () => {
    draw();
    expect(title().className).toContain("text-2xl");
    expect(frame().className).toContain("rounded-xl");
    expect(frame().className).not.toContain("rounded-2xl");
    expect(screen.getByTestId("external-offer-card").className).toContain("p-4");
    expect(interested().className).toContain("cta-solid");
    expect(pass().className).toContain("rounded-full");
    expect(interested().parentElement!.className).not.toContain("flex-wrap");
  });

  it("takes the Scout hybrid card's radius, padding, title, meta, description and buttons when asked", () => {
    draw("shell");
    // frame and padding: the shell's, the same as the person's card beside it in the deck
    expect(frame().className).toContain("rounded-2xl");
    expect(frame().className).not.toContain("rounded-xl");
    expect(screen.getByTestId("external-offer-card").className).toContain("p-5");
    // type: title at the card scale and clamped, who and where at the meta scale, the excerpt at the description scale
    expect(title().className).toContain("text-[21px]");
    expect(title().className).toContain("line-clamp-2");
    expect(title().className).not.toContain("text-2xl");
    expect(screen.getByText("BlueTuskr · Anywhere · Remote").className).toContain("text-xs");
    expect(screen.getByText("A full-service e-commerce growth agency is hiring.").className).toContain("leading-[1.55]");
    // buttons: the shell's icon button for Pass, its outline button for Open at source, its primary button for Interested
    expect(pass().className).toContain("rounded-[10px]");
    expect(pass().className).toContain("h-11");
    expect(screen.getByRole("link", { name: /at the source/i }).className).toContain("rounded-[9px]");
    expect(interested().className).toContain("rounded-[9px]");
    expect(interested().className).toContain("border-transparent");
    expect(interested().className).not.toContain("cta-solid");
    // the action row wraps instead of squeezing "Interested" on a narrow phone (measured at 320 and 360px in the browser run)
    expect(interested().parentElement!.className).toContain("flex-wrap");
    expect(interested().className).toContain("min-w-[7.5rem]");
    // the brand-gradient border is an inline background that jsdom cannot parse; it is checked in the browser run instead
  });

  it("says the same things in the shared shape: what it is, who published it, and that Kretopia sends nothing", () => {
    draw("shell");
    const labels = screen.getByTestId("listing-labels");
    expect(labels).toHaveTextContent("External");
    expect(labels).toHaveTextContent("Unclaimed");
    expect(screen.getByText(/found outside kretopia/i)).toHaveTextContent("sends nothing: no message, no application");
    expect(within(screen.getByText(/found outside kretopia/i)).getByRole("link", { name: "Details" })).toHaveAttribute("href", "/listing/l1");
    expect(document.body.textContent ?? "").not.toMatch(/match|connect|they will|we will contact|apply for you/i);
  });

  it("answers the same way in the shared shape: buttons, arrow keys, and a plain link to the publisher", async () => {
    const first = draw("shell");
    const open = screen.getByRole("link", { name: /at the source/i });
    expect(open).toHaveAttribute("href", "https://remoteok.com/remote-jobs/x-1137507");
    expect(open).toHaveAttribute("target", "_blank");
    fireEvent.click(open);
    expect(onInterested).not.toHaveBeenCalled();
    expect(onPass).not.toHaveBeenCalled();
    fireEvent.click(interested());
    await waitFor(() => expect(onInterested).toHaveBeenCalledTimes(1));
    first.unmount();
    onInterested.mockClear();
    const second = draw("shell");
    fireEvent.click(pass());
    await waitFor(() => expect(onPass).toHaveBeenCalledTimes(1));
    second.unmount();
    onPass.mockClear();
    draw("shell", offer({ id: "l2", title: "Colourist" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(onInterested).toHaveBeenCalledTimes(1));
    expect(onPass).not.toHaveBeenCalled();
  });

  it("with no destination the shared shape still offers no 'Open at source'", () => {
    draw("shell", offer({ apply_url: null }));
    expect(screen.queryByRole("link", { name: /at the source/i })).not.toBeInTheDocument();
  });
});
