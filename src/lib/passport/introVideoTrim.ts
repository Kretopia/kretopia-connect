/**
 * The intro video's cut is stored in its URL as a media fragment (`#t=start,end`), so trimming needs no schema change
 * and the original file stays untouched. Browsers start at `start`; the player also stops at `end`.
 */
export interface IntroTrim { start: number; end: number | null }

const round = (n: number) => Math.round(n * 10) / 10;

export function parseIntroVideo(url: string): { src: string; trim: IntroTrim } {
  const [src, hash = ""] = url.split("#");
  const m = /(?:^|&)t=([\d.]+)?(?:,([\d.]+))?/.exec(hash);
  const start = m?.[1] ? Number(m[1]) : 0;
  const end = m?.[2] ? Number(m[2]) : null;
  return { src, trim: { start: Number.isFinite(start) ? start : 0, end: end !== null && end > start ? end : null } };
}

export function withIntroTrim(url: string, trim: IntroTrim, duration?: number): string {
  const { src } = parseIntroVideo(url);
  const start = Math.max(0, round(trim.start));
  const end = trim.end === null ? null : round(trim.end);
  const fullLength = end === null || (duration !== undefined && end >= round(duration) - 0.05);
  if (start <= 0 && fullLength) return src;
  return `${src}#t=${start}${fullLength ? "" : `,${end}`}`;
}
