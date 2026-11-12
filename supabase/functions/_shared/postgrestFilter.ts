// Turns caller text into a safe value for a PostgREST .or()/.ilike filter string:
// strips filter syntax (commas, parentheses, quotes, backslashes, dots-colons sequences)
// and LIKE wildcards, collapses whitespace and bounds the length.
export function safeFilterTerm(raw: unknown, max = 80): string {
  return String(raw ?? "")
    .replace(/[,()"'\\%*_:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
