/**
 * The claim link a scout sends to the person who posted a gig.
 *
 * The token in the link is a secret and cannot be read from the table: the
 * scout (or owner) asks the database for their own link, and it is created
 * there, with a cryptographic generator, the first time. This turns that answer
 * into something the page can show.
 */

export type ClaimLink =
  | { kind: "ready"; url: string; text: string }
  /** The gig has been claimed already: nothing left to share. */
  | { kind: "claimed" }
  | { kind: "error" };

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

export const claimLinkText = (url: string) =>
  `Hey! I listed your gig on Kretopia so creatives can find and apply directly. Claim it here to manage applicants, message talent, and fill the role faster:\n\n${url}`;

export async function prepareClaimLink(rpc: Rpc, opportunityId: string, appUrl: string): Promise<ClaimLink> {
  const { data, error } = await rpc("get_or_create_opportunity_claim_token", { p_opportunity_id: opportunityId });
  if (error) return { kind: "error" };
  if (typeof data !== "string" || data.length === 0) return { kind: "claimed" };
  const url = `${appUrl.replace(/\/+$/, "")}/claim-gig/${data}`;
  return { kind: "ready", url, text: claimLinkText(url) };
}
