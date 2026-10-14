import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { refineBrief, routeByRules } from "../../../supabase/functions/_shared/studioOutcomeRouter";

describe("routeByRules: the Studio's quick-start prompts, exactly as the composer sends them", () => {
  const cases: Array<[string, string, string | null]> = [
    ["Create a sponsorship proposal for this project.", "make_document", "sponsor_deck"],
    ["Draft a client proposal with deliverables, timeline and pricing.", "make_document", "client_proposal"],
    ["Write a creative treatment for this project.", "make_document", "treatment"],
    ["Build a moodboard deck for this project.", "make_document", "moodboard_deck"],
    ["Draft a Letter of Intent on my branded letterhead for this project.", "make_document", "letter_of_intent"],
    ["Build a clean rate card for this engagement.", "make_document", "rate_card"],
    ["Find me crew or collaborators for this project.", "find_people", null],
  ];
  for (const [prompt, outcome, intent] of cases) {
    it(`"${prompt}" -> ${outcome}${intent ? ` / ${intent}` : ""}, with no AI`, () => {
      const r = routeByRules(prompt);
      expect(r).toMatchObject({ outcome, doc_intent: intent, confident: true, routed_by: "rules" });
      expect(r.preview.length).toBeLessThanOrEqual(100);
    });
  }
});

describe("routeByRules: the five outcomes", () => {
  it("documents: each intent from its own words", () => {
    expect(routeByRules("I need a sponsor deck for Bali Carnival, premium tone")).toMatchObject({ outcome: "make_document", doc_intent: "sponsor_deck" });
    expect(routeByRules("make me a pitch deck for investors")).toMatchObject({ outcome: "make_document", doc_intent: "pitch_deck" });
    expect(routeByRules("write a business plan")).toMatchObject({ outcome: "make_document", doc_intent: "business_plan" });
    expect(routeByRules("a one pager for the festival")).toMatchObject({ outcome: "make_document", doc_intent: "one_pager" });
    expect(routeByRules("LOI to the tourism board")).toMatchObject({ outcome: "make_document", doc_intent: "letter_of_intent" });
  });

  it("people: a search verb and a role", () => {
    expect(routeByRules("find a videographer in Bali")).toMatchObject({ outcome: "find_people", doc_intent: null });
    expect(routeByRules("looking for a colorist and an editor")).toMatchObject({ outcome: "find_people" });
  });

  it("gigs: a search for paid work, sponsors or funding", () => {
    expect(routeByRules("find sponsors for the festival")).toMatchObject({ outcome: "find_gigs" });
    expect(routeByRules("any paid gigs for this project?")).toMatchObject({ outcome: "find_gigs" });
  });

  it("invoice: a quote, an invoice or a bill", () => {
    expect(routeByRules("send a quote to the client")).toMatchObject({ outcome: "draft_invoice" });
    expect(routeByRules("invoice the client for the shoot")).toMatchObject({ outcome: "draft_invoice" });
  });

  it("an unplaced request is chat, not an error, and is flagged as not confident", () => {
    for (const p of ["what should I do next?", "plan the shoot schedule", "help"]) {
      expect(routeByRules(p)).toMatchObject({ outcome: "chat", doc_intent: null, confident: false });
    }
    expect(routeByRules("")).toMatchObject({ outcome: "chat", confident: false });
    expect(routeByRules(undefined)).toMatchObject({ outcome: "chat", confident: false });
  });

  it("French is placed too, with accents folded", () => {
    expect(routeByRules("fais-moi une présentation pour des investisseurs")).toMatchObject({ outcome: "make_document", doc_intent: "pitch_deck" });
    expect(routeByRules("lettre d'intention pour la mairie")).toMatchObject({ outcome: "make_document", doc_intent: "letter_of_intent" });
    expect(routeByRules("cherche un cadreur à Paris")).toMatchObject({ outcome: "find_people" });
    expect(routeByRules("fais un devis pour le client")).toMatchObject({ outcome: "draft_invoice" });
    expect(routeByRules("une grille tarifaire")).toMatchObject({ outcome: "make_document", doc_intent: "rate_card" });
  });

  it("an invoice word does not hide a proposal request", () => {
    expect(routeByRules("client proposal with a quote and pricing")).toMatchObject({ outcome: "make_document", doc_intent: "client_proposal" });
  });

  it("a deck request is not turned into a people search by the word 'someone' or a role", () => {
    expect(routeByRules("I need a sponsor deck for a videographer's studio")).toMatchObject({ outcome: "make_document" });
  });
});

describe("refineBrief", () => {
  it("strips polite filler and keeps the specifics", () => {
    expect(refineBrief("Can you make me a sponsor deck for Bali Carnival, premium tone")).toBe("a sponsor deck for Bali Carnival, premium tone");
    expect(refineBrief("please create a pitch deck, 10 slides, due Friday")).toBe("a pitch deck, 10 slides, due Friday");
  });

  it("keeps the original when nothing is left after stripping, and clips to 300 characters", () => {
    expect(refineBrief("please")).toBe("please");
    expect(refineBrief("x".repeat(500))).toHaveLength(300);
  });
});

describe("wiring: free by design", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../..", p), "utf8");

  it("the function never answers 402 or 429 on the gateway's behalf and decides by rules first", () => {
    const source = read("supabase/functions/route-studio-outcome/index.ts");
    expect(source).not.toMatch(/status:\s*402/);
    expect(source).not.toContain("Workspace AI credits exhausted");
    expect(source).not.toMatch(/resp\.status === 4(02|29)/);
    const rules = source.indexOf("routeByRules(");
    const gateway = source.indexOf("ai.gateway.lovable.dev");
    expect(rules).toBeGreaterThan(-1);
    expect(gateway).toBeGreaterThan(rules);
    expect(source).toContain("if (ruled.confident) return json(payloadOf(ruled));");
    expect(source).toContain("if (!LOVABLE_API_KEY) return json(payloadOf(ruled));");
  });

  it("the composer places a recognised request locally, before and without any function call", () => {
    const source = read("src/components/project/studio/StudioOutcomeComposer.tsx");
    const local = source.indexOf("routeByRules(trimmed, projectTitle)");
    const invoke = source.indexOf('supabase.functions.invoke("route-studio-outcome"');
    expect(local).toBeGreaterThan(-1);
    expect(invoke).toBeGreaterThan(local);
    expect(source).toContain("if (!local.confident) {");
    expect(source).not.toContain("if (error) throw error;");
  });
});
