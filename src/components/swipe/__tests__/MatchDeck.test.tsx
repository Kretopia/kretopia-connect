import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Who sees offers found outside Kretopia in the Match deck: a creator account does, a company does not, and nobody while the mode is unknown. */
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
  it("a creator account gets offers between the people", () => {
    render(<MatchDeck />);
    expect(last().offers).toBe(true);
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
});
