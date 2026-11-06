import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PassportRecognition } from "../PassportRecognition";

const press = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, title: `Story ${i}`, publication: `Paper ${i}`, url: `https://example.com/${i}` }));
const awards = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, title: `Award ${i}`, organization: `Jury ${i}`, year: 2020 + i }));

describe("PassportRecognition", () => {
  it("draws nothing when there is neither press nor an award", () => {
    const { container } = render(<PassportRecognition press={[]} awards={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("puts Featured In and Awards side by side: neither takes the whole width", () => {
    render(<PassportRecognition press={press(2)} awards={awards(2)} />);
    const band = screen.getByRole("region", { name: "Featured in and awards" });
    expect(band.className).toContain("md:grid-cols-2");
    const featured = within(band).getByRole("heading", { name: "Featured In" }).parentElement as HTMLElement;
    const prizes = within(band).getByRole("heading", { name: "Awards" }).parentElement as HTMLElement;
    expect(featured.className).not.toContain("md:col-span-2");
    expect(prizes.className).not.toContain("md:col-span-2");
  });

  it("shows the first four press items and the first three awards", () => {
    render(<PassportRecognition press={press(6)} awards={awards(5)} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByText("Story 3")).toBeInTheDocument();
    expect(screen.queryByText("Story 4")).toBeNull();
    expect(screen.getByText("Award 2")).toBeInTheDocument();
    expect(screen.queryByText("Award 3")).toBeNull();
  });

  it("opens press in a new tab, without handing the opener over", () => {
    render(<PassportRecognition press={press(1)} awards={[]} />);
    const link = screen.getByRole("link", { name: /Story 0/ });
    expect(link).toHaveAttribute("href", "https://example.com/0");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("with only press, takes the whole width and sets its rows in two columns, so the band is never half empty", () => {
    render(<PassportRecognition press={press(4)} awards={[]} />);
    const section = screen.getByRole("heading", { name: "Featured In" }).parentElement as HTMLElement;
    expect(section.className).toContain("md:col-span-2");
    expect(section.querySelector(".md\\:grid-cols-2")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Awards" })).toBeNull();
  });

  it("with only awards, does the same", () => {
    render(<PassportRecognition press={[]} awards={awards(3)} />);
    const section = screen.getByRole("heading", { name: "Awards" }).parentElement as HTMLElement;
    expect(section.className).toContain("md:col-span-2");
    expect(section.querySelector(".md\\:grid-cols-2")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Featured In" })).toBeNull();
  });

  it("shows the picture of a press item when it has one, and an icon when it has not", () => {
    const { container } = render(<PassportRecognition press={[{ ...press(1)[0], image_url: "https://example.com/p.jpg" }, press(2)[1]]} awards={[]} />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/p.jpg");
  });
});
