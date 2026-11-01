/**
 * Instant routing for Kreto's input. A request that asks for a search, or names a page, opens that page at once: no model call, no
 * plan to approve and no server round trip that can be slow or fail. Anything that is not clearly such a command returns null and goes
 * to the model exactly as before. It reads the whole message whatever its length, and both Kreto surfaces share it.
 */

export interface KretoInstantRoute {
  path: string;
  /** What Kreto says while the page opens, in the language the person wrote in. */
  reply: string;
  /** The search term handed to the destination, when the request carried one. */
  query?: string;
}

interface Token {
  text: string;
  fold: string;
}

const words = (list: string) => new Set(list.split(" "));
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const EDGE_PUNCT = /^[\s"“”«»‘’'()[\]{}<>,.;:!?¿¡*_~`|\\/-]+|[\s"“”«»‘’'()[\]{}<>,.;:!?¿¡*_~`|\\/-]+$/g;

function tokenize(s: string): Token[] {
  return s
    .replace(/[’']/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(EDGE_PUNCT, ""))
    .filter(Boolean)
    .map((text) => ({ text, fold: fold(text) }));
}

/** A message that opens with one of these is a question for the model, not a command. */
const QUESTION_START = words("how what why when where who which whose whom comment pourquoi quand ou qui quel quelle quels quelles est-ce qu");

const STRONG_VERB = words("search searching find finding look looking browse hunt scout cherche chercher recherche rechercher trouve trouver");
const WEAK_VERB = words("show get give list see check want need wanna montre montrer affiche afficher donne donner voir veux voudrais besoin");
const STRONG_JOB = words("job jobs gig gigs opportunity opportunities opportunite opportunites emploi emplois boulot boulots");
const WEAK_JOB = words("role roles poste postes");
const NAV_VERB = words("open go show take bring navigate launch ouvre ouvrir va aller affiche montre emmene amene");
const MARKER = words("as for comme pour");
const SCOUT = words("scout");
const FRENCH = words("cherche chercher recherche rechercher trouve trouver montre montrer affiche afficher ouvre ouvrir emploi emplois poste postes boulot veux voudrais besoin stp svp pour un une des moi va aller emmene amene");

/** Words that frame a request but are not part of what is searched for. Every word left must be in the listing, so these are dropped. */
const FILLER = new Set<string>([
  ...STRONG_VERB, ...WEAK_VERB, ...STRONG_JOB, ...WEAK_JOB, ...NAV_VERB,
  ...words("a an the some any me my i we you it please pls plz can could would will to for as in on at of with about from and or kreto kretopia scout studio hey hi hello thanks thank s ll m d l t j c n qu"),
  ...words("new good great best nice cool real available open current latest recent top"),
  ...words("il plait stp svp merci un une des le la les du de moi mon ma mes je tu pour en comme sur dans a au aux et ou oui"),
]);

const PAGES: { words: Set<string>; path: string; label: string }[] = [
  { words: words("match matches matching"), path: "/match", label: "Match" },
  { words: words("discover discovery"), path: "/discover", label: "Discover" },
  { words: words("crew crews"), path: "/crews", label: "Crews" },
  { words: words("meetup meetups event events evenement evenements"), path: "/meetup", label: "Meetups" },
  { words: words("wallet thrivepay krepay payments payment invoices invoice portefeuille paiements paiement factures facture"), path: "/thrivepay", label: "KrePay" },
];

const has = (tokens: Token[], set: Set<string>) => tokens.some((t) => set.has(t.fold));

/** A job search: a searching verb with a job noun, or a weaker verb ("show", "need") only with an unambiguous noun ("job", "gig"). */
function isJobSearch(tokens: Token[]): boolean {
  return (has(tokens, STRONG_VERB) && (has(tokens, STRONG_JOB) || has(tokens, WEAK_JOB))) || (has(tokens, WEAK_VERB) && has(tokens, STRONG_JOB));
}

/**
 * The role and place the person asked for, as the words Scout can match ("UX Designer Paris"). Words after "as"/"for" that follow the job
 * noun win ("a job as UX designer for Spotify"); otherwise whatever is not framing. Six words at most: a longer term matches nothing.
 */
function searchTerm(tokens: Token[]): string {
  const job = tokens.findIndex((t) => STRONG_JOB.has(t.fold) || WEAK_JOB.has(t.fold));
  const marker = job >= 0 ? tokens.findIndex((t, i) => i > job && MARKER.has(t.fold)) : -1;
  const keep = (list: Token[]) => list.filter((t) => !FILLER.has(t.fold));
  const tail = marker >= 0 ? keep(tokens.slice(marker + 1)) : [];
  return (tail.length > 0 ? tail : keep(tokens)).slice(0, 6).map((t) => t.text).join(" ");
}

const reply = (label: string, query: string, french: boolean) =>
  french
    ? query ? `J’ouvre ${label} pour « ${query} ».` : `J’ouvre ${label}.`
    : query ? `Opening ${label} for “${query}”.` : `Opening ${label}.`;

export function matchKretoRoute(raw: string): KretoInstantRoute | null {
  const all = tokenize(raw);
  if (all.length === 0 || QUESTION_START.has(all[0].fold)) return null;
  const french = has(all, FRENCH);

  // The sentence that carries the request, so a long message with background around it still routes.
  const sentences = raw.split(/[\n!?;]+|\.(?=\s|$)/).map(tokenize).filter((s) => s.length > 0);
  const jobSearch = sentences.find(isJobSearch) ?? (isJobSearch(all) ? all : undefined);
  const onScout =
    all[0].fold === "scout" ||
    (has(all.slice(0, 3), NAV_VERB) && has(all, SCOUT)) ||
    (all.length >= 2 && all[all.length - 1].fold === "scout" && words("on in at sur dans").has(all[all.length - 2].fold));
  if (jobSearch || onScout) {
    const query = searchTerm(jobSearch ?? sentences.find((s) => s.some((t) => t.fold === "scout")) ?? all);
    return { path: query ? `/scout?tab=all&q=${encodeURIComponent(query)}` : "/scout?tab=all", reply: reply("Scout", query, french), ...(query ? { query } : {}) };
  }

  if (all.length <= 8 && has(all.slice(0, 3), NAV_VERB)) {
    const page = PAGES.find((p) => has(all, p.words));
    if (page) return { path: page.path, reply: reply(page.label, "", french) };
  }

  // An explicit search without a job noun belongs to the existing full
  // results page, not a planner-generated search_creators step. Keep the
  // complete term (including two-letter specialties such as UX).
  const searchRequest = sentences.find((tokens) => {
    const verb = tokens.findIndex((t) => STRONG_VERB.has(t.fold));
    return verb >= 0 && tokens.slice(0, verb).every((t) => FILLER.has(t.fold));
  });
  if (searchRequest) {
    const query = searchRequest.filter((t) => !FILLER.has(t.fold)).map((t) => t.text).join(" ");
    if (query) return { path: `/search?q=${encodeURIComponent(query)}`, reply: reply("Search", query, french), query };
  }
  return null;
}
