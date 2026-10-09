/**
 * Initials for a person who has no avatar: up to two letters, the same letters
 * every time. Never a mascot, never random: a person is shown as themselves or
 * as their initials.
 */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? "")
    .normalize("NFKC")
    .replace(/^@+/, "")
    .split(/[\s._-]+/)
    .map((w) => Array.from(w).find((ch) => /\p{L}|\p{N}/u.test(ch)) ?? "")
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0] : words[0] + words[words.length - 1];
  return letters.toLocaleUpperCase();
}
