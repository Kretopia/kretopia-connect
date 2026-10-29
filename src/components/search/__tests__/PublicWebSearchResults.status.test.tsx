import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The Web lane inside the search dropdown must be ONE element: the Globe logo
 * with "Parsing Web" while sources arrive, then "Public web" with the count.
 * It used to stack a second status row ("Finding public sources") under the
 * header, which broke the dropdown's rhythm.
 */

const invoke = vi.fn();

vi.mock("@/lib/publicWebSearchEndpoint", () => ({
  PUBLIC_WEB_SEARCH_DEBOUNCE_MS: 0,
  getCachedPublicWebSearch: () => undefined,
  invokePublicWebSearch: (...args: unknown[]) => invoke(...args),
}));

import { PublicWebSearchResults } from "../PublicWebSearchResults";

const SOURCES = [
  { title: "Kretopia", url: "https://www.kretopia.com/", description: "The operating system for creative careers." },
  { title: "About", url: "https://www.kretopia.com/about" },
  { title: "Instagram", url: "https://www.instagram.com/kretopia" },
];

afterEach(() => {
  cleanup();
  invoke.mockReset();
});

describe("Public web search status row", () => {
  it("shows one Parsing Web element while sources are still arriving", async () => {
    invoke.mockReturnValue(new Promise(() => {}));
    render(<PublicWebSearchResults query="kretopia" />);
    await waitFor(() => expect(screen.getByText("Parsing Web")).toBeInTheDocument());
    expect(screen.queryByText("Finding public sources")).toBeNull();
    expect(screen.queryByText("Public web")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("keeps one element once sources land, labelled Public web with the count", async () => {
    invoke.mockResolvedValue({ available: true, results: SOURCES });
    render(<PublicWebSearchResults query="kretopia" />);
    await waitFor(() => expect(screen.getByText("Public web")).toBeInTheDocument());
    expect(screen.getByText("3 sources")).toBeInTheDocument();
    expect(screen.queryByText("Parsing Web")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("reports an unavailable search inside the same element", async () => {
    invoke.mockResolvedValue({ available: false });
    render(<PublicWebSearchResults query="kretopia" />);
    await waitFor(() => expect(screen.getByText("Unavailable")).toBeInTheDocument());
    expect(screen.queryByText("Web search temporarily unavailable")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
