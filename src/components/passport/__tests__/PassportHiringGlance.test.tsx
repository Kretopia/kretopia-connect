import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildHiringGlance } from "@/lib/passport/hiringGlance";
import { PassportHiringGlance } from "../PassportHiringGlance";

afterEach(cleanup);

const credit = (id: string, over: Record<string, unknown> = {}) => ({ id, project_name: `Project ${id}`, role: "Director", year: 2019, forcedEvidence: "verified" as const, forcedBasis: "Confirmed by a linked platform", ...over });
const glanceOf = (credits: ReturnType<typeof credit>[], counts = {}) => buildHiringGlance(credits, counts, new Date("2026-06-01"));
const region = () => within(screen.getByRole("region", { name: "Nova at a glance" }));

describe("At a glance", () => {
  it("does not repeat the credits: no count, no confirmed figure, no strongest proof, no legend", () => {
    render(<PassportHiringGlance glance={glanceOf([credit("a"), credit("b", { year: 2022 })], { total: 9, confirmed: 4 })} firstName="Nova" actions={<button type="button">Message</button>} />);
    const glance = region();
    expect(glance.queryByText("Credits")).toBeNull();
    expect(glance.queryByText("Confirmed")).toBeNull();
    expect(glance.queryByText(/on this Passport/)).toBeNull();
    expect(glance.queryByText(/% of record/)).toBeNull();
    expect(glance.queryByText("Project a")).toBeNull();
    expect(glance.queryByText(/Verified = confirmed by a linked platform/)).toBeNull();
    expect(glance.queryByRole("list")).toBeNull();
  });

  it("keeps the one fact the credits section does not state: since when they have been working", () => {
    render(<PassportHiringGlance glance={glanceOf([credit("a"), credit("b", { year: 2022 })])} firstName="Nova" actions={<button type="button">Message</button>} />);
    expect(region().getByText("2019")).toBeInTheDocument();
    expect(region().getByText("Since")).toBeInTheDocument();
    expect(region().getByText("7 yrs since first credit")).toBeInTheDocument();
  });

  it("draws the actions it is given, and the owner's actions, in place of the figures", () => {
    render(
      <PassportHiringGlance
        glance={glanceOf([credit("a")])}
        firstName="Nova"
        actions={<button type="button">Message</button>}
        ownerActions={<a href="/credits">Manage credits</a>}
      />,
    );
    expect(region().getByRole("button", { name: "Message" })).toBeInTheDocument();
    expect(region().getByRole("link", { name: "Manage credits" })).toBeInTheDocument();
  });

  it("is still there with only the actions when nobody has credits yet, and says nothing about credits", () => {
    render(<PassportHiringGlance glance={glanceOf([])} firstName="Nova" actions={<button type="button">Message</button>} />);
    expect(region().getByRole("button", { name: "Message" })).toBeInTheDocument();
    expect(region().queryByText("Since")).toBeNull();
    expect(screen.queryByText(/hasn't added any credits yet/)).toBeNull();
  });

  it("is not drawn at all when it has nothing to say: no year, no actions, no owner actions", () => {
    const { container } = render(<PassportHiringGlance glance={glanceOf([])} firstName="Nova" />);
    expect(container).toBeEmptyDOMElement();
  });
});
