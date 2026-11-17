import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Match must only show users in every account mode. */
const tone = vi.hoisted(() => ({ isBusiness: false, loading: false }));
const seen = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));

vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => tone }));
vi.mock("../SwipeFeature", () => ({ SwipeFeature: (props: Record<string, unknown>) => (seen.props.push(props), <div>deck</div>) }));

import { MatchDeck } from "../MatchDeck";

beforeEach(() => {
  tone.isBusiness = false;
  tone.loading = false;
  seen.props.length = 0;
});

const last = () => seen.props[seen.props.length - 1];

describe("MatchDeck", () => {
  it("a creator account only gets users, never jobs or opportunities", () => {
    render(<MatchDeck />);
    expect(last().offers).toBe(false);
  });

  it("a company account keeps people only", () => {
    tone.isBusiness = true;
    render(<MatchDeck />);
    expect(last().offers).toBe(false);
  });

  it("nobody gets an offer while the account mode is still being read, so a company never sees one flash by", () => {
    tone.loading = true;
    render(<MatchDeck />);
    expect(seen.props.every((p) => p.offers === false)).toBe(true);
  });

  it("passes everything else to the deck unchanged", () => {
    const onMatch = vi.fn();
    const filters = { gender: "any" } as never;
    render(<MatchDeck onMatch={onMatch} filters={filters} />);
    expect(last()).toMatchObject({ onMatch, filters });
  });

  it("cannot enable opportunities through forwarded runtime props", () => {
    const props = { offers: true, cardVariant: "shell" as const };
    render(<MatchDeck {...props} />);
    expect(last()).toMatchObject({ offers: false, cardVariant: "shell" });
  });
});
