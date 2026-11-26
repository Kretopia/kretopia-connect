import { memo, useMemo } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Briefcase, User, Wand2 } from "lucide-react";

import cloudsUrl from "@/assets/brand/universe/planet-clouds.webp";

/**
 * The hero's dark planet: Kretopia at dusk. A huge, near-black sphere rises along the bottom of the hero; only its top limb shows,
 * lit from behind by an atmosphere that runs through the logo's own gradient (blue, violet, magenta, orange). Thin cloud bands drift
 * across its surface, a low sun glints along the rim, three small satellites (a person, a skill, an opportunity) travel on an orbit
 * above it, and now and then a shooting star crosses the sky. Kreto stands on its limb.
 *
 * Decorative only (the hero puts it in an aria-hidden layer). It is built to be cheap: the sphere, rim and glow are CSS gradients
 * and shadows painted once; everything that moves is a transform or an opacity change on the compositor; the one image is a small
 * tileable cloud texture (~75 KB, lazy, decoded off the main thread). Colours are the app's tokens and the logo gradient, with a
 * pale-lavender body in Daylight. Under prefers-reduced-motion the scene is drawn once and nothing moves: no rise, no drift, no
 * glint, no orbit, no twinkle, no shooting star, no parallax.
 *
 * Size is by the planet's rise (how much of the limb shows) and its diameter in viewport widths, so the curve is gentle on a
 * desktop and tighter on a phone, and nothing depends on measuring.
 */

const STAR_FIELD = { w: 1200, h: 700 } as const;

/** A fixed scatter of small stars (a seeded sequence, so the sky is the same on every render and every device). */
function makeStars(count: number) {
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(next() * STAR_FIELD.w),
    y: Math.round(next() * STAR_FIELD.h * 0.8),
    r: 0.6 + next() * 1.1,
    o: 0.25 + next() * 0.4,
    twinkle: i % 3 === 0,
    delay: (i * 0.9) % 7,
  }));
}

const SATELLITES = [
  // Kept to the two sides of the planet, clear of the column of text and cards in the middle.
  { id: "people", Icon: User, angle: -30, color: "var(--k-g-2)", sway: 4, seconds: 84 },
  { id: "skills", Icon: Wand2, angle: -24, color: "var(--k-g-3)", sway: 3, seconds: 96 },
  { id: "opportunities", Icon: Briefcase, angle: 31, color: "var(--k-g-4)", sway: 4, seconds: 78 },
] as const;

const CSS = `
.k-universe { --D: 134vw; --rise: 27vw; --gap: 5.5vw; --sat: 26px; }
@media (min-width: 640px) { .k-universe { --D: 176vw; --rise: 17vw; --gap: 3.6vw; --sat: 32px; } }

.k-universe .k-geo { position: absolute; left: 50%; top: calc(100% - var(--rise)); width: var(--D); height: var(--D); margin-left: calc(var(--D) / -2); border-radius: 9999px; }
.k-universe .k-rise { position: absolute; inset: 0; }
.k-universe[data-motion] .k-rise { animation: k-planet-rise 2.4s cubic-bezier(0.2, 0.65, 0.3, 0.95) both; }

/* Glow above the limb: the logo gradient laid along it, plus a stacked shadow that follows the curve. */
.k-universe .k-bloom { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--rise) * 2.1); opacity: 0.8; transition: opacity 0.6s ease;
  background: linear-gradient(90deg, rgba(64,18,248,0) 0%, rgba(64,18,248,0.42) 14%, rgba(165,22,197,0.4) 36%, rgba(246,36,137,0.5) 54%, rgba(255,167,34,0.44) 86%, rgba(255,167,34,0) 100%);
  -webkit-mask-image: radial-gradient(62% 100% at 50% 100%, #000 0%, transparent 74%); mask-image: radial-gradient(62% 100% at 50% 100%, #000 0%, transparent 74%); }
.k-universe[data-energized] .k-bloom { opacity: 1; }
.k-universe .k-halo { box-shadow: 0 -2px 18px 1px rgba(246,36,137,0.42), 0 -10px 52px 8px rgba(165,22,197,0.34), 0 -34px 130px 26px rgba(64,18,248,0.24); }
.k-universe[data-motion] .k-halo { animation: k-breathe 9s ease-in-out infinite; }

.k-universe .k-planet { overflow: hidden; isolation: isolate;
  background:
    radial-gradient(46% 7% at 50% 0%, rgba(246,36,137,0.30), transparent 100%),
    radial-gradient(100% 100% at 50% 0%, #1a1038 0%, #0b0719 30%, #04030a 66%); }
.k-universe .k-shade { position: absolute; inset: 0; border-radius: inherit;
  background:
    radial-gradient(closest-side at 50% 0%, transparent 62%, rgba(0,0,0,0.55) 100%),
    linear-gradient(180deg, transparent 0%, rgba(2,1,6,0.5) 24%, rgba(2,1,6,0.92) 52%); }
.k-universe .k-clouds { position: absolute; left: calc(50% - 50vw); top: 0; width: 100vw; height: calc(var(--rise) * 1.7); overflow: hidden; opacity: 0.8;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 100%); mask-image: linear-gradient(180deg, #000 0%, transparent 100%); }
.k-universe .k-clouds-track { position: absolute; left: 0; top: 0; width: 200vw; height: 100%; background-repeat: repeat-x; background-size: 100vw 100%; }
.k-universe[data-motion] .k-clouds-track { animation: k-drift 220s linear infinite; }

.k-universe .k-rim { position: absolute; inset: 0; border-radius: inherit;
  background: conic-gradient(from -40deg at 50% 50%, transparent 0deg, var(--k-g-1) 4deg, var(--k-g-2) 24deg, var(--k-g-3) 44deg, var(--k-g-4) 70deg, var(--k-g-4) 78deg, transparent 86deg 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); }
.k-universe .k-rim-soft { position: absolute; inset: 0; border-radius: inherit; opacity: 0.4;
  background: conic-gradient(from -40deg at 50% 50%, transparent 0deg, var(--k-g-1) 4deg, var(--k-g-2) 24deg, var(--k-g-3) 44deg, var(--k-g-4) 70deg, var(--k-g-4) 78deg, transparent 86deg 360deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 2px)); mask: radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 2px)); }

/* A low sun, gliding along the rim: an arm swings about the planet's centre and carries a glint at its top. */
.k-universe .k-arm { position: absolute; inset: 0; transform: rotate(var(--a, 0deg)); transform-origin: 50% 50%; }
.k-universe[data-motion] .k-arm[data-sway] { animation: k-sway var(--s, 80s) ease-in-out infinite alternate; }
.k-universe .k-glint { position: absolute; left: 50%; top: 0; width: 24vw; height: 4.6vw; transform: translate(-50%, -50%); mix-blend-mode: screen;
  background: radial-gradient(closest-side, rgba(255,214,150,0.95), rgba(255,150,70,0.5) 38%, transparent 100%); }

.k-universe .k-orbit { border: 1px dashed hsl(var(--foreground) / 0.16); }
.k-universe .k-sat { position: absolute; left: 50%; top: 0; width: var(--sat); height: var(--sat); transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; border-radius: 9999px;
  background: hsl(var(--card) / 0.7); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); color: hsl(var(--foreground) / 0.85);
  box-shadow: 0 0 18px color-mix(in srgb, var(--c) 45%, transparent); }
@media (max-width: 639px) { .k-universe .k-sat { display: none; } }

.k-universe .k-shoot { position: absolute; top: 12%; left: 6%; width: 120px; height: 1.5px; opacity: 0; transform: rotate(24deg); background: linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.9)); }
.k-universe[data-motion] .k-shoot { animation: k-shoot 18s linear 5s infinite; }

/* Daylight: the same planet by day, a pale lavender body with the same rim. */
:root:not(.dark) .k-universe .k-planet { background: radial-gradient(46% 7% at 50% 0%, rgba(246,36,137,0.22), transparent 100%), radial-gradient(100% 100% at 50% 0%, #f4efff 0%, #ddd3f5 32%, #c7bbeb 70%); }
:root:not(.dark) .k-universe .k-shade { background: radial-gradient(closest-side at 50% 0%, transparent 62%, rgba(110,90,170,0.28) 100%), linear-gradient(180deg, transparent 0%, rgba(120,100,180,0.16) 30%, rgba(110,90,170,0.34) 60%); }
:root:not(.dark) .k-universe .k-clouds { opacity: 0.35; mix-blend-mode: multiply; }
:root:not(.dark) .k-universe .k-bloom { opacity: 0.55; }
:root:not(.dark) .k-universe[data-energized] .k-bloom { opacity: 0.8; }
:root:not(.dark) .k-universe .k-halo { box-shadow: 0 -2px 18px 1px rgba(246,36,137,0.3), 0 -10px 52px 8px rgba(165,22,197,0.22), 0 -34px 130px 26px rgba(64,18,248,0.14); }
:root:not(.dark) .k-universe .k-glint { mix-blend-mode: normal; opacity: 0.7; }

@keyframes k-planet-rise { from { transform: translateY(20%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes k-breathe { 0%, 100% { opacity: 0.82; } 50% { opacity: 1; } }
@keyframes k-drift { to { transform: translateX(-100vw); } }
@keyframes k-sway { from { transform: rotate(calc(var(--a, 0deg) - var(--w, 8deg))); } to { transform: rotate(calc(var(--a, 0deg) + var(--w, 8deg))); } }
@keyframes k-star { 0%, 100% { opacity: var(--o); } 50% { opacity: calc(var(--o) * 0.25); } }
@keyframes k-shoot {
  0% { opacity: 0; transform: translate(0, 0) rotate(24deg); }
  1.5% { opacity: 1; }
  5% { opacity: 0; transform: translate(46vw, 21vw) rotate(24deg); }
  100% { opacity: 0; transform: translate(46vw, 21vw) rotate(24deg); }
}
@keyframes k-shimmer { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@media (prefers-reduced-motion: reduce) {
  .k-universe, .k-universe * { animation: none !important; }
}
`;

interface HeroUniverseProps {
  reducedMotion: boolean;
  /** The hero's smoothed pointer position, 0..1 across the section. */
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  /** A fine pointer is present (a mouse or trackpad): only then do the layers drift against it. */
  parallax: boolean;
  /** The search is in use: the glow along the limb rises a little. */
  energized?: boolean;
}

export const HeroUniverse = memo(function HeroUniverse({ reducedMotion, pointerX, pointerY, parallax, energized = false }: HeroUniverseProps) {
  const stars = useMemo(() => makeStars(34), []);
  const moving = !reducedMotion;
  const drift = moving && parallax;
  // Two depths: the stars barely move, the planet a little more.
  const starX = useTransform(pointerX, [0, 1], [-6, 6]);
  const starY = useTransform(pointerY, [0, 1], [-4, 4]);
  const planetX = useTransform(pointerX, [0, 1], [-14, 14]);
  const planetY = useTransform(pointerY, [0, 1], [-5, 5]);
  const still = { x: 0, y: 0 };
  /** Marks a layer that loops; present only when motion is allowed, so a still sky has none. */
  const anim = moving ? { "data-anim": "" } : {};

  return (
    <div data-universe className="k-universe absolute inset-0 overflow-hidden" data-motion={moving ? "" : undefined} data-energized={energized ? "" : undefined}>
      <style>{CSS}</style>

      <motion.div className="absolute inset-0" style={drift ? { x: starX, y: starY } : still}>
        <svg viewBox={`0 0 ${STAR_FIELD.w} ${STAR_FIELD.h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" focusable="false">
          {stars.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              {...(s.twinkle ? anim : {})}
              style={{
                fill: "hsl(var(--foreground))",
                opacity: s.o,
                ["--o" as string]: s.o,
                animation: moving && s.twinkle ? `k-star ${5 + (i % 5)}s ease-in-out ${s.delay}s infinite` : undefined,
              }}
            />
          ))}
        </svg>
      </motion.div>

      {moving ? <span data-anim className="k-shoot" /> : null}

      <motion.div className="absolute inset-0" style={drift ? { x: planetX, y: planetY } : still}>
        <div className="k-rise" {...anim}>
          <div className="k-bloom" />
          <div className="k-geo k-halo" {...anim} />

          {/* The orbit above the limb, with three satellites that travel along it. */}
          <div className="k-geo k-orbit" style={{ width: "calc(var(--D) + var(--gap) * 2)", height: "calc(var(--D) + var(--gap) * 2)", marginLeft: "calc((var(--D) + var(--gap) * 2) / -2)", top: "calc(100% - var(--rise) - var(--gap))" }}>
            {SATELLITES.map(({ id, Icon, angle, color, sway, seconds }) => (
              <div
                key={id}
                className="k-arm"
                {...(moving ? { "data-sway": "", "data-anim": "" } : {})}
                style={{ ["--a" as string]: `${angle}deg`, ["--w" as string]: `${sway}deg`, ["--s" as string]: `${seconds}s` }}
              >
                <span className="k-sat" style={{ ["--c" as string]: color }}>
                  <Icon className="h-[46%] w-[46%]" strokeWidth={1.8} />
                </span>
              </div>
            ))}
          </div>

          <div className="k-geo k-planet">
            <div className="k-clouds">
              <div className="k-clouds-track" {...anim} style={{ backgroundImage: `url(${cloudsUrl})` }} />
            </div>
            <div className="k-shade" />
            <div className="k-rim-soft" />
            <div className="k-rim" />
          </div>

          {/* The low sun gliding along the limb. */}
          <div className="k-geo" style={{ pointerEvents: "none" }}>
            <div className="k-arm" {...(moving ? { "data-sway": "", "data-anim": "" } : {})} style={{ ["--a" as string]: "-14deg", ["--w" as string]: "20deg", ["--s" as string]: "46s" }}>
              <span className="k-glint" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export default HeroUniverse;
