import { memo, useMemo } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";

/**
 * The hero's "Kreto Universe": a calm night sky with a few slow orbits and a small constellation of connection nodes (a person,
 * a skill, an opportunity), the quiet backdrop for Kreto exploring the creative economy. Decorative only (aria-hidden): the
 * hero's words and search carry the meaning.
 *
 * Restraint is the brief. It is one SVG, no canvas and no raster image, so there is nothing to download; every loop is a
 * transform or opacity animation on the compositor; the lines are hairlines at low alpha; and the colours are the app's own
 * tokens, so Daylight and Midnight both work. Under prefers-reduced-motion the scene is drawn once and nothing moves: no orbit,
 * no twinkle, no drawing line, no parallax.
 */

const VIEW = { w: 1200, h: 700 } as const;
const CENTER = { x: 600, y: 340 } as const;

type NodeKind = "people" | "skills" | "opportunities";
interface UniverseNode { id: string; x: number; y: number; kind: NodeKind; pulse?: boolean }

/** Around the edges, clear of the headline and the search, which sit in the middle. */
const NODES: readonly UniverseNode[] = [
  { id: "a", x: 130, y: 210, kind: "people", pulse: true },
  { id: "b", x: 250, y: 450, kind: "skills" },
  { id: "c", x: 95, y: 560, kind: "opportunities" },
  { id: "d", x: 1075, y: 190, kind: "opportunities", pulse: true },
  { id: "e", x: 985, y: 420, kind: "people" },
  { id: "f", x: 1115, y: 545, kind: "skills" },
  { id: "g", x: 430, y: 78, kind: "skills" },
  { id: "h", x: 790, y: 62, kind: "people", pulse: true },
];
const LINKS: ReadonlyArray<readonly [string, string, boolean?]> = [
  ["a", "b"], ["b", "c"], ["a", "g", true], ["g", "h"], ["h", "d", true], ["d", "e"], ["e", "f", true], ["b", "g"],
];
const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));

/** A fixed scatter of small stars (a seeded sequence, so the sky is the same on every render and every device). */
function makeStars(count: number) {
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(next() * VIEW.w),
    y: Math.round(next() * VIEW.h),
    r: 0.6 + next() * 1.1,
    o: 0.22 + next() * 0.38,
    twinkle: i % 4 === 0,
    delay: (i * 0.9) % 7,
  }));
}

const fg = (alpha: number) => ({ stroke: `hsl(var(--foreground) / ${alpha})` });

/** One small glyph per kind, drawn in its own 16px box centred on the node. */
function Glyph({ kind }: { kind: NodeKind }) {
  const common = { fill: "none", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, style: fg(0.62) };
  if (kind === "people")
    return (
      <g>
        <circle cx={0} cy={-2.6} r={2.6} {...common} />
        <path d="M-5.6 6.4a5.6 5.6 0 0 1 11.2 0" {...common} />
      </g>
    );
  if (kind === "skills")
    return <path d="M0 -6.6 1.7 -1.7 6.6 0 1.7 1.7 0 6.6 -1.7 1.7 -6.6 0 -1.7 -1.7Z" {...common} />;
  return (
    <g>
      <rect x={-5.6} y={-3.2} width={11.2} height={8.2} rx={1.6} {...common} />
      <path d="M-2.6 -3.2v-2h5.2v2" {...common} />
    </g>
  );
}

const KEYFRAMES = `
@keyframes k-universe-spin { to { transform: rotate(360deg); } }
@keyframes k-universe-spin-back { to { transform: rotate(-360deg); } }
@keyframes k-universe-twinkle { 0%, 100% { opacity: var(--o); } 50% { opacity: calc(var(--o) * 0.25); } }
@keyframes k-universe-pulse { 0%, 100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(1.5); opacity: 0; } }
@keyframes k-universe-draw {
  0% { stroke-dashoffset: var(--len); opacity: 0; }
  12% { opacity: 0.7; }
  42% { stroke-dashoffset: 0; opacity: 0.7; }
  75% { stroke-dashoffset: 0; opacity: 0; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  [data-universe] [data-anim] { animation: none !important; }
}
`;

interface HeroUniverseProps {
  reducedMotion: boolean;
  /** The hero's smoothed pointer position, 0..1 across the section. */
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  /** A fine pointer is present (a mouse or trackpad): only then do the layers drift against it. */
  parallax: boolean;
}

export const HeroUniverse = memo(function HeroUniverse({ reducedMotion, pointerX, pointerY, parallax }: HeroUniverseProps) {
  const stars = useMemo(() => makeStars(30), []);
  const moving = !reducedMotion;
  /** Marks a layer that loops; present only when motion is allowed, so a still sky has none. */
  const anim = moving ? { "data-anim": "" } : {};
  const drift = moving && parallax;
  // Three depths: the stars barely move, the orbits a little, the constellation the most.
  const starX = useTransform(pointerX, [0, 1], [-5, 5]);
  const starY = useTransform(pointerY, [0, 1], [-3, 3]);
  const orbitX = useTransform(pointerX, [0, 1], [-10, 10]);
  const orbitY = useTransform(pointerY, [0, 1], [-6, 6]);
  const netX = useTransform(pointerX, [0, 1], [-18, 18]);
  const netY = useTransform(pointerY, [0, 1], [-10, 10]);
  const still = { x: 0, y: 0 };
  const rotateAround = { transformOrigin: `${CENTER.x}px ${CENTER.y}px`, transformBox: "view-box" as const };

  return (
    <div data-universe className="absolute inset-0 overflow-hidden">
      <style>{KEYFRAMES}</style>
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        focusable="false"
      >
        <defs>
          <linearGradient id="k-universe-orbit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--k-g-1)" }} />
            <stop offset="40%" style={{ stopColor: "var(--k-g-2)" }} />
            <stop offset="75%" style={{ stopColor: "var(--k-g-3)" }} />
            <stop offset="100%" style={{ stopColor: "var(--k-g-4)" }} />
          </linearGradient>
        </defs>

        {/* Stars: a few twinkle, the rest hold still. */}
        <motion.g style={drift ? { x: starX, y: starY } : still}>
          {stars.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              style={{ fill: "hsl(var(--foreground))", opacity: s.o, ["--o" as string]: s.o, animation: moving && s.twinkle ? `k-universe-twinkle ${5 + (i % 5)}s ease-in-out ${s.delay}s infinite` : undefined }}
              {...(s.twinkle ? anim : {})}
            />
          ))}
        </motion.g>

        {/* Orbits: three rings, very slowly turning, one with a faint trace of the Kretopia gradient. */}
        <motion.g style={drift ? { x: orbitX, y: orbitY } : still}>
          <g transform={`rotate(-14 ${CENTER.x} ${CENTER.y})`}>
            <g {...anim} style={{ ...rotateAround, animation: moving ? "k-universe-spin 260s linear infinite" : undefined }}>
              <ellipse cx={CENTER.x} cy={CENTER.y} rx={430} ry={150} fill="none" strokeWidth={1} style={fg(0.09)} />
              <ellipse cx={CENTER.x} cy={CENTER.y} rx={590} ry={225} fill="none" strokeWidth={1} stroke="url(#k-universe-orbit)" opacity={0.2} />
            </g>
            <g {...anim} style={{ ...rotateAround, animation: moving ? "k-universe-spin-back 360s linear infinite" : undefined }}>
              <ellipse cx={CENTER.x} cy={CENTER.y} rx={760} ry={300} fill="none" strokeWidth={1} strokeDasharray="2 12" style={fg(0.14)} />
            </g>
          </g>
        </motion.g>

        {/* Constellation: connection nodes and the hairlines between them; three lines draw themselves now and then. */}
        <motion.g style={drift ? { x: netX, y: netY } : still}>
          {LINKS.map(([from, to, draws], i) => {
            const a = NODE_BY_ID.get(from)!;
            const b = NODE_BY_ID.get(to)!;
            const len = Math.round(Math.hypot(b.x - a.x, b.y - a.y));
            return (
              <g key={`${from}-${to}`}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1} style={fg(0.1)} />
                {draws && moving ? (
                  <line
                    data-anim
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    strokeWidth={1.2}
                    strokeDasharray={len}
                    style={{ ...fg(0.5), ["--len" as string]: len, animation: `k-universe-draw 11s ease-in-out ${i * 2.3}s infinite` }}
                  />
                ) : null}
              </g>
            );
          })}
          {NODES.map((n) => (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`} className={n.id === "c" || n.id === "f" ? "hidden sm:inline" : undefined}>
              {n.pulse && moving ? (
                <circle
                  data-anim
                  r={14}
                  fill="none"
                  strokeWidth={1}
                  style={{ ...fg(0.35), transformBox: "fill-box", transformOrigin: "center", animation: "k-universe-pulse 6s ease-out infinite" }}
                />
              ) : null}
              <circle r={14} style={{ ...fg(0.2), fill: "hsl(var(--card) / 0.55)" }} strokeWidth={1} />
              <Glyph kind={n.kind} />
            </g>
          ))}
        </motion.g>
      </svg>
    </div>
  );
});

export default HeroUniverse;
