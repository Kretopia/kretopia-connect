// Rule-based router for "Tell Kreto what you need" in a Studio. Pure and
// dependency-free: imported by the edge function (Deno), by the Studio composer
// (Vite) and by tests.
//
// Why it exists: the router used to need the AI gateway for every request, and
// when the workspace's AI credits ran out the gateway answered 402 and the
// composer showed "payment required" for a decision that is only "which of five
// outcomes". The decision is a small classification the product already
// specifies in plain words (its own system prompt lists the keywords), so it is
// made here, for free, with no network call. The AI is only an optional
// enhancement for requests the rules cannot place; its absence is never an
// error for the user.
//
// English and French. Accents are folded. An unmatched request is `chat`
// (opens the copilot pre-filled), which is always a valid outcome.

export const DOC_INTENTS = [
  "sponsor_deck",
  "pitch_deck",
  "business_plan",
  "client_proposal",
  "treatment",
  "rate_card",
  "moodboard_deck",
  "one_pager",
  "letter_of_intent",
] as const;
export type DocIntent = (typeof DOC_INTENTS)[number];

export type StudioOutcome = "make_document" | "find_people" | "find_gigs" | "draft_invoice" | "chat";

export interface RoutedOutcome {
  outcome: StudioOutcome;
  doc_intent: DocIntent | null;
  refined_brief: string;
  target_query: string | null;
  preview: string;
  /** The rules recognised the request (false: `chat` by default). */
  confident: boolean;
  routed_by: "rules";
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const has = (text: string, re: RegExp) => re.test(text);

// Document nouns: a request needs one of these to be a document request.
const DOC_NOUN =
  /\b(deck|decks|presentation|proposal|proposition|propale|treatment|traitement|rate card|ratecard|tarifs?|grille tarifaire|moodboard|mood board|one ?pager|one page|business plan|plan d affaires|pitch|letter|lettre|loi|brief creatif|dossier)\b/;

const LOI = /\b(loi|letter of intent|lettre d intention|letterhead|papier a en tete|lettre officielle|formal letter|lettre de partenariat)\b/;
const INVOICE =
  /\b(invoice|invoices|invoicing|bill (them|the client|him|her|for)|send a quote|a quote|the quote|devis|facture|factures|facturer|facture le client|note de frais)\b/;

const PEOPLE_NOUN =
  /\b(videographer|videographers|photographer|photographers|filmmaker|director of photography|dop|designer|designers|editor|editors|colorist|crew|talent|talents|collaborator|collaborators|collaborateur|collaborateurs|freelance|freelances|musician|musicians|dj|vendor|vendors|supplier|suppliers|cadreur|cadreurs|photographe|photographes|monteur|monteurs|equipe|prestataire|prestataires|fournisseur|fournisseurs|artiste|artistes|developer|developers|developpeur|developpeurs|producer|producers|people|someone|quelqu un|personne|personnes|casting|actor|actors|acteur|acteurs|model|models|mannequin|mannequins)\b/;
const GIG_NOUN =
  /\b(gig|gigs|sponsor|sponsors|sponsoring|opportunit(y|ies|e|es)|commission|commissions|paid work|jobs?|missions?|financement|funding|grant|grants|subvention|subventions|appel d offres|rfp|brand deals?|partenaires?|partners?|clients?)\b/;
const SEARCH_VERB =
  /\b(find|search|looking for|look for|need|needs|hire|recruit|source|get me|trouve|trouver|trouve moi|cherche|chercher|recherche|besoin d|besoin de|recrute|recruter|propose moi)\b/;

function pickDocIntent(t: string): DocIntent {
  if (has(t, LOI)) return "letter_of_intent";
  if (has(t, /\b(sponsor|sponsors|sponsorship|sponsoring|sponsorisation|partenariat|partnership)\b/)) return "sponsor_deck";
  if (has(t, /\b(business plan|plan d affaires)\b/)) return "business_plan";
  if (has(t, /\b(rate card|ratecard|grille tarifaire|tarifs?|price list|grille de prix)\b/)) return "rate_card";
  if (has(t, /\b(moodboard|mood board|planche d inspiration|planche tendance)\b/)) return "moodboard_deck";
  if (has(t, /\b(treatment|traitement|note d intention|creative treatment)\b/)) return "treatment";
  if (has(t, /\b(one ?pager|one page|1 page|une page|fiche)\b/)) return "one_pager";
  if (has(t, /\b(pitch|investor|investisseur|investisseurs|levee de fonds|fundraising)\b/)) return "pitch_deck";
  if (has(t, /\b(proposal|proposition|propale|offre|quote|deliverables|livrables|timeline|pricing)\b/)) return "client_proposal";
  // "deck" or "presentation" with nothing more specific
  return "pitch_deck";
}

const INTENT_LABEL: Record<DocIntent, string> = {
  sponsor_deck: "a sponsor deck",
  pitch_deck: "a pitch deck",
  business_plan: "a business plan",
  client_proposal: "a client proposal",
  treatment: "a treatment",
  rate_card: "a rate card",
  moodboard_deck: "a moodboard deck",
  one_pager: "a one-pager",
  letter_of_intent: "a letter of intent",
};

const FILLER =
  /^(please |s il te plait |s il vous plait |peux tu |peux-tu |pouvez vous |can you |could you |would you |kreto |hey kreto |i need |i want |i d like |i would like |je veux |je voudrais |j ai besoin d |j ai besoin de |il me faut |make me |make |create |build |draft |write |generate |prepare |fais moi |fais |fait moi |cree moi |cree |redige |ecris |genere |prepare |find me |find |trouve moi |trouve |cherche moi |cherche |me )+/;

/** A short brief without the polite filler, keeping what is specific. */
export function refineBrief(promptRaw: string): string {
  const original = promptRaw.replace(/\s+/g, " ").trim();
  // strip filler on the folded copy, then cut the same number of characters
  const folded = fold(original);
  const m = FILLER.exec(folded);
  let cut = 0;
  if (m) cut = m[0].length;
  // characters map 1:1 for ASCII and most accented letters after NFD folding of a precomposed char;
  // to stay safe, only strip when the original's first characters fold to the same text
  const head = original.slice(0, cut);
  if (cut > 0 && fold(head) === folded.slice(0, cut).trim()) {
    const rest = original.slice(cut).trim();
    if (rest.length >= 2) return rest.slice(0, 300);
  }
  return original.slice(0, 300);
}

export function routeByRules(promptRaw: unknown, _projectTitle?: string): RoutedOutcome {
  const prompt = typeof promptRaw === "string" ? promptRaw : "";
  const t = fold(prompt);
  const refined = refineBrief(prompt);

  const base = { refined_brief: refined || prompt.trim(), target_query: null as string | null, routed_by: "rules" as const };

  if (!t) {
    return { ...base, outcome: "chat", doc_intent: null, preview: "Let's talk it through.", confident: false };
  }

  // 1. A letter of intent is a document with its own template.
  if (has(t, LOI)) {
    return { ...base, outcome: "make_document", doc_intent: "letter_of_intent", preview: "Drafting a letter of intent on your letterhead.", confident: true };
  }

  // 2. An invoice or a quote.
  if (has(t, INVOICE) && !has(t, /\b(proposal|deck|presentation|proposition|treatment)\b/)) {
    return { ...base, outcome: "draft_invoice", doc_intent: null, preview: "Drafting an invoice for this project.", confident: true };
  }

  // 3. A document: a document noun, and no request to search for people.
  const searching = has(t, SEARCH_VERB);
  if (has(t, DOC_NOUN) && !(searching && has(t, PEOPLE_NOUN) && !has(t, /\b(deck|proposal|treatment|rate card|moodboard|one ?pager|business plan|presentation)\b/))) {
    const intent = pickDocIntent(t);
    return { ...base, outcome: "make_document", doc_intent: intent, preview: `Drafting ${INTENT_LABEL[intent]} from this Studio.`, confident: true };
  }

  // 4. Looking for people or looking for paid work / sponsors.
  if (searching && has(t, PEOPLE_NOUN) && !has(t, /\b(gig|gigs|sponsor|sponsors|opportunit|paid work|funding|grant)\b/)) {
    return { ...base, outcome: "find_people", doc_intent: null, target_query: refined.slice(0, 120), preview: "Looking for people who fit this.", confident: true };
  }
  if (has(t, GIG_NOUN) && (searching || has(t, /\b(gig|gigs|opportunit|paid work|funding|grant|appel d offres|rfp)\b/))) {
    return { ...base, outcome: "find_gigs", doc_intent: null, target_query: refined.slice(0, 120), preview: "Searching for matching opportunities.", confident: true };
  }
  if (searching && has(t, PEOPLE_NOUN)) {
    return { ...base, outcome: "find_people", doc_intent: null, target_query: refined.slice(0, 120), preview: "Looking for people who fit this.", confident: true };
  }

  // 5. Anything else: talk it through.
  return { ...base, outcome: "chat", doc_intent: null, preview: "Let's talk it through.", confident: false };
}
