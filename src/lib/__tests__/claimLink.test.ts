import { describe, expect, it, vi } from "vitest";
import { claimLinkText, prepareClaimLink } from "../claimLink";

const reply = (data: unknown, error: unknown = null) => vi.fn(async () => ({ data, error }));

describe("prepareClaimLink", () => {
  it("asks the database for the person's own link and builds the URL from the token it returns", async () => {
    const rpc = reply("claim_0123456789abcdef0123456789abcdef");
    const link = await prepareClaimLink(rpc, "opp1", "https://www.kretopia.com");
    expect(rpc).toHaveBeenCalledWith("get_or_create_opportunity_claim_token", { p_opportunity_id: "opp1" });
    expect(link).toEqual({
      kind: "ready",
      url: "https://www.kretopia.com/claim-gig/claim_0123456789abcdef0123456789abcdef",
      text: claimLinkText("https://www.kretopia.com/claim-gig/claim_0123456789abcdef0123456789abcdef"),
    });
  });

  it("does not double the slash when the app URL ends with one", async () => {
    const link = await prepareClaimLink(reply("tok"), "opp1", "https://www.kretopia.com/");
    expect(link).toMatchObject({ kind: "ready", url: "https://www.kretopia.com/claim-gig/tok" });
  });

  it("says 'claimed' when there is no token left to give, and never makes one up", async () => {
    expect(await prepareClaimLink(reply(null), "opp1", "https://x.test")).toEqual({ kind: "claimed" });
    expect(await prepareClaimLink(reply(""), "opp1", "https://x.test")).toEqual({ kind: "claimed" });
    expect(await prepareClaimLink(reply(undefined), "opp1", "https://x.test")).toEqual({ kind: "claimed" });
  });

  it("an error is an error, not a link", async () => {
    expect(await prepareClaimLink(reply(null, { message: "Not your gig" }), "opp1", "https://x.test")).toEqual({ kind: "error" });
  });

  it("the message names the link and invites the poster to claim", () => {
    expect(claimLinkText("https://x.test/claim-gig/t")).toMatch(/Claim it here.*\n\nhttps:\/\/x\.test\/claim-gig\/t$/s);
  });
});
