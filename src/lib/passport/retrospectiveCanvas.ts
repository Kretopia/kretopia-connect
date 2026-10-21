// The retrospective card, drawn straight onto a canvas. One drawing is both the preview and the picture that is
// saved or shared, so what is seen is exactly what is exported (a DOM screenshot did not keep text spacing or line
// clamping). The layout is a pure function of the card and a text-measuring function, so it is tested without a
// canvas. All numbers are pixels on the 1080 x 1920 Story grid.

import type { RetroCard } from "./retrospective";

export const RETRO_EXPORT = { width: 1080, height: 1920, background: "#0B0D12" } as const;
export const RETRO_COLORS = { ink: "#FFFFFF", muted: "#A8B0C0", accent: "#FF2DA1" } as const;
export const RETRO_QR_SIZE = 384;

const MARGIN = 96;
const TEXT_WIDTH = RETRO_EXPORT.width - 2 * MARGIN;
const HEADER_BOTTOM = 280;
const FOOTER_TOP = 1740;

export interface TextItem {
  text: string;
  x: number;
  /** Baseline. */
  y: number;
  size: number;
  weight: 400 | 600 | 700 | 900;
  color: string;
  tracking: number;
}

export interface CardLayout {
  mark: { x: number; y: number; size: number };
  brand: TextItem;
  footer: TextItem;
  items: TextItem[];
  qr: { x: number; y: number; size: number } | null;
}

/** Width in pixels of `text` at `size`/`weight`, as the target font would draw it. */
export type Measure = (text: string, size: number, weight: number) => number;

/** Greedy word wrap to at most `maxLines`; an overlong word is split, and text that does not fit ends in an ellipsis. */
export function wrapLines(measure: (text: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const push = (value: string) => { lines.push(value); line = ""; };

  for (let word of words) {
    while (measure(word) > maxWidth) {
      // split an overlong word at the last character that fits
      let cut = word.length - 1;
      while (cut > 1 && measure(word.slice(0, cut)) > maxWidth) cut -= 1;
      if (line) push(line);
      push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) line = candidate;
    else { push(line); line = word; }
  }
  if (line) lines.push(line);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

export function layoutCard(card: RetroCard, measure: Measure): CardLayout {
  const { ink, muted, accent } = RETRO_COLORS;
  const text = (t: string, x: number, y: number, size: number, weight: TextItem["weight"], color: string, tracking = 0): TextItem => ({ text: t, x, y, size, weight, color, tracking });
  const fit = (size: number, weight: number, tracking = 0) => (t: string) => measure(t, size, weight) + tracking * t.length;

  const isCover = card.kind === "cover";
  const kickerSize = 36;
  const headSize = isCover ? 150 : 90;
  const headWeight = isCover ? 900 : 700;
  const headLines = wrapLines(fit(headSize, headWeight), card.headline, TEXT_WIDTH, isCover ? 2 : 3);
  const detailLines = card.detail ? wrapLines(fit(48, 400), card.detail, TEXT_WIDTH, 3) : [];
  const figureSize = 312;
  const hasQr = card.kind === "closing";

  // Heights of each stacked part, then the block is centred between the header and the footer.
  const kickerH = kickerSize * 1.3;
  const figureH = card.figure !== null ? figureSize * 0.8 : 0;
  const headH = headLines.length * headSize * 1.12;
  const detailH = detailLines.length * 48 * 1.4;
  const gaps = (card.figure !== null ? 36 : 0) + 40 + (detailLines.length ? 36 : 0) + (hasQr ? 72 : 0);
  const qrH = hasQr ? RETRO_QR_SIZE : 0;
  const total = kickerH + figureH + headH + detailH + qrH + gaps;
  let top = HEADER_BOTTOM + Math.max(0, (FOOTER_TOP - HEADER_BOTTOM - total) / 2);

  const items: TextItem[] = [];
  items.push(text(card.kicker.toUpperCase(), MARGIN, top + kickerSize, kickerSize, 600, muted, 7));
  top += kickerH;

  if (card.figure !== null) {
    top += 36;
    items.push(text(String(card.figure), MARGIN, top + figureH, figureSize, 900, accent));
    top += figureH;
  }

  top += 40;
  headLines.forEach((line, i) => items.push(text(line, MARGIN, top + headSize * 0.9 + i * headSize * 1.12, headSize, headWeight, ink)));
  top += headH;

  if (detailLines.length) {
    top += 36;
    detailLines.forEach((line, i) => items.push(text(line, MARGIN, top + 48 * 0.95 + i * 48 * 1.4, 48, 400, muted)));
    top += detailH;
  }

  let qr: CardLayout["qr"] = null;
  if (hasQr) {
    top += 72;
    qr = { x: MARGIN, y: top, size: RETRO_QR_SIZE };
    items.push(text("Scan to open", MARGIN + RETRO_QR_SIZE + 48, top + RETRO_QR_SIZE / 2 - 8, 44, 600, ink));
    items.push(text("the Passport", MARGIN + RETRO_QR_SIZE + 48, top + RETRO_QR_SIZE / 2 + 44, 44, 600, ink));
  }

  return {
    mark: { x: MARGIN, y: MARGIN, size: 96 },
    brand: text("Kretopia", MARGIN + 96 + 28, MARGIN + 66, 48, 700, ink),
    footer: text("Creative Passport · kretopia.com", MARGIN, 1824, 36, 400, muted),
    items,
    qr,
  };
}

export interface DrawAssets {
  /** The Kretopia K; a drawn letter takes its place when it is missing. */
  mark?: CanvasImageSource | null;
  qr?: CanvasImageSource | null;
}

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** Paints the card onto a 1080 x 1920 canvas context. */
export function drawRetrospectiveCard(ctx: CanvasRenderingContext2D, card: RetroCard, opts: { fontFamily: string; assets?: DrawAssets }): void {
  const c = ctx as Ctx;
  const family = opts.fontFamily || "system-ui, sans-serif";
  const assets = opts.assets ?? {};
  const setFont = (size: number, weight: number) => { c.font = `${weight} ${size}px ${family}`; };
  const layout = layoutCard(card, (t, size, weight) => { setFont(size, weight); c.letterSpacing = "0px"; return c.measureText(t).width; });

  c.fillStyle = RETRO_EXPORT.background;
  c.fillRect(0, 0, RETRO_EXPORT.width, RETRO_EXPORT.height);
  c.textAlign = "left";
  c.textBaseline = "alphabetic";

  const paint = (item: TextItem) => {
    setFont(item.size, item.weight);
    c.letterSpacing = `${item.tracking}px`;
    c.fillStyle = item.color;
    c.fillText(item.text, item.x, item.y);
    c.letterSpacing = "0px";
  };

  if (assets.mark) c.drawImage(assets.mark, layout.mark.x, layout.mark.y, layout.mark.size, layout.mark.size);
  else {
    setFont(88, 900);
    c.fillStyle = RETRO_COLORS.accent;
    c.fillText("K", layout.mark.x, layout.mark.y + 76);
  }
  paint(layout.brand);
  layout.items.forEach(paint);
  if (layout.qr && assets.qr) c.drawImage(assets.qr, layout.qr.x, layout.qr.y, layout.qr.size, layout.qr.size);
  paint(layout.footer);
}
