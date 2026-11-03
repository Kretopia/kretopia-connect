/**
 * What Kreto's voice is given to say. A reply is written to be read on a screen: markdown, links, emoji, currency and ranges all mean
 * something there, and a text-to-speech voice reads them literally ("https colon slash slash…", "asterisk asterisk", "dollar sign one comma
 * two hundred"). toSpeech turns a reply into what a person would actually say out loud; splitSpeech cuts it at sentence ends, so each
 * piece is a natural phrase and the first one can start playing while the rest are still being made.
 *
 * Pure and dependency-free. Regular expressions avoid look-behind, which older Safari cannot parse.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CURRENCY: Record<string, [string, string]> = { $: ["dollar", "dollars"], "€": ["euro", "euros"], "£": ["pound", "pounds"] };
const PER: Record<string, string> = { day: "a day", hr: "an hour", hour: "an hour", week: "a week", wk: "a week", mo: "a month", month: "a month", yr: "a year", year: "a year" };
const SCALE: Record<string, string> = { k: " thousand", m: " million" };

const money = (symbol: string, amount: string, scale: string | undefined, per: string | undefined) => {
  const [one, many] = CURRENCY[symbol];
  const value = amount.replace(/[,.]+$/, "");
  const unit = value === "1" && !scale ? one : many;
  return `${value}${scale ? SCALE[scale.toLowerCase()] : ""} ${unit}${per ? ` ${PER[per.toLowerCase()] ?? ""}` : ""}`;
};

export function toSpeech(input: string): string {
  let t = String(input ?? "");

  // Things that are not for the ear at all: code blocks, the agent's own action/plan tags, tables' rules, ids.
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/<(action|plan)\b[\s\S]*?<\/\1>/gi, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, " ");
  t = t.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, " ");

  // Markdown structure.
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  t = t.replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, "$1.");
  t = t.replace(/^\s{0,3}>\s?/gm, "");
  t = t.replace(/^\s*(?:[-*+•]|\d+[.)])\s+(.*)$/gm, (_m, item: string) => (/[.!?…:]$/.test(item.trim()) ? item : `${item.trim()}.`));
  t = t.replace(/^\s*\|(.*)\|\s*$/gm, (_m, row: string) => `${row.split("|").map((c) => c.trim()).filter(Boolean).join(", ")}.`);
  t = t.replace(/(\*\*|__)(.*?)\1/g, "$2").replace(/(\*|_)(?=\S)(.*?\S)\1/g, "$2").replace(/~~(.*?)~~/g, "$1").replace(/`([^`]*)`/g, "$1");

  // Links and addresses: said as what they are, never spelled out.
  t = t.replace(/\bhttps?:\/\/[^\s)]+/gi, "a link").replace(/\bwww\.[^\s)]+/gi, "a link");
  t = t.replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "an email address");
  t = t.replace(/(^|\s)@(\w+)/g, "$1$2").replace(/(^|\s)#(\w+)/g, "$1$2");

  // Pictographs and the joiners that carry them.
  t = t.replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f/gu, "");

  // Numbers the way a person says them.
  t = t.replace(/([$€£])\s?(\d[\d,]*(?:\.\d+)?)(?:\s?([kKmM])\b)?\s?[–-]\s?\1?\s?(\d[\d,]*(?:\.\d+)?)(?:\s?([kKmM])\b)?(?:\s?\/\s?(day|hr|hour|week|wk|mo|month|yr|year)\b)?/g, (_m, sym: string, a: string, sa: string | undefined, b: string, sb: string | undefined, per: string | undefined) =>
    `${a.replace(/[,.]+$/, "")}${sa ? SCALE[sa.toLowerCase()] : ""} to ${money(sym, b, sb, per)}`,
  );
  t = t.replace(/([$€£])\s?(\d[\d,]*(?:\.\d+)?)(?:\s?([kKmM])\b)?(?:\s?\/\s?(day|hr|hour|week|wk|mo|month|yr|year)\b)?/g, (_m, sym: string, n: string, scale: string | undefined, per: string | undefined) => money(sym, n, scale, per));
  t = t.replace(/(\d)\s?%/g, "$1 percent");
  t = t.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y: string, mo: string, d: string) => (Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31 ? `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}` : m));
  t = t.replace(/(^|[^\d-])(\d{1,4})\s?[–-]\s?(\d{1,4})(?![\d-])/g, "$1$2 to $3");

  // Abbreviations and symbols.
  t = t.replace(/\be\.g\.,?/gi, "for example,").replace(/\bi\.e\.,?/gi, "that is,").replace(/\bvs\.?(?=\s)/gi, "versus").replace(/\betc\.?/gi, "and so on").replace(/\bw\//gi, "with ");
  t = t.replace(/\s&\s/g, " and ").replace(/\band\/or\b/gi, "and or");
  t = t.replace(/\[\d+\]/g, "");

  // Pauses: long dashes become commas, runs of punctuation become one mark.
  t = t.replace(/\s*[—–]\s*/g, ", ").replace(/([!?])\1+/g, "$1").replace(/\.{2,}/g, "…");

  t = t.replace(/\s+/g, " ").replace(/\s+([,.;:!?…])/g, "$1").replace(/,\s*,/g, ",").trim();
  if (t && !/[.!?…]$/.test(t)) t += ".";
  return t;
}

const SENTENCE = /[^.!?…]+(?:[.!?…]+["')\]]*)?\s*/g;

/** Splits at sentence ends into pieces of at most `max` characters (the first at most `firstMax`, so playback can begin sooner). */
export function splitSpeech(text: string, max = 420, firstMax = 240): string[] {
  const sentences = (text.match(SENTENCE) ?? []).map((s) => s.trim()).filter(Boolean);
  const pieces: string[] = [];
  const limitFor = () => (pieces.length === 0 ? firstMax : max);
  let current = "";
  const flush = () => {
    if (current) pieces.push(current);
    current = "";
  };
  for (const sentence of sentences) {
    for (const part of sentence.length > max ? breakLong(sentence, max) : [sentence]) {
      if (current && current.length + 1 + part.length > limitFor()) flush();
      current = current ? `${current} ${part}` : part;
    }
  }
  flush();
  return pieces;
}

/** A single sentence longer than a piece: cut at commas and semicolons, then at spaces. */
function breakLong(sentence: string, max: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const clause of (sentence.match(/[^,;:]+[,;:]?\s*/g) ?? [sentence]).map((c) => c.trim()).filter(Boolean)) {
    const words = clause.length > max ? clause.split(" ") : [clause];
    for (const word of words) {
      if (current && current.length + 1 + word.length > max) {
        out.push(current);
        current = "";
      }
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}
