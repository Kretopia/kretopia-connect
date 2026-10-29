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
    expect(open.getAttribute("rel")).toMatch(/nofollow/);
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
