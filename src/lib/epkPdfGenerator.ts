/**
 * EPK (Electronic Press Kit) PDF Generator — Kretopia Editorial Deck
 *
 * Visual language ported from the app's own dark editorial system
 * (src/index.css: --background #05070D, --card #11141B, --energy #FF2DA1,
 * --success #1DB954) plus the real Kretopia K-mark/wordmark logo assets —
 * bordered cards, a small K-icon eyebrow on every section, colored
 * top-accent bars, badge pills, and a closing contact card. Gated to
 * Creator / Creator+ subscribers.
 */
import kMarkAsset from "@/assets/brand/kretopia-k-mark.png.asset.json";
import wordmarkAsset from "@/assets/brand/kretopia-wordmark.png.asset.json";

interface EPKProfileData {
  full_name: string;
  role?: string;
  job_title?: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  website?: string;
  calendly_url?: string;
  linkedin_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  youtube_url?: string;
  spotify_url?: string;
  behance_url?: string;
  imdb_url?: string;
  soundcloud_url?: string;
  average_rating?: number;
  total_reviews?: number;
  professional_skills?: any;
  passion_skills?: any;
  collab_intent?: string;
  rate_range?: string;
  cover_image_url?: string;
  verification_tier?: string;
  verification_status?: string;
}

interface EPKCredit {
  project_name?: string;
  title?: string;
  role: string;
  year?: number;
  platform?: string;
  isVerified?: boolean;
  verificationTier?: string;
  credit_category?: string;
  thumbnail_url?: string;
}

interface EPKAward {
  title: string;
  organization: string;
  year?: number;
  category?: string;
}

interface EPKPressLink {
  title: string;
  publication?: string;
  url?: string;
}

interface EPKIndustryStat {
  title: string;
  value?: string;
  issuer?: string;
}

interface EPKReview {
  reviewer_name?: string;
  rating: number;
  review_text?: string;
}

export interface EPKPdfInput {
  profile: EPKProfileData;
  credits: EPKCredit[];
  awards: EPKAward[];
  pressLinks: EPKPressLink[];
  industryStats: EPKIndustryStat[];
  reviews: EPKReview[];
}

export interface EPKBrandingOptions {
  primaryColor?: [number, number, number];
  accentColor?: [number, number, number];
  darkColor?: [number, number, number];
  logoUrl?: string;
  tagline?: string;
  templateId?: string;
}

// EPK PDF Template definitions
export type EPKTemplateId = 'cinematic-dark' | 'clean-light' | 'bold-minimal';

export interface EPKTemplate {
  id: EPKTemplateId;
  name: string;
  description: string;
  previewBg: string;
  previewAccent: string;
  previewText: string;
  palette: {
    bg: [number, number, number];
    surface: [number, number, number];
    card: [number, number, number];
    cardBorder: [number, number, number];
    primary: [number, number, number];
    accent: [number, number, number];
    gold: [number, number, number];
    white: [number, number, number];
    muted: [number, number, number];
    dimmed: [number, number, number];
    light: [number, number, number];
  };
}

export const EPK_TEMPLATES: EPKTemplate[] = [
  {
    id: 'cinematic-dark',
    name: 'Kretopia Editorial',
    description: 'The real Kretopia dark canvas — signal pink, bordered cards, editorial type',
    previewBg: 'bg-[#05070D]',
    previewAccent: 'bg-[#FF2DA1]',
    previewText: 'text-white',
    palette: {
      bg: [5, 7, 13],            // #05070D — app's real --background (dark)
      surface: [13, 16, 22],
      card: [17, 20, 27],        // #11141B — app's real --card (dark)
      cardBorder: [30, 34, 44],
      primary: [255, 45, 161],   // #FF2DA1 — app's real --energy
      accent: [255, 120, 195],
      gold: [255, 196, 64],
      white: [255, 255, 255],
      muted: [168, 176, 192],    // #A8B0C0 — app's real --muted-foreground (dark)
      dimmed: [95, 101, 115],
      light: [225, 228, 235],
    },
  },
  {
    id: 'clean-light',
    name: 'Editorial Light',
    description: 'Warm white canvas, same signal pink accent — for print-first EPKs',
    previewBg: 'bg-[#FAFAF8]',
    previewAccent: 'bg-[#DC1478]',
    previewText: 'text-[#1a1a1a]',
    palette: {
      bg: [250, 250, 248],
      surface: [244, 244, 241],
      card: [255, 255, 255],
      cardBorder: [228, 226, 220],
      primary: [220, 20, 120],
      accent: [220, 20, 120],
      gold: [190, 140, 20],
      white: [26, 26, 26],       // inverted: text is dark
      muted: [110, 110, 115],
      dimmed: [170, 168, 162],
      light: [40, 38, 35],
    },
  },
  {
    id: 'bold-minimal',
    name: 'Pure Black',
    description: 'Pure black canvas, signal pink accent — striking & modern',
    previewBg: 'bg-black',
    previewAccent: 'bg-[#FF2DA1]',
    previewText: 'text-white',
    palette: {
      bg: [0, 0, 0],
      surface: [13, 13, 13],
      card: [20, 20, 20],
      cardBorder: [40, 40, 40],
      primary: [255, 45, 161],
      accent: [255, 45, 161],
      gold: [255, 196, 64],
      white: [255, 255, 255],
      muted: [140, 140, 140],
      dimmed: [80, 80, 80],
      light: [220, 220, 220],
    },
  },
];

export function getEPKTemplate(id?: string): EPKTemplate {
  return EPK_TEMPLATES.find(t => t.id === id) || EPK_TEMPLATES[0];
}

// Category accent colors for credit cards — a few distinct hues around the
// same warm/cool split as the rest of the palette, not a random rainbow.
const CATEGORY_ACCENTS: Record<string, [number, number, number]> = {
  film: [255, 45, 161],
  music: [220, 60, 190],
  tv: [90, 140, 255],
  podcast: [29, 185, 84],
  photography: [255, 167, 64],
  video: [235, 82, 140],
  design: [64, 200, 190],
  writing: [230, 190, 60],
};

// 16:9 landscape dimensions in mm
const PAGE_W = 338;
const PAGE_H = 190;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

function decodeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Reads natural pixel dimensions off a data URL so logo images can be
 *  drawn at the right aspect ratio instead of stretched into a fixed box. */
function readImageDims(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

interface LoadedLogo { dataUrl: string; aspect: number }

async function loadLogo(url: string): Promise<LoadedLogo | null> {
  const dataUrl = await loadImageAsDataUrl(url);
  if (!dataUrl) return null;
  const dims = await readImageDims(dataUrl);
  if (!dims || !dims.w || !dims.h) return null;
  return { dataUrl, aspect: dims.w / dims.h };
}

function truncateText(doc: any, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  while (text.length > 0 && doc.getTextWidth(text + '...') > maxWidth) {
    text = text.slice(0, -1);
  }
  return text + '...';
}

export async function generateEPKPdf(input: EPKPdfInput, brandingOptions?: EPKBrandingOptions): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc: any = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_W, PAGE_H] });

  // Resolve template palette first, then allow branding overrides
  const tpl = getEPKTemplate(brandingOptions?.templateId);

  const C = {
    bg: brandingOptions?.darkColor || tpl.palette.bg,
    surface: tpl.palette.surface,
    card: tpl.palette.card,
    cardBorder: tpl.palette.cardBorder,
    primary: brandingOptions?.primaryColor || tpl.palette.primary,
    accent: brandingOptions?.accentColor || tpl.palette.accent,
    gold: tpl.palette.gold,
    white: tpl.palette.white,
    muted: tpl.palette.muted,
    dimmed: tpl.palette.dimmed,
    light: tpl.palette.light,
  };

  const { profile, credits, awards, pressLinks, industryStats, reviews } = input;
  let pageNum = 0;

  // ── Card / chrome helpers ────────────────────────────────
  const fillPage = () => {
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  };

  /** Bordered rounded card -- fill + a subtle 1px stroke, matching the
   *  app's real .border-white/[0.08]-on-card look instead of a flat fill. */
  const drawCard = (x: number, y: number, w: number, h: number, r = 4) => {
    doc.setFillColor(...C.card);
    doc.setDrawColor(...C.cardBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, r, r, 'FD');
  };

  /** Small rounded-full status pill: colored dot + bold label. */
  const drawPill = (text: string, x: number, y: number, color: [number, number, number]): number => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    const tw = doc.getTextWidth(text);
    const pillW = tw + 11;
    const pillH = 6.5;
    doc.setFillColor(...C.surface);
    doc.setDrawColor(...C.cardBorder);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, pillW, pillH, pillH / 2, pillH / 2, 'FD');
    doc.setFillColor(...color);
    doc.circle(x + 4, y + pillH / 2, 1.1, 'F');
    doc.setTextColor(...C.light);
    doc.text(text, x + 7.5, y + pillH / 2 + 1.3);
    return pillW;
  };

  /** A single filled 5-point star, drawn as a vector path -- jsPDF's built-in
   *  "helvetica" font has no glyph for the Unicode star character (it was
   *  rendering as a literal "&"), so ratings are drawn as shapes instead. */
  const drawStar = (cx: number, cy: number, r: number, color: [number, number, number]) => {
    const innerR = r * 0.42;
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : innerR;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)]);
    }
    const segs: [number, number][] = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    segs.push([pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]]);
    doc.setFillColor(...color);
    doc.lines(segs, pts[0][0], pts[0][1], [1, 1], 'F', true);
  };

  /** Five-star rating row, filled up to `rating`, dimmed after. */
  const drawStarRating = (rating: number, x: number, y: number, r = 2.2) => {
    const filled = Math.round(rating);
    for (let i = 0; i < 5; i++) {
      drawStar(x + i * r * 2.5 + r, y, r, i < filled ? C.gold : C.cardBorder);
    }
  };

  const drawFooter = (num: number, total: number) => {
    doc.setFillColor(...C.primary);
    doc.rect(0, PAGE_H - 8, PAGE_W, 0.4, 'F');
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.dimmed);
    doc.text('kretopia.com', MARGIN, PAGE_H - 3.5);
    doc.text(`${num} / ${total}`, PAGE_W - MARGIN, PAGE_H - 3.5, { align: 'right' });
  };

  const newPage = () => {
    doc.addPage([PAGE_W, PAGE_H], 'landscape');
    pageNum++;
    fillPage();
  };

  // ── Logos — the real Kretopia K-mark + wordmark, not a placeholder ──
  const [kMark, wordmark] = await Promise.all([
    loadLogo(kMarkAsset.url),
    loadLogo(wordmarkAsset.url),
  ]);

  /** Full "K kretopia" lockup -- cover + closing page only, matching the
   *  reference deck's own restraint (every other page gets just the mini
   *  icon below, via drawEyebrow). */
  const drawLogoLockup = (x: number, y: number) => {
    let cx = x;
    const markH = 8;
    if (kMark) {
      const markW = markH * kMark.aspect;
      doc.addImage(kMark.dataUrl, 'PNG', cx, y, markW, markH);
      cx += markW + 3.5;
    }
    if (wordmark) {
      const wordH = 5.5;
      const wordW = wordH * wordmark.aspect;
      doc.addImage(wordmark.dataUrl, 'PNG', cx, y + (markH - wordH) / 2, wordW, wordH);
    }
  };

  /** Mini K-icon + pink uppercase tracked-out label -- the section eyebrow
   *  every page in the reference deck opens with. Returns the y just below
   *  the eyebrow's underline, ready for a headline. */
  const drawEyebrow = (label: string, x: number, y: number): number => {
    let tx = x;
    if (kMark) {
      const iconH = 3.6;
      const iconW = iconH * kMark.aspect;
      doc.addImage(kMark.dataUrl, 'PNG', tx, y - iconH + 0.8, iconW, iconH);
      tx += iconW + 2.4;
    }
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text(label.toUpperCase(), tx, y);
    return y;
  };

  /** Bold section headline under an eyebrow -- the reference deck's own
   *  "big white statement" pattern, scaled to an inline column instead of
   *  a full-page cover. */
  const drawSectionHeadline = (text: string, x: number, y: number, size = 15): number => {
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.white);
    doc.text(text, x, y);
    return y;
  };

  // Pre-load avatar + cover image
  let avatarData: string | null = null;
  if (profile.avatar_url) avatarData = await loadImageAsDataUrl(profile.avatar_url);
  let coverData: string | null = null;
  if (profile.cover_image_url) coverData = await loadImageAsDataUrl(profile.cover_image_url);

  // ════════════════════════════════════════════════════════════
  // SLIDE 1: COVER / HERO
  // ════════════════════════════════════════════════════════════
  pageNum = 1;
  fillPage();

  // Soft ambient glow, top-right -- the reference deck's own corner-glow
  // treatment, approximated with a few large low-opacity pink circles
  // rather than a true radial gradient (jsPDF has no gradient fill API).
  doc.setGState(new doc.GState({ opacity: 0.10 }));
  doc.setFillColor(...C.primary);
  doc.circle(PAGE_W - 40, 10, 90, 'F');
  doc.setGState(new doc.GState({ opacity: 0.06 }));
  doc.circle(PAGE_W - 40, 10, 130, 'F');
  doc.setGState(new doc.GState({ opacity: 1 }));

  if (coverData) {
    doc.addImage(coverData, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    doc.setGState(new doc.GState({ opacity: 0.78 }));
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));
  }

  drawLogoLockup(MARGIN, 12);

  const heroLeftX = MARGIN;
  const eyebrowY = 34;
  drawEyebrow('Creative Passport', heroLeftX, eyebrowY);

  // Avatar
  const avatarSize = 40;
  const avatarY = eyebrowY + 10;
  if (avatarData) {
    doc.setFillColor(...C.primary);
    doc.roundedRect(heroLeftX - 1.5, avatarY - 1.5, avatarSize + 3, avatarSize + 3, 6, 6, 'F');
    doc.addImage(avatarData, 'JPEG', heroLeftX, avatarY, avatarSize, avatarSize);
  }

  const nameX = avatarData ? heroLeftX + avatarSize + 12 : heroLeftX;
  const nameY = avatarY + 14;
  doc.setFontSize(30);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text(profile.full_name || 'Creator', nameX, nameY);

  const displayRole = profile.job_title || profile.role || 'Creative Professional';
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.primary);
  doc.text(displayRole, nameX, nameY + 9);

  // Meta badge row: location + verification, as pills matching the
  // reference deck's badge-pill row on its own cover.
  let pillX = nameX;
  const pillY = nameY + 15;
  if (profile.location) {
    pillX += drawPill(profile.location, pillX, pillY, C.muted) + 4;
  }
  if (profile.verification_tier || profile.verification_status === 'verified') {
    const badge = profile.verification_tier === 'elite' ? 'Elite Verified'
      : profile.verification_tier === 'industry' ? 'Industry Verified'
      : 'Verified Creator';
    pillX += drawPill(badge, pillX, pillY, C.primary) + 4;
  }
  if (profile.collab_intent) {
    drawPill(`Open to ${profile.collab_intent.replace(/_/g, ' ')}`, pillX, pillY, C.gold);
  }

  // Right side: bordered stat cards -- the block's width is derived from
  // the actual item count and right-anchored to the content margin, so it
  // can never run past the page edge regardless of how many stats exist
  // (a fixed left position + fixed spacing previously overflowed off the
  // right edge of the page whenever all 4 stats were present).
  const statItems: { label: string; value: string }[] = [];
  if (credits.length > 0) statItems.push({ label: 'Credits', value: String(credits.length) });
  const verifiedCount = credits.filter(c => c.isVerified).length;
  if (verifiedCount > 0) statItems.push({ label: 'Verified', value: String(verifiedCount) });
  if (awards.length > 0) statItems.push({ label: 'Awards', value: String(awards.length) });
  if (profile.average_rating) statItems.push({ label: 'Rating', value: profile.average_rating.toFixed(1) });

  const shownStats = statItems.slice(0, 4);
  const statCardW = 25;
  const statCardGap = 5;
  const statsBlockW = shownStats.length * statCardW + (shownStats.length - 1) * statCardGap;
  const statsX = PAGE_W - MARGIN - statsBlockW;
  const statsY = avatarY + 4;

  shownStats.forEach((stat, i) => {
    const sx = statsX + i * (statCardW + statCardGap);
    drawCard(sx, statsY, statCardW, 34, 4);
    doc.setFontSize(19);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.primary);
    doc.text(stat.value, sx + statCardW / 2, statsY + 17, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.muted);
    doc.text(stat.label.toUpperCase(), sx + statCardW / 2, statsY + 25, { align: 'center' });
  });

  // ════════════════════════════════════════════════════════════
  // SLIDE 2: ABOUT + SKILLS
  // ════════════════════════════════════════════════════════════
  newPage();
  drawEyebrow('Profile', MARGIN, 24);
  drawSectionHeadline('About', MARGIN, 34);

  const aboutX = MARGIN;
  let aboutY = 44;

  if (profile.bio) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.light);
    const bioLines = doc.splitTextToSize(profile.bio, CONTENT_W / 2 - 10);
    doc.text(bioLines.slice(0, 11), aboutX, aboutY);
    aboutY += Math.min(bioLines.length, 11) * 5 + 8;
  }

  if (profile.collab_intent || profile.rate_range) {
    let ax = aboutX;
    const ay = aboutY;
    if (profile.collab_intent) {
      ax += drawPill(`Open to ${profile.collab_intent.replace(/_/g, ' ')}`, ax, ay, C.primary) + 4;
    }
    if (profile.rate_range) {
      drawPill(profile.rate_range, ax, ay, C.gold);
    }
  }

  // Right half: Skills + Connect, both inside a bordered card
  const skillsX = PAGE_W / 2 + 10;
  drawEyebrow('Expertise', skillsX, 24);
  drawSectionHeadline('Skills & Connect', skillsX, 34);
  let skillsY = 44;

  const allSkills: string[] = [
    ...(Array.isArray(profile.professional_skills)
      ? profile.professional_skills.map((s: any) => typeof s === 'string' ? s : s?.skill || s?.name).filter(Boolean)
      : []),
    ...(Array.isArray(profile.passion_skills)
      ? profile.passion_skills.map((s: any) => typeof s === 'string' ? s : s?.skill || s?.name).filter(Boolean)
      : [])
  ];

  if (allSkills.length > 0) {
    let chipX = skillsX;
    let chipY = skillsY;
    const chipMaxX = PAGE_W - MARGIN;
    const chipH = 8;
    const chipPadX = 4;
    const chipGap = 3;

    allSkills.slice(0, 16).forEach((skill) => {
      doc.setFontSize(7.5);
      const tw = doc.getTextWidth(skill);
      const chipW = tw + chipPadX * 2;
      if (chipX + chipW > chipMaxX) {
        chipX = skillsX;
        chipY += chipH + chipGap;
      }
      doc.setFillColor(...C.surface);
      doc.setDrawColor(...C.cardBorder);
      doc.setLineWidth(0.2);
      doc.roundedRect(chipX, chipY, chipW, chipH, 3, 3, 'FD');
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.light);
      doc.text(skill, chipX + chipPadX, chipY + 5.5);
      chipX += chipW + chipGap;
    });
    skillsY = chipY + chipH + 10;
  }

  const contactLinks: { label: string; url: string }[] = [];
  if (profile.website) contactLinks.push({ label: 'Website', url: profile.website });
  if (profile.linkedin_url) contactLinks.push({ label: 'LinkedIn', url: profile.linkedin_url });
  if (profile.instagram_url) contactLinks.push({ label: 'Instagram', url: profile.instagram_url });
  if (profile.youtube_url) contactLinks.push({ label: 'YouTube', url: profile.youtube_url });
  if (profile.spotify_url) contactLinks.push({ label: 'Spotify', url: profile.spotify_url });
  if (profile.twitter_url) contactLinks.push({ label: 'X (Twitter)', url: profile.twitter_url });
  if (profile.behance_url) contactLinks.push({ label: 'Behance', url: profile.behance_url });
  if (profile.imdb_url) contactLinks.push({ label: 'IMDb', url: profile.imdb_url });
  if (profile.soundcloud_url) contactLinks.push({ label: 'SoundCloud', url: profile.soundcloud_url });
  if (profile.calendly_url) contactLinks.push({ label: 'Book a Call', url: profile.calendly_url });

  if (contactLinks.length > 0) {
    const rows = Math.min(contactLinks.length, 8);
    const cardH = rows * 6.4 + 8;
    drawCard(skillsX, skillsY, CONTENT_W / 2, cardH, 4);
    let linkY = skillsY + 8;
    contactLinks.slice(0, 8).forEach((link) => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.primary);
      doc.text(link.label, skillsX + 6, linkY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.muted);
      const labelW = doc.getTextWidth(link.label);
      const urlTrunc = truncateText(doc, link.url, CONTENT_W / 2 - labelW - 24);
      doc.text(`  ${urlTrunc}`, skillsX + 6 + labelW, linkY);
      doc.link(skillsX + 6, linkY - 3, CONTENT_W / 2 - 12, 5, { url: link.url });
      linkY += 6.4;
    });
  }

  // ════════════════════════════════════════════════════════════
  // SLIDE 3+: CREDITS (Visual Cards)
  // ════════════════════════════════════════════════════════════
  if (credits.length > 0) {
    const CARDS_PER_ROW = 4;
    const ROWS_PER_PAGE = 2;
    const CARDS_PER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;
    const cardGap = 6;
    const totalCardW = (CONTENT_W - (CARDS_PER_ROW - 1) * cardGap) / CARDS_PER_ROW;
    const displayCredits = credits.slice(0, 24);

    for (let pageIdx = 0; pageIdx < Math.ceil(displayCredits.length / CARDS_PER_PAGE); pageIdx++) {
      newPage();
      const pageCredits = displayCredits.slice(pageIdx * CARDS_PER_PAGE, (pageIdx + 1) * CARDS_PER_PAGE);

      drawEyebrow('Portfolio', MARGIN, 24);
      drawSectionHeadline(
        pageIdx === 0 ? `Selected Work — ${credits.length} Credits` : 'Selected Work (continued)',
        MARGIN, 34,
      );

      const startY = 42;
      const cardH = (PAGE_H - startY - MARGIN);

      pageCredits.forEach((credit, i) => {
        const row = Math.floor(i / CARDS_PER_ROW);
        const col = i % CARDS_PER_ROW;
        const cx = MARGIN + col * (totalCardW + cardGap);
        const cy = startY + row * (cardH + cardGap);

        drawCard(cx, cy, totalCardW, cardH, 4);

        // Category accent bar across the top -- replaces the old flat
        // color-block "visual area" with the reference deck's thin
        // colored-top-border card language.
        const catKey = (credit.credit_category || '').toLowerCase();
        const catColor = Object.entries(CATEGORY_ACCENTS).find(([k]) => catKey.includes(k))?.[1] || C.cardBorder;
        doc.setFillColor(...catColor);
        doc.roundedRect(cx, cy, totalCardW, 1.6, 4, 4, 'F');
        doc.rect(cx, cy, totalCardW, 1, 'F');

        const padX = cx + 5;
        let textY = cy + 11;

        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.white);
        const creditName = decodeHtml(credit.project_name || credit.title || '');
        const nameLines = doc.splitTextToSize(creditName, totalCardW - 10);
        doc.text(nameLines.slice(0, 2), padX, textY);
        textY += Math.min(nameLines.length, 2) * 5 + 3;

        if (credit.isVerified) {
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...C.primary);
          doc.text('VERIFIED', cx + totalCardW - 5, cy + 7, { align: 'right' });
        }

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.light);
        doc.text(truncateText(doc, credit.role, totalCardW - 10), padX, textY);
        textY += 6;

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.muted);
        const meta = [credit.year, credit.platform].filter(Boolean).join(' · ');
        if (meta) doc.text(meta, padX, textY);

        if (credit.credit_category) {
          const pillY = cy + cardH - 10;
          doc.setFontSize(5.5);
          const catText = credit.credit_category.toUpperCase();
          const catTw = doc.getTextWidth(catText);
          doc.setFillColor(...C.surface);
          doc.roundedRect(padX, pillY - 3, catTw + 6, 5.5, 2, 2, 'F');
          doc.setTextColor(...catColor);
          doc.text(catText, padX + 3, pillY);
        }
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // SLIDE: AWARDS & PRESS
  // ════════════════════════════════════════════════════════════
  if (awards.length > 0 || pressLinks.length > 0) {
    newPage();

    if (awards.length > 0) {
      const ax = MARGIN;
      drawEyebrow('Recognition', ax, 24);
      drawSectionHeadline('Awards', ax, 34);
      let ay = 42;

      awards.slice(0, 6).forEach((award) => {
        drawCard(ax, ay, CONTENT_W / 2 - 10, 18, 3);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.gold);
        doc.text(truncateText(doc, award.title, CONTENT_W / 2 - 25), ax + 5, ay + 7.5);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.muted);
        const awardMeta = [award.organization, award.year, award.category].filter(Boolean).join(' · ');
        doc.text(truncateText(doc, awardMeta, CONTENT_W / 2 - 25), ax + 5, ay + 13.5);
        ay += 22;
      });
    }

    if (pressLinks.length > 0) {
      const px = PAGE_W / 2 + 10;
      drawEyebrow('Coverage', px, 24);
      drawSectionHeadline('Featured In', px, 34);
      let py = 42;

      pressLinks.slice(0, 6).forEach((press) => {
        drawCard(px, py, CONTENT_W / 2 - 10, 18, 3);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.white);
        doc.text(truncateText(doc, decodeHtml(press.title), CONTENT_W / 2 - 25), px + 5, py + 7.5);
        if (press.publication) {
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...C.muted);
          doc.text(press.publication, px + 5, py + 13.5);
        }
        if (press.url) doc.link(px, py, CONTENT_W / 2 - 10, 18, { url: press.url });
        py += 22;
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // SLIDE: TESTIMONIALS
  // ════════════════════════════════════════════════════════════
  if (reviews.length > 0) {
    newPage();
    drawEyebrow('Word of Mouth', MARGIN, 24);
    drawSectionHeadline('Client Testimonials', MARGIN, 34);

    const reviewCards = reviews.slice(0, 4);
    const cardW = (CONTENT_W - 8) / 2;
    const reviewCardH = 56;

    reviewCards.forEach((review, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rx = MARGIN + col * (cardW + 8);
      const ry = 42 + row * (reviewCardH + 8);

      drawCard(rx, ry, cardW, reviewCardH, 4);

      drawStarRating(review.rating, rx + 8, ry + 8, 2.1);

      if (review.reviewer_name) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.primary);
        doc.text(review.reviewer_name, rx + 8, ry + 18);
      }

      if (review.review_text) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...C.light);
        const rLines = doc.splitTextToSize(`"${review.review_text}"`, cardW - 16);
        doc.text(rLines.slice(0, 5), rx + 8, ry + 26);
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  // SLIDE: CREDENTIALS & STATS
  // ════════════════════════════════════════════════════════════
  if (industryStats.length > 0) {
    newPage();
    drawEyebrow('Credentials', MARGIN, 24);
    drawSectionHeadline('Credentials & Industry Stats', MARGIN, 34);

    const statCards = industryStats.slice(0, 8);
    const statCardW = (CONTENT_W - 8 * 3) / 4;
    const statCardH = 35;

    statCards.forEach((stat, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const sx = MARGIN + col * (statCardW + 8);
      const sy = 42 + row * (statCardH + 8);

      drawCard(sx, sy, statCardW, statCardH, 4);

      if (stat.value) {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.primary);
        doc.text(stat.value, sx + statCardW / 2, sy + 14, { align: 'center' });
      }

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.light);
      const titleLines = doc.splitTextToSize(stat.title, statCardW - 8);
      doc.text(titleLines.slice(0, 2), sx + statCardW / 2, sy + 22, { align: 'center' });

      if (stat.issuer) {
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...C.muted);
        doc.text(truncateText(doc, stat.issuer, statCardW - 8), sx + statCardW / 2, sy + 29, { align: 'center' });
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  // FINAL SLIDE: Closing / Contact
  // ════════════════════════════════════════════════════════════
  newPage();

  doc.setGState(new doc.GState({ opacity: 0.10 }));
  doc.setFillColor(...C.primary);
  doc.circle(PAGE_W - 30, PAGE_H - 20, 100, 'F');
  doc.setGState(new doc.GState({ opacity: 1 }));

  drawLogoLockup(MARGIN, 12);

  const closeY = 66;
  doc.setFontSize(34);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text("Let's create", MARGIN, closeY);
  doc.setTextColor(...C.primary);
  doc.text('together.', MARGIN, closeY + 16);

  doc.setFillColor(...C.primary);
  doc.rect(MARGIN, closeY + 22, 26, 1, 'F');

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  doc.text('Reach out to collaborate on the next project.', MARGIN, closeY + 32);

  // EPK link as a clickable pill button
  const epkUrl = `https://kretopia.com/epk/${encodeURIComponent(profile.full_name?.toLowerCase().replace(/\s+/g, '-') || 'creator')}`;
  const btnW = 62;
  const btnH = 11;
  const btnX = MARGIN;
  const btnY = closeY + 42;
  doc.setFillColor(...C.primary);
  doc.roundedRect(btnX, btnY, btnW, btnH, 5, 5, 'F');
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.bg);
  doc.text('View Full Passport', btnX + btnW / 2, btnY + 7, { align: 'center' });
  doc.link(btnX, btnY, btnW, btnH, { url: epkUrl });

  // Contact card, bottom-right -- mirrors the reference deck's closing
  // "prepared by / contact" card.
  const cardW = 118;
  const cardH = 56;
  const cardX = PAGE_W - MARGIN - cardW;
  const cardY = PAGE_H - MARGIN - cardH;
  drawCard(cardX, cardY, cardW, cardH, 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.dimmed);
  doc.text('CONTACT', cardX + 8, cardY + 11);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.white);
  doc.text(profile.full_name || '', cardX + 8, cardY + 21);

  const ctaRole = profile.job_title || profile.role || '';
  if (ctaRole) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.primary);
    doc.text(ctaRole, cardX + 8, cardY + 28);
  }

  const ctaLinks: string[] = [];
  if (profile.website) ctaLinks.push(profile.website);
  if (profile.calendly_url) ctaLinks.push(profile.calendly_url);
  if (profile.linkedin_url) ctaLinks.push(profile.linkedin_url);

  let ctaLinkY = cardY + 37;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.muted);
  ctaLinks.slice(0, 3).forEach((link) => {
    doc.text(truncateText(doc, link, cardW - 16), cardX + 8, ctaLinkY);
    doc.link(cardX, ctaLinkY - 3, cardW, 5, { url: link });
    ctaLinkY += 6;
  });

  // ════════════════════════════════════════════════════════════
  // FOOTERS — Apply to all pages
  // ════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (brandingOptions?.logoUrl) {
      try {
        const logoData = await loadImageAsDataUrl(brandingOptions.logoUrl);
        if (logoData) doc.addImage(logoData, 'PNG', PAGE_W - MARGIN - 10, PAGE_H - 9, 8, 8);
      } catch { /* creator-supplied logo is optional; skip silently on failure */ }
    }

    drawFooter(i, totalPages);
  }

  // Save
  const safeName = (profile.full_name || 'creator').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${safeName}_EPK.pdf`);
}
