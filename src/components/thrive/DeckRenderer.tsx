import { DECK_THEMES, type DeckTheme } from "@/lib/deckThemes";
import ReactMarkdown from "react-markdown";

export type SlideLayout =
  | "standard"
  | "hero"
  | "stats"
  | "two_column"
  | "quote"
  | "pull_quote"
  | "testimonial"
  | "pricing"
  | "roll_call"
  | "team"
  | "timeline"
  | "process"
  | "financial"
  | "chart"
  | "gallery"
  | "letterhead_cover"
  | "letterhead_body";

export interface DeckStat { value: string; label: string; sub?: string }
export interface DeckColumn { heading: string; body?: string; bullets?: string[] }
export interface DeckQuote { text: string; attribution?: string; role?: string; avatar_url?: string }
export interface DeckPackage { name: string; price: string; includes: string[]; highlighted?: boolean }
export interface DeckPerson { name: string; role: string; note?: string; avatar_url?: string }
export interface DeckTimelineItem { date: string; label: string; detail?: string }
export interface DeckProcessStep { step: string; label: string; detail?: string }
export interface DeckFinancialRow { label: string; values: string[]; emphasis?: boolean }
export interface DeckFinancial { columns: string[]; rows: DeckFinancialRow[]; summary?: string }
export interface DeckChartDatum { label: string; value: number; color?: string }
export interface DeckChart { type: "bar" | "donut" | "line"; data: DeckChartDatum[]; caption?: string }
export interface DeckGalleryItem { image_ref?: string; image_prompt?: string; caption?: string }

export interface DeckSlide {
  heading: string;
  eyebrow?: string;
  body?: string;
  bullets?: string[];
  image_prompt?: string;
  image_ref?: string;
  callout?: string;
  layout?: SlideLayout;
  stats?: DeckStat[];
  columns?: DeckColumn[];
  quote?: DeckQuote;
  pricing?: DeckPackage[];
  roll_call?: DeckPerson[];
  team?: DeckPerson[];
  timeline?: DeckTimelineItem[];
  process?: DeckProcessStep[];
  financial?: DeckFinancial;
  chart?: DeckChart;
  gallery?: DeckGalleryItem[];
  recipient?: { name?: string; org?: string; address?: string; date?: string; subject?: string };
}

export interface DeckBrandSnapshot {
  name?: string;
  tagline?: string | null;
  logo_url?: string | null;
  palette?: string[];
  fonts?: { heading?: string; body?: string };
}

export interface DeckDesignQuality {
  visual_hierarchy: number;
  storytelling: number;
  brand_alignment: number;
  image_use: number;
  overall: number;
  notes?: string;
}

export interface DeckContent {
  title: string;
  subtitle?: string;
  strategy_summary?: string;
  design_style?: string;
  cover_prompt?: string;
  cover_image_ref?: string;
  slides: DeckSlide[];
  next_steps?: string[];
  brand_snapshot?: DeckBrandSnapshot;
  design_quality?: DeckDesignQuality;
}

interface Props {
  doc: DeckContent;
  theme: DeckTheme;
  coverImageUrl?: string | null;
  authorName?: string | null;
  showQualityBadge?: boolean;
}

export function DeckRenderer({ doc, theme, coverImageUrl, authorName, showQualityBadge = true }: Props) {
  const t = DECK_THEMES[theme] || DECK_THEMES.editorial;
  const brand = doc.brand_snapshot;
  const accent = brand?.palette?.[1] || brand?.palette?.[0] || null;
  const accentSecondary = brand?.palette?.[2] || brand?.palette?.[1] || null;
  const headingFont = brand?.fonts?.heading?.trim() || undefined;
  const bodyFont = brand?.fonts?.body?.trim() || undefined;
  const headingStyle = headingFont ? { fontFamily: headingFont } : undefined;
  const bodyStyle = bodyFont ? { fontFamily: bodyFont } : undefined;
  const accentStyle = accent ? { color: accent } : undefined;

  const coverSrc = doc.cover_image_ref || coverImageUrl;

  return (
    <div id="thrive-deck-root" className={`flex flex-col gap-6 ${t.font}`} style={bodyStyle}>
      {showQualityBadge && doc.design_quality && (
        <DesignQualityBadge q={doc.design_quality} style={doc.design_style} />
      )}

      {/* Cover */}
      <Slide className={`${t.page} ${t.cover}`} aspect>
        <div className="flex flex-col h-full justify-between relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={t.eyebrow}>{doc.subtitle || (brand?.name ? `Prepared by ${brand.name}` : "Prepared by Thrive")}</div>
              <h1 className={t.heading} style={headingStyle}>{doc.title}</h1>
              {brand?.tagline && (
                <p className="text-sm opacity-70 mt-2 italic">{brand.tagline}</p>
              )}
            </div>
            {brand?.logo_url && (
              <img src={brand.logo_url} alt={brand.name || "logo"} className="h-12 w-12 object-contain flex-shrink-0" />
            )}
          </div>
          {coverSrc && (
            <img src={coverSrc} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none -z-10" />
          )}
          <div className="text-xs opacity-60 mt-auto">{authorName || ""}</div>
        </div>
        {accent && (
          <div className="absolute bottom-0 left-0 right-0 h-2 flex">
            <div className="flex-1" style={{ backgroundColor: accent }} />
            {accentSecondary && <div className="flex-1" style={{ backgroundColor: accentSecondary }} />}
          </div>
        )}
      </Slide>

      {doc.slides.map((s, i) => (
        <Slide key={i} className={t.page} aspect>
          <SlideBody slide={s} theme={t} brand={brand} headingStyle={headingStyle} accent={accent} accentStyle={accentStyle} />

          <div className="mt-auto pt-6 flex items-center justify-between text-[10px] opacity-50 uppercase tracking-widest">
            <span className="flex items-center gap-2">
              {brand?.logo_url && <img src={brand.logo_url} alt="" className="h-3 w-3 object-contain opacity-80" />}
              {brand?.name || ""}
            </span>
            <span>{i + 1} / {doc.slides.length}</span>
          </div>
          {accent && (
            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: accent }} />
          )}
        </Slide>
      ))}
    </div>
  );
}

interface BodyProps {
  slide: DeckSlide;
  theme: typeof DECK_THEMES[DeckTheme];
  brand?: DeckBrandSnapshot;
  headingStyle?: React.CSSProperties;
  accent: string | null;
  accentStyle?: React.CSSProperties;
}

function SlideBody({ slide: s, theme: t, brand, headingStyle, accent, accentStyle }: BodyProps) {
  const layout = s.layout || "standard";

  const Header = (
    <>
      {s.eyebrow && <div className={t.eyebrow}>{s.eyebrow}</div>}
      <h2 className={t.heading} style={headingStyle}>{s.heading}</h2>
    </>
  );

  switch (layout) {
    case "hero":
      return (
        <div className="flex flex-col h-full">
          {Header}
          {s.image_ref ? (
            <div className="my-4 aspect-[16/9] rounded-md overflow-hidden">
              <img src={s.image_ref} alt="" className="w-full h-full object-cover" />
            </div>
          ) : s.image_prompt ? (
            <div className="my-4 aspect-[16/9] bg-muted rounded-md overflow-hidden flex items-center justify-center text-[10px] uppercase tracking-widest opacity-40">
              Hero image
            </div>
          ) : null}
          {s.body && (
            <div className={`prose prose-sm dark:prose-invert max-w-none ${t.body}`}>
              <ReactMarkdown>{s.body}</ReactMarkdown>
            </div>
          )}
          {s.callout && <div className={`mt-6 ${t.callout}`}>{s.callout}</div>}
        </div>
      );

    case "stats": {
      const stats = s.stats || [];
      return (
        <div>
          {Header}
          {s.body && (
            <div className={`prose prose-sm dark:prose-invert max-w-none mb-6 ${t.body}`}>
              <ReactMarkdown>{s.body}</ReactMarkdown>
            </div>
          )}
          <div className={`grid gap-4 ${stats.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {stats.map((st, i) => (
              <div key={i} className={`p-5 rounded-md border ${t.divider}`}>
                <div className="text-4xl md:text-5xl font-bold tracking-tight" style={accentStyle}>{st.value}</div>
                <div className="text-sm font-semibold mt-1">{st.label}</div>
                {st.sub && <div className="text-xs opacity-60 mt-1">{st.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "two_column": {
      const cols = s.columns || [];
      return (
        <div>
          {Header}
          <div className="grid md:grid-cols-2 gap-6 mt-2">
            {cols.map((c, i) => (
              <div key={i}>
                <h3 className="font-semibold text-base mb-2" style={accentStyle}>{c.heading}</h3>
                {c.body && (
                  <div className={`prose prose-sm dark:prose-invert max-w-none ${t.body}`}>
                    <ReactMarkdown>{c.body}</ReactMarkdown>
                  </div>
                )}
                {c.bullets && (
                  <ul className="mt-2 space-y-1.5">
                    {c.bullets.map((b, j) => (
                      <li key={j} className={`flex gap-2 ${t.bullet}`}><span style={accentStyle}>—</span><span>{b}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "quote":
    case "pull_quote": {
      const q = s.quote;
      return (
        <div className="flex flex-col h-full justify-center items-start">
          {s.eyebrow && <div className={t.eyebrow}>{s.eyebrow}</div>}
          <blockquote className="font-serif text-3xl md:text-5xl leading-snug italic max-w-3xl">
            <span className="text-6xl leading-none mr-2 align-top" style={accentStyle}>“</span>
            {q?.text || s.heading}
          </blockquote>
          {q?.attribution && (
            <div className="mt-6 text-sm uppercase tracking-[0.2em] opacity-70">— {q.attribution}{q.role ? `, ${q.role}` : ""}</div>
          )}
        </div>
      );
    }

    case "testimonial": {
      const q = s.quote;
      return (
        <div className="flex flex-col h-full justify-center items-start">
          {Header}
          <blockquote className="font-serif text-2xl md:text-3xl leading-snug italic max-w-3xl mt-4">
            <span className="text-5xl leading-none mr-2 align-top" style={accentStyle}>“</span>
            {q?.text || ""}
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            {q?.avatar_url && (
              <img src={q.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover border" />
            )}
            <div>
              {q?.attribution && <div className="font-semibold">{q.attribution}</div>}
              {q?.role && <div className="text-xs uppercase tracking-widest opacity-60">{q.role}</div>}
            </div>
          </div>
        </div>
      );
    }

    case "pricing": {
      const pkgs = s.pricing || [];
      return (
        <div>
          {Header}
          <div className={`grid gap-4 mt-2 ${pkgs.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {pkgs.map((p, i) => (
              <div
                key={i}
                className={`p-5 rounded-md border flex flex-col ${p.highlighted ? "border-2 shadow-md" : ""} ${t.divider}`}
                style={p.highlighted && accent ? { borderColor: accent } : undefined}
              >
                <div className="text-xs uppercase tracking-widest opacity-60">{p.name}</div>
                <div className="text-3xl font-bold mt-2 tracking-tight" style={accentStyle}>{p.price}</div>
                <ul className="mt-4 space-y-1.5 flex-1">
                  {p.includes.map((inc, j) => (
                    <li key={j} className={`text-sm flex gap-2 ${t.bullet}`}><span style={accentStyle}>✓</span><span>{inc}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "roll_call": {
      const people = s.roll_call || [];
      return (
        <div>
          {Header}
          <div className="grid md:grid-cols-2 gap-3 mt-2">
            {people.map((p, i) => (
              <div key={i} className={`flex items-baseline gap-3 py-2 border-b ${t.divider}`}>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs uppercase tracking-widest opacity-60">{p.role}</div>
                {p.note && <div className="text-xs opacity-70 ml-auto">{p.note}</div>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "team": {
      const people = s.team || [];
      const cols = people.length >= 4 ? "md:grid-cols-4" : people.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
      return (
        <div>
          {Header}
          <div className={`grid grid-cols-2 ${cols} gap-5 mt-4`}>
            {people.map((p, i) => (
              <div key={i} className="flex flex-col items-start">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} className="h-20 w-20 rounded-full object-cover mb-2 border" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted mb-2 flex items-center justify-center text-lg font-semibold" style={accentStyle}>
                    {p.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                  </div>
                )}
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs uppercase tracking-widest opacity-60">{p.role}</div>
                {p.note && <div className="text-xs opacity-70 mt-1">{p.note}</div>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "timeline": {
      const items = s.timeline || [];
      return (
        <div>
          {Header}
          <ol className="mt-4 relative border-l-2 pl-6 space-y-5" style={accent ? { borderColor: accent } : undefined}>
            {items.map((it, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-background"
                  style={{ backgroundColor: accent || "currentColor" }}
                />
                <div className="text-xs uppercase tracking-widest opacity-60">{it.date}</div>
                <div className="font-semibold text-base">{it.label}</div>
                {it.detail && <div className={`text-sm opacity-80 mt-1 ${t.body}`}>{it.detail}</div>}
              </li>
            ))}
          </ol>
        </div>
      );
    }

    case "process": {
      const steps = s.process || [];
      return (
        <div>
          {Header}
          <div className="grid gap-4 mt-4 md:grid-cols-2">
            {steps.map((st, i) => (
              <div key={i} className={`flex gap-4 p-4 rounded-md border ${t.divider}`}>
                <div className="text-3xl font-bold tracking-tight leading-none" style={accentStyle}>{st.step}</div>
                <div>
                  <div className="font-semibold">{st.label}</div>
                  {st.detail && <div className="text-sm opacity-80 mt-1">{st.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "financial": {
      const f = s.financial;
      if (!f) return null;
      return (
        <div>
          {Header}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className={`border-b-2 ${t.divider}`}>
                  <th className="text-left py-2 pr-4 text-xs uppercase tracking-widest opacity-60 font-semibold"></th>
                  {f.columns.map((c, i) => (
                    <th key={i} className="text-right py-2 px-3 text-xs uppercase tracking-widest opacity-60 font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {f.rows.map((r, i) => (
                  <tr key={i} className={`border-b ${t.divider} ${r.emphasis ? "font-bold" : ""}`}>
                    <td className="py-2 pr-4">{r.label}</td>
                    {r.values.map((v, j) => (
                      <td key={j} className="text-right py-2 px-3 tabular-nums" style={r.emphasis ? accentStyle : undefined}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {f.summary && <div className={`mt-4 ${t.callout}`}>{f.summary}</div>}
        </div>
      );
    }

    case "chart":
      return (
        <div>
          {Header}
          {s.chart && <ChartView chart={s.chart} accent={accent} />}
        </div>
      );

    case "gallery": {
      const items = s.gallery || [];
      const cols = items.length >= 4 ? "md:grid-cols-3" : "md:grid-cols-2";
      return (
        <div>
          {Header}
          <div className={`grid grid-cols-2 ${cols} gap-3 mt-4`}>
            {items.map((g, i) => (
              <figure key={i} className="flex flex-col">
                {g.image_ref ? (
                  <img src={g.image_ref} alt={g.caption || ""} className="aspect-[4/3] object-cover rounded-md w-full" />
                ) : (
                  <div className="aspect-[4/3] bg-muted rounded-md flex items-center justify-center text-[10px] uppercase tracking-widest opacity-40">
                    {g.image_prompt ? "Generated" : "Image"}
                  </div>
                )}
                {g.caption && <figcaption className="text-[11px] opacity-70 mt-1.5">{g.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      );
    }

    case "letterhead_cover": {
      const r = s.recipient || {};
      return (
        <div className="flex flex-col h-full">
          {brand?.logo_url && (
            <div className="flex items-center gap-3 pb-6 border-b border-border">
              <img src={brand.logo_url} alt="" className="h-10 w-10 object-contain" />
              <div>
                <div className="font-semibold">{brand?.name}</div>
                {brand?.tagline && <div className="text-xs opacity-60">{brand.tagline}</div>}
              </div>
            </div>
          )}
          <div className="mt-10 space-y-1 text-sm">
            {r.date && <div className="opacity-70">{r.date}</div>}
            {r.name && <div className="font-semibold pt-4">{r.name}</div>}
            {r.org && <div>{r.org}</div>}
            {r.address && <div className="whitespace-pre-line opacity-80">{r.address}</div>}
          </div>
          {(r.subject || s.heading) && (
            <div className="mt-10 font-semibold">
              <span className="uppercase tracking-widest text-xs opacity-60 mr-2">Re:</span>
              {r.subject || s.heading}
            </div>
          )}
        </div>
      );
    }

    case "letterhead_body":
      return (
        <div>
          {Header}
          {s.body && (
            <div className={`prose prose-base dark:prose-invert max-w-none ${t.body}`}>
              <ReactMarkdown>{s.body}</ReactMarkdown>
            </div>
          )}
          {s.callout && <div className={`mt-6 ${t.callout}`}>{s.callout}</div>}
        </div>
      );

    case "standard":
    default:
      return (
        <>
          {Header}
          {s.image_ref && (
            <div className="my-4 aspect-[16/9] rounded-md overflow-hidden">
              <img src={s.image_ref} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {s.body && (
            <div className={`prose prose-sm dark:prose-invert max-w-none ${t.body}`}>
              <ReactMarkdown>{s.body}</ReactMarkdown>
            </div>
          )}
          {s.bullets && s.bullets.length > 0 && (
            <ul className="mt-4 space-y-2">
              {s.bullets.map((b, j) => (
                <li key={j} className={`flex gap-3 ${t.bullet}`}>
                  <span className="opacity-50 mt-1" style={accent ? { color: accent, opacity: 1 } : undefined}>—</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {s.callout && <div className={`mt-6 ${t.callout}`}>{s.callout}</div>}
        </>
      );
  }
}

// ── Chart (lightweight SVG, no extra deps) ─────────────────────────────────
function ChartView({ chart, accent }: { chart: DeckChart; accent: string | null }) {
  const fill = (c?: string) => c || accent || "currentColor";
  const max = Math.max(...chart.data.map(d => d.value), 1);
  const total = chart.data.reduce((s, d) => s + d.value, 0) || 1;

  if (chart.type === "bar") {
    return (
      <div className="mt-4">
        <div className="space-y-2.5">
          {chart.data.map((d, i) => {
            const pct = (d.value / max) * 100;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 text-sm opacity-80 truncate">{d.label}</div>
                <div className="flex-1 h-7 bg-muted/60 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm flex items-center justify-end pr-2 text-[11px] font-semibold text-background"
                       style={{ width: `${pct}%`, backgroundColor: fill(d.color), minWidth: 24 }}>
                    {d.value.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {chart.caption && <div className="mt-3 text-xs opacity-60 italic">{chart.caption}</div>}
      </div>
    );
  }

  if (chart.type === "donut") {
    const size = 220, stroke = 36, r = (size - stroke) / 2, C = 2 * Math.PI * r;
    let offset = 0;
    return (
      <div className="mt-4 flex flex-col md:flex-row items-center gap-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" opacity={0.1} strokeWidth={stroke} />
          {chart.data.map((d, i) => {
            const len = (d.value / total) * C;
            const el = (
              <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
                stroke={fill(d.color)} strokeWidth={stroke}
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                transform={`rotate(-90 ${size/2} ${size/2})`} />
            );
            offset += len;
            return el;
          })}
        </svg>
        <ul className="space-y-1.5 text-sm">
          {chart.data.map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: fill(d.color) }} />
              <span className="opacity-80">{d.label}</span>
              <span className="opacity-60 ml-1 tabular-nums">— {Math.round((d.value/total)*100)}%</span>
            </li>
          ))}
        </ul>
        {chart.caption && <div className="text-xs opacity-60 italic">{chart.caption}</div>}
      </div>
    );
  }

  // line
  const w = 600, h = 220, pad = 28;
  const xs = chart.data.length > 1 ? chart.data.length - 1 : 1;
  const pts = chart.data.map((d, i) => {
    const x = pad + (i / xs) * (w - pad * 2);
    const y = h - pad - (d.value / max) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        <path d={path} fill="none" stroke={fill()} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={4} fill={fill(chart.data[i].color)} />
        ))}
        {chart.data.map((d, i) => (
          <text key={i} x={pad + (i/xs) * (w - pad*2)} y={h - 6} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>{d.label}</text>
        ))}
      </svg>
      {chart.caption && <div className="mt-2 text-xs opacity-60 italic">{chart.caption}</div>}
    </div>
  );
}

// ── Quality badge — visible only in the editor, hide on export ─────────────
function DesignQualityBadge({ q, style }: { q: DeckDesignQuality; style?: string }) {
  const grade = q.overall >= 9 ? "A+" : q.overall >= 8 ? "A" : q.overall >= 7 ? "B" : q.overall >= 6 ? "C" : "D";
  const tone = q.overall >= 8 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
             : q.overall >= 6 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
             : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30";
  return (
    <div data-export-hidden className={`rounded-lg border px-4 py-3 text-xs flex flex-wrap items-center gap-3 ${tone}`}>
      <span className="text-base font-bold tracking-tight">{grade}</span>
      <span className="font-semibold">Design quality {q.overall.toFixed(1)}/10</span>
      <span className="opacity-70">Hierarchy {q.visual_hierarchy} · Story {q.storytelling} · Brand {q.brand_alignment} · Image {q.image_use}</span>
      {style && <span className="ml-auto uppercase tracking-widest opacity-70">Style: {style}</span>}
      {q.notes && <p className="basis-full opacity-80 mt-1">{q.notes}</p>}
    </div>
  );
}

function Slide({ children, className, aspect }: { children: React.ReactNode; className?: string; aspect?: boolean }) {
  return (
    <div
      className={`relative w-full p-8 md:p-12 flex flex-col ${aspect ? "min-h-[80vh] md:min-h-[600px]" : ""} ${className || ""}`}
      style={{ pageBreakAfter: "always" }}
    >
      {children}
    </div>
  );
}
