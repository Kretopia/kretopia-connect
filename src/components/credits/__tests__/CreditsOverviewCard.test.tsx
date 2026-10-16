import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreditsOverviewCard } from "../CreditsOverviewCard";
import { RecordRing } from "../RecordRing";
import type { MyCreditsOverview } from "@/hooks/useMyCredits";

const overview = {
  total_credits: 12,
  verified_credits: 9,
  pending_credits: 2,
  missing_evidence: 1,
  endorsements_received: 3,
} as unknown as MyCreditsOverview;

describe("RecordRing", () => {
  it("names the percentage and the steps behind it for assistive tech", () => {
    render(<RecordRing percent={75} steps={{ done: 6, total: 8 }} />);
    expect(screen.getByRole("img", { name: "Record 75% complete, 6 of 8 steps done" })).toBeInTheDocument();
  });

  it("clamps out-of-range values", () => {
    const { rerender } = render(<RecordRing percent={180} />);
    expect(screen.getByRole("img", { name: "Record 100% complete" })).toBeInTheDocument();
    rerender(<RecordRing percent={-20} />);
    expect(screen.getByRole("img", { name: "Record 0% complete" })).toBeInTheDocument();
  });

  it("puts the Kretopia mark at the centre as a decorative image", () => {
    const { container } = render(<RecordRing percent={40} />);
    const mark = container.querySelector('img[src*="kretopia-k-mark"]');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute("alt", "");
  });

  it("draws no arc at 0% (a zero-length round cap would show as a dot)", () => {
    const { container } = render(<RecordRing percent={0} />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("draws the arc with the brand gradient, not a flat accent", () => {
    const { container } = render(<RecordRing percent={40} />);
    expect(container.querySelector("linearGradient")).not.toBeNull();
    const arc = container.querySelectorAll("circle")[1];
    expect(arc.getAttribute("stroke")).toMatch(/^url\(#.+\)$/);
  });
});

describe("CreditsOverviewCard", () => {
  it("explains the record in words: verified count and what the percentage is made of", () => {
    render(<CreditsOverviewCard overview={overview} completeness={75} steps={{ done: 6, total: 8 }} nextAction={null} />);
    expect(screen.getByText("9 of 12 verified")).toBeInTheDocument();
    expect(screen.getByText("6 of 8 steps to a complete record")).toBeInTheDocument();
    expect(screen.getByText("Record complete")).toBeInTheDocument();
  });

  it("does not invent numbers for an empty record", () => {
    render(<CreditsOverviewCard overview={null} completeness={0} steps={{ done: 0, total: 8 }} nextAction={null} />);
    expect(screen.getByText("Nothing on your record yet")).toBeInTheDocument();
  });

  it("renders the primary action once, and it fires", () => {
    const onClick = vi.fn();
    render(<CreditsOverviewCard overview={overview} completeness={50} nextAction={{ label: "Ask for a co-sign", onClick }} />);
    const buttons = screen.getAllByRole("button", { name: "Ask for a co-sign" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows no action button when there is nothing left to do", () => {
    render(<CreditsOverviewCard overview={overview} completeness={100} nextAction={null} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
