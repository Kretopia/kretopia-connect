import { describe, expect, it } from "vitest";
import {
  aiCheckNote,
  classifyCreditEvidence,
  creditEvidenceBasis,
  creditEvidenceLabel,
  creditEvidenceMeaning,
  creditNextStep,
  VERIFICATION_LEGEND,
  type CreditEvidenceStatus,
} from "../creditEvidence";

const ALL: CreditEvidenceStatus[] = ["verified", "co_signed", "publicly_sourced", "pending", "self_claimed"];

describe("classifyCreditEvidence: one answer for the Passport and for Credits", () => {
  it("self-declared: nothing but the owner's word", () => {
    expect(classifyCreditEvidence({})).toBe("self_claimed");
    expect(classifyCreditEvidence({ verification_status: "unverified" })).toBe("self_claimed");
    expect(classifyCreditEvidence({ verification_status: null, endorsement_count: 0 })).toBe("self_claimed");
  });

  it("co-signed: collaborators vouch for it, and it is not called verified", () => {
    expect(classifyCreditEvidence({ verification_status: "unverified", endorsement_count: 2 })).toBe("co_signed");
    expect(classifyCreditEvidence({ endorsement_count: 1 })).toBe("co_signed");
  });

  it("verified: only the credit's own verification status makes it so, with or without co-signs", () => {
    expect(classifyCreditEvidence({ verification_status: "verified" })).toBe("verified");
    expect(classifyCreditEvidence({ verification_status: "verified", endorsement_count: 3 })).toBe("verified");
  });

  it("pending: a review under way outranks the co-signs already received, because it does not count yet", () => {
    expect(classifyCreditEvidence({ verification_status: "pending" })).toBe("pending");
    expect(classifyCreditEvidence({ verification_status: "pending_review", endorsement_count: 4 })).toBe("pending");
  });

  it("publicly sourced: found in public records, never read as verified", () => {
    expect(classifyCreditEvidence({ verification_status: "auto_discovered" })).toBe("publicly_sourced");
    expect(classifyCreditEvidence({ verification_status: "auto_discovered", endorsement_count: 2 })).toBe("publicly_sourced");
  });

  it("never treats a payment, a plan, a subscription, an approval or a score as proof", () => {
    const noise = {
      subscription_tier: "founder",
      plan: "pro",
      paid: true,
      payment_status: "succeeded",
      approved: true,
      is_featured: true,
      verification_score: 100,
      ai_confidence: 0.99,
    };
    expect(classifyCreditEvidence({ ...noise } as never)).toBe("self_claimed");
    expect(classifyCreditEvidence({ ...noise, verification_status: "unverified" } as never)).toBe("self_claimed");
    expect(classifyCreditEvidence({ ...noise, endorsement_count: 1 } as never)).toBe("co_signed");
  });
});

describe("labels and meanings: the same words everywhere", () => {
  it("uses plain, distinct labels for the five statuses", () => {
    expect(ALL.map(creditEvidenceLabel)).toEqual(["Verified", "Co-signed", "Publicly sourced", "Pending", "Self-declared"]);
    expect(new Set(ALL.map(creditEvidenceLabel)).size).toBe(ALL.length);
  });

  it("says in one sentence what each status does and does not prove", () => {
    for (const s of ALL) expect(creditEvidenceMeaning(s).length).toBeGreaterThan(20);
    expect(creditEvidenceMeaning("self_claimed")).toMatch(/Nothing independent/);
    expect(creditEvidenceMeaning("co_signed")).toMatch(/Not yet verified/);
    expect(creditEvidenceMeaning("pending")).toMatch(/does not count/);
  });

  it("names the evidence behind a status, and never lets a weaker one read as confirmed", () => {
    expect(creditEvidenceBasis({ verification_status: "unverified", endorsement_count: 2 })).toBe("Co-signed by 2 collaborators");
    expect(creditEvidenceBasis({ endorsement_count: 1 })).toBe("Co-signed by 1 collaborator");
    expect(creditEvidenceBasis({ verification_status: "verified", endorsement_count: 2 })).toBe("Confirmed by 2 collaborators");
    expect(creditEvidenceBasis({ verification_status: "pending" })).toBe("Awaiting confirmation");
    expect(creditEvidenceBasis({})).toBe("Self-declared");
    expect(creditEvidenceBasis({ verification_status: "auto_discovered" })).toBe("Found in public records");
  });
});

describe("creditNextStep: what the owner can do about it", () => {
  it("asks for evidence first, then for a co-sign", () => {
    expect(creditNextStep("self_claimed", false)).toBe("Add a link or a file as evidence.");
    expect(creditNextStep("self_claimed", true)).toBe("Ask a collaborator to co-sign it.");
    expect(creditNextStep("publicly_sourced", true)).toBe("Ask a collaborator to co-sign it.");
  });

  it("waits on a pending credit, and has nothing to ask of a verified or co-signed one", () => {
    expect(creditNextStep("pending", true)).toBe("Waiting on a reply or a review.");
    expect(creditNextStep("verified", true)).toBeNull();
    expect(creditNextStep("co_signed", false)).toBeNull();
  });
});

describe("AI-checked: a lead beside the status, never proof", () => {
  it("describes what the check found in plain words and never as certain", () => {
    expect(aiCheckNote(0.92)).toBe("AI-checked: possible public evidence found (not proof)");
    expect(aiCheckNote(0.1)).toBe("AI-checked: no public evidence found");
    expect(aiCheckNote(0.5)).toBe("AI-checked: inconclusive");
    for (const never of [null, undefined, Number.NaN, "0.9" as unknown as number]) expect(aiCheckNote(never)).toBeNull();
    for (const c of [0, 0.29, 0.3, 0.69, 0.7, 1]) expect(aiCheckNote(c)).not.toMatch(/100%|certain|confirmed|verified/i);
  });

  it("is mentioned in the basis of a credit that is not verified, and never changes the status", () => {
    expect(classifyCreditEvidence({ verification_status: "unverified", ai_confidence: 0.95 })).toBe("self_claimed");
    expect(creditEvidenceBasis({ verification_status: "unverified", ai_confidence: 0.95 })).toBe("Self-declared · AI-checked: possible public evidence found (not proof)");
    expect(creditEvidenceBasis({ endorsement_count: 1, ai_confidence: 0.1 })).toBe("Co-signed by 1 collaborator · AI-checked: no public evidence found");
    expect(creditEvidenceBasis({ verification_status: "unverified" })).toBe("Self-declared");
  });

  it("does not add the AI note to a credit that is already verified", () => {
    expect(creditEvidenceBasis({ verification_status: "verified", ai_confidence: 0.9, source: "youtube" })).toBe("Verified on YouTube");
  });
});

describe("the legend", () => {
  it("defines the four statuses a reader meets, with the owner's sentence for Verified and no claim of certainty", () => {
    expect(VERIFICATION_LEGEND.map((l) => l.label)).toEqual(["Self-declared", "Co-signed", "AI-checked", "Verified"]);
    const verified = VERIFICATION_LEGEND.find((l) => l.key === "verified")!;
    expect(verified.meaning.startsWith("Verified means the contribution was confirmed by the relevant collaborator or client.")).toBe(true);
    expect(VERIFICATION_LEGEND.find((l) => l.key === "ai_checked")!.meaning).toMatch(/never proof and never 100% certain/);
  });
});
