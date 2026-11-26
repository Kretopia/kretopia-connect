import { memo, useMemo } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";

import cloudsUrl from "@/assets/brand/universe/planet-clouds.webp";
import type { JourneyId } from "@/lib/heroJourneys";

/**
 * The hero's planet at dusk. A huge dark sphere rises along the bottom of the hero and only its top limb shows. Above the limb the
 * atmosphere is laid out the way a real twilight is: a hot band at the horizon, then the colour cools with height, and that
 * ramp is the Kretopia logo's own gradient read from the horizon up (orange #FFA722, magenta #F62489, violet #A516C5, blue
 * #4012F8). A low sun sits on the limb on the right and drifts slowly along it; the limb itself brightens softly towards the
 * sun (no hard outline), thin clouds drift over the surface, and on the dark side a few clusters of warm city lights show,
 * the network the product is about. Stars thin out towards the bright horizon, as they do.
 *
 * Decorative only (the hero puts it in an aria-hidden layer). It is cheap by construction: every gradient is painted once;
 * everything that moves is a transform or an opacity change on the compositor; the one image is a ~75 KB tileable cloud
 * texture. Motion is a short entrance (sky, planet, atmosphere, sun, lights in that order), then slow idle loops (sun drift,
 * breathing, clouds, lights, a rare shooting star), then response: a fine pointer parallaxes three depths, scrolling sinks the
 * planet slower than the page, using the search lifts the glow, and hovering one of the dock's journeys tints the horizon in
 * that journey's colour. Under prefers-reduced-motion the scene is drawn once and nothing moves.
 */

const STAR_FIELD = { w: 1200, h: 700 } as const;
const CITY_FIELD = { w: 1200, h: 280 } as const;

/** A tiny seeded generator, so the sky and the lights are the same on every render and every device. */
function seeded(start: number) {
  let seed = start;
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const STAR_TINTS = ["var(--k-g-1)", "var(--k-g-2)", "var(--k-g-3)"] as const;

function makeStars(count: number) {
  const next = seeded(7);
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(next() * STAR_FIELD.w),
    y: Math.round(next() * STAR_FIELD.h * 0.85),
    r: 0.55 + next() * 1.15,
    o: 0.22 + next() * 0.45,
    // One in five is faintly tinted with the logo's blue, violet or magenta; the rest are plain.
    tint: i % 5 === 0 ? STAR_TINTS[(i / 5) % STAR_TINTS.length | 0] : null,
    twinkle: i % 3 === 0,
    delay: (i * 0.9) % 7,
  }));
}

/** Clusters of lights on the dark side: towns, denser in the middle of each cluster, clear of the limb. */
function makeCities() {
  const next = seeded(23);
  const centres = [
    { x: 70, y: 150, n: 9 }, { x: 190, y: 105, n: 12 }, { x: 330, y: 175, n: 8 }, { x: 470, y: 205, n: 5 },
    { x: 650, y: 215, n: 4 }, { x: 790, y: 190, n: 6 }, { x: 905, y: 120, n: 13 }, { x: 1030, y: 160, n: 9 }, { x: 1140, y: 205, n: 6 },
  ];
  const dots: { x: number; y: number; r: number; o: number; hue: number; twinkle: boolean; delay: number }[] = [];
  centres.forEach((c, ci) => {
    for (let k = 0; k < c.n; k++) {
      // Sum of two draws: a soft bell around the centre instead of a flat disc.
      const dx = (next() + next() - 1) * 46;
      const dy = (next() + next() - 1) * 24;
      dots.push({ x: Math.round(c.x + dx), y: Math.round(c.y + dy), r: 0.7 + next() * 1.1, o: 0.35 + next() * 0.55, hue: next() < 0.78 ? 0 : 1, twinkle: (ci + k) % 4 === 0, delay: ((ci * 3 + k) * 0.7) % 6 });
    }
  });
  return dots;
}

const CSS = `
.k-universe { --D: 134vw; --rise: 34vw; --sun: 15deg; --sunw: 9deg; --tint: transparent; }
@media (min-width: 640px) { .k-universe { --D: 176vw; --rise: 18vw; --sun: 17deg; --sunw: 10deg; } }
.k-universe[data-tint="people"] { --tint: var(--k-g-2); }
.k-universe[data-tint="skills"] { --tint: var(--k-g-3); }
.k-universe[data-tint="opportunities"] { --tint: var(--k-g-4); }

/* The sky: night at the top, the logo's colours cooling upward from the horizon. */
.k-universe .k-sky { position: absolute; inset: 0;
  background:
    linear-gradient(180deg, rgba(64,18,248,0) 0%, rgba(64,18,248,0.10) 34%, rgba(165,22,197,0.12) 56%, rgba(246,36,137,0.12) 76%, rgba(255,167,34,0.14) 100%); }
.k-universe .k-stars { position: absolute; inset: 0;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 42%, transparent 86%); mask-image: linear-gradient(180deg, #000 0%, #000 42%, transparent 86%); }

/* Everything that belongs to the planet shares one centre. */
.k-universe .k-geo { position: absolute; left: 50%; top: calc(100% - var(--rise)); width: var(--D); height: var(--D); margin-left: calc(var(--D) / -2); border-radius: 9999px; }
.k-universe .k-rise { position: absolute; inset: 0; transition: transform 1.1s cubic-bezier(0.2, 0.65, 0.3, 0.95); }
.k-universe[data-energized] .k-rise { transform: translateY(-0.7vw); }

/* Atmosphere: colour by height (radial), strength by direction (a conic mask that turns with the sun). */
.k-universe .k-atm { --T: 22vw; width: calc(var(--D) + var(--T) * 2); height: calc(var(--D) + var(--T) * 2); margin-left: calc((var(--D) + var(--T) * 2) / -2); top: calc(100% - var(--rise) - var(--T));
  background: radial-gradient(closest-side,
    transparent calc(100% - var(--T) - 1px),
    rgba(255,214,150,0.95) calc(100% - var(--T)),
    rgba(255,167,34,0.78) calc(100% - var(--T) * 0.93),
    rgba(246,36,137,0.52) calc(100% - var(--T) * 0.80),
    rgba(165,22,197,0.34) calc(100% - var(--T) * 0.58),
    rgba(64,18,248,0.20) calc(100% - var(--T) * 0.28),
    transparent 100%);
  -webkit-mask-image: conic-gradient(from -75deg at 50% 50%, transparent 0deg, rgba(0,0,0,0.38) 26deg, rgba(0,0,0,0.62) 62deg, #000 96deg, #000 112deg, rgba(0,0,0,0.6) 134deg, transparent 168deg 360deg);
  mask-image: conic-gradient(from -75deg at 50% 50%, transparent 0deg, rgba(0,0,0,0.38) 26deg, rgba(0,0,0,0.62) 62deg, #000 96deg, #000 112deg, rgba(0,0,0,0.6) 134deg, transparent 168deg 360deg);
  transform: rotate(var(--a, 0deg)); opacity: 0.85; transition: opacity 0.8s ease; }
.k-universe .k-atm.k-atm-hot { --T: 5.5vw; opacity: 1;
  background: radial-gradient(closest-side,
    transparent calc(100% - var(--T) - 1px),
    rgba(255,226,180,0.9) calc(100% - var(--T)),
    rgba(255,167,34,0.7) calc(100% - var(--T) * 0.85),
    rgba(246,36,137,0.42) calc(100% - var(--T) * 0.5),
    rgba(165,22,197,0.12) calc(100% - var(--T) * 0.2),
    transparent 100%); }
.k-universe[data-energized] .k-atm { opacity: 1; }
.k-universe[data-motion] .k-atm { animation: k-ignite 2.8s cubic-bezier(0.2, 0.65, 0.3, 0.95) 0.5s backwards, k-sway var(--s, 70s) ease-in-out infinite alternate; }

/* The horizon takes the colour of the journey under the pointer. */
.k-universe .k-tint { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--rise) * 2.4); opacity: 0; transition: opacity 0.6s ease; mix-blend-mode: screen;
  background: radial-gradient(60% 100% at 50% 100%, color-mix(in srgb, var(--tint) 55%, transparent), transparent 72%); }
.k-universe[data-tint] .k-tint { opacity: 0.85; }

/* The body of the planet: near-black with a cold blue-violet cast, lit at the limb. */
.k-universe .k-planet { overflow: hidden; isolation: isolate;
  background: radial-gradient(closest-side, #020108 0%, #04030c 70%, #0a0620 100%); }
.k-universe .k-body { position: absolute; inset: 0; border-radius: inherit;
  background:
    radial-gradient(closest-side, transparent calc(100% - 9vw), rgba(64,18,248,0.20) calc(100% - 4.5vw), rgba(165,22,197,0.28) calc(100% - 1.8vw), rgba(246,36,137,0.30) 100%); }
/* Limb brightening: a soft warm edge, strongest towards the sun and absent on the far side. It is a feathered gradient, not a line. */
.k-universe .k-limb { position: absolute; inset: 0; border-radius: inherit; opacity: 0.95; transform: rotate(var(--a, 0deg));
  background: radial-gradient(closest-side, transparent calc(100% - 3.4vw), rgba(246,36,137,0.30) calc(100% - 1.4vw), rgba(255,167,34,0.62) calc(100% - 0.45vw), rgba(255,226,180,0.9) 100%);
  -webkit-mask-image: conic-gradient(from -75deg at 50% 50%, transparent 0deg, rgba(0,0,0,0.28) 30deg, rgba(0,0,0,0.5) 66deg, #000 100deg, #000 112deg, rgba(0,0,0,0.5) 138deg, transparent 170deg 360deg);
  mask-image: conic-gradient(from -75deg at 50% 50%, transparent 0deg, rgba(0,0,0,0.28) 30deg, rgba(0,0,0,0.5) 66deg, #000 100deg, #000 112deg, rgba(0,0,0,0.5) 138deg, transparent 170deg 360deg); }
.k-universe[data-motion] .k-limb { animation: k-sway var(--s, 70s) ease-in-out infinite alternate; }
.k-universe .k-shade { position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(180deg, transparent 0%, rgba(2,1,6,0.45) 20%, rgba(2,1,6,0.9) 48%); }

.k-universe .k-clouds { position: absolute; left: calc(50% - 50vw); top: 0; width: 100vw; height: calc(var(--rise) * 1.6); overflow: hidden; opacity: 0.7; mix-blend-mode: screen;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 100%); mask-image: linear-gradient(180deg, #000 0%, transparent 100%); }
.k-universe .k-clouds-track { position: absolute; left: 0; top: 0; width: 200vw; height: 100%; background-repeat: repeat-x; background-size: 100vw 100%; }
.k-universe[data-motion] .k-clouds-track { animation: k-drift 240s linear infinite; }

.k-universe .k-cities { position: absolute; left: calc(50% - 50vw); top: 0; width: 100vw; height: calc(var(--rise) * 1.05); overflow: hidden;
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, transparent 18%, #000 62%); mask-image: linear-gradient(180deg, transparent 0%, transparent 18%, #000 62%); }
.k-universe[data-motion] .k-cities { animation: k-fade-in 2.4s ease-out 2.2s backwards; }
.k-universe .k-city-glow { filter: blur(2.4px); }
.k-universe[data-motion] .k-city-glow { animation: k-breathe 7s ease-in-out infinite; }

/* The low sun: a soft bloom and a hot core on the limb, on an arm that turns about the planet's centre. */
.k-universe .k-arm { position: absolute; inset: 0; transform: rotate(var(--a, 0deg)); transform-origin: 50% 50%; pointer-events: none; }
.k-universe[data-motion] .k-arm[data-sway] { animation: k-sway var(--s, 70s) ease-in-out infinite alternate; }
.k-universe .k-sunbloom { position: absolute; left: 50%; top: 0; width: 46vw; height: 11vw; transform: translate(-50%, -52%); mix-blend-mode: screen;
  background: radial-gradient(closest-side, rgba(255,214,160,0.85), rgba(255,150,70,0.45) 30%, rgba(246,36,137,0.18) 62%, transparent 100%); }
.k-universe .k-suncore { position: absolute; left: 50%; top: 0; width: 7vw; height: 1.8vw; transform: translate(-50%, -50%); mix-blend-mode: screen;
  background: radial-gradient(closest-side, rgba(255,250,235,0.95), rgba(255,200,130,0.55) 45%, transparent 100%); }
.k-universe[data-motion] .k-sunbloom, .k-universe[data-motion] .k-suncore { animation: k-sun-rise 3.2s ease-out 0.9s backwards; }
.k-universe[data-motion] .k-sunbloom { animation: k-sun-rise 3.2s ease-out 0.9s backwards, k-breathe 8s ease-in-out 4.1s infinite; }

.k-universe .k-shoot { position: absolute; top: 12%; left: 6%; width: 120px; height: 1.5px; opacity: 0; transform: rotate(24deg); background: linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.9)); }
.k-universe[data-motion] .k-shoot { animation: k-shoot 20s linear 6s infinite; }

/* Entrance order: sky, stars, planet, atmosphere, sun, lights. */
.k-universe[data-motion] .k-sky { animation: k-fade-in 1.8s ease-out backwards; }
.k-universe[data-motion] .k-stars { animation: k-fade-in 2.4s ease-out 0.2s backwards; }
.k-universe[data-motion] .k-rise-in { animation: k-planet-rise 3.4s cubic-bezier(0.16, 1, 0.3, 1) backwards; }

/* Daylight: the same dusk, in pastels. */
:root:not(.dark) .k-universe .k-sky { background: linear-gradient(180deg, rgba(64,18,248,0) 0%, rgba(64,18,248,0.05) 34%, rgba(165,22,197,0.07) 56%, rgba(246,36,137,0.08) 76%, rgba(255,167,34,0.10) 100%); }
:root:not(.dark) .k-universe .k-planet { background: radial-gradient(closest-side, #cfc3ee 0%, #d9cff4 70%, #e6defa 100%); }
:root:not(.dark) .k-universe .k-body { background: radial-gradient(closest-side, transparent calc(100% - 9vw), rgba(64,18,248,0.10) calc(100% - 4.5vw), rgba(165,22,197,0.16) calc(100% - 1.8vw), rgba(246,36,137,0.22) 100%); }
:root:not(.dark) .k-universe .k-shade { background: linear-gradient(180deg, transparent 0%, rgba(120,100,180,0.18) 24%, rgba(110,90,170,0.40) 60%); }
:root:not(.dark) .k-universe .k-clouds { mix-blend-mode: multiply; opacity: 0.32; }
:root:not(.dark) .k-universe .k-atm { opacity: 0.55; }
:root:not(.dark) .k-universe[data-energized] .k-atm { opacity: 0.8; }
:root:not(.dark) .k-universe .k-sunbloom, :root:not(.dark) .k-universe .k-suncore { mix-blend-mode: normal; opacity: 0.7; }
:root:not(.dark) .k-universe .k-tint { mix-blend-mode: normal; }
:root:not(.dark) .k-universe .k-cities { opacity: 0.55; }

@keyframes k-planet-rise { from { transform: translateY(16%); opacity: 0; } 35% { opacity: 1; } to { transform: none; opacity: 1; } }
@keyframes k-ignite { from { opacity: 0; } to { opacity: var(--end, 1); } }
@keyframes k-sun-rise { from { opacity: 0; transform: translate(-50%, -30%) scale(0.6); } to { opacity: 1; transform: translate(-50%, -52%) scale(1); } }
@keyframes k-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes k-breathe { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
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
  .k-universe, .k-universe * { animation: none !important; transition: none !important; }
}
`;

interface HeroUniverseProps {
  reducedMotion: boolean;
  /** The hero's smoothed pointer position, 0..1 across the section. */
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  /** How far the hero has scrolled out of view, 0..1: the planet sinks a little slower than the page. */
  scroll?: MotionValue<number>;
  /** A fine pointer is present (a mouse or trackpad): only then do the layers drift against it. */
  parallax: boolean;
  /** The search is in use: the glow along the limb rises a little. */
  energized?: boolean;
  /** The journey under the pointer or focus, if any: the horizon takes its colour. */
  tint?: JourneyId | null;
}

/** The sun and the lit side of the limb turn together, so they share one set of variables. */
const SUN_STYLE = { ["--a" as string]: "var(--sun)", ["--w" as string]: "var(--sunw)", ["--s" as string]: "70s" };

export const HeroUniverse = memo(function HeroUniverse({ reducedMotion, pointerX, pointerY, scroll, parallax, energized = false, tint = null }: HeroUniverseProps) {
  const stars = useMemo(() => makeStars(64), []);
  const cities = useMemo(() => makeCities(), []);
  const moving = !reducedMotion;
  const drift = moving && parallax;
  // Three depths: the far stars barely move, the planet a little, the atmosphere and sun the most.
  const starX = useTransform(pointerX, [0, 1], [-5, 5]);
  const starY = useTransform(pointerY, [0, 1], [-3, 3]);
  const planetX = useTransform(pointerX, [0, 1], [-12, 12]);
  const planetY = useTransform(pointerY, [0, 1], [-4, 4]);
  const glowX = useTransform(pointerX, [0, 1], [-20, 20]);
  const glowY = useTransform(pointerY, [0, 1], [-7, 7]);
  const sink = useTransform(scroll ?? pointerY, scroll ? [0, 1] : [0, 1], scroll ? [0, 90] : [0, 0]);
  const still = { x: 0, y: 0 };
  /** Marks a layer that loops; present only when motion is allowed, so a still sky has none. */
  const anim = moving ? { "data-anim": "" } : {};
  const sway = moving ? { "data-sway": "", "data-anim": "" } : {};

  return (
    <div
      data-universe
      className="k-universe absolute inset-0 overflow-hidden"
      data-motion={moving ? "" : undefined}
      data-energized={energized ? "" : undefined}
      data-tint={tint ?? undefined}
    >
      <style>{CSS}</style>

      <div className="k-sky" />

      <motion.div className="absolute inset-0" style={drift ? { x: starX, y: starY } : still}>
        <div className="k-stars">
          <svg viewBox={`0 0 ${STAR_FIELD.w} ${STAR_FIELD.h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" focusable="false">
            {stars.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={s.r}
                {...(s.twinkle ? anim : {})}
                style={{
                  fill: s.tint ?? "hsl(var(--foreground))",
                  opacity: s.o,
                  ["--o" as string]: s.o,
                  animation: moving && s.twinkle ? `k-star ${5 + (i % 5)}s ease-in-out ${s.delay}s infinite` : undefined,
                }}
              />
            ))}
          </svg>
        </div>
      </motion.div>

      {moving ? <span data-anim className="k-shoot" /> : null}

      {/* Scroll sinks the whole planet; the pointer then moves its parts at different depths. */}
      <motion.div className="absolute inset-0" style={moving && scroll ? { y: sink } : still}>
        <div className="k-tint" />

        <motion.div className="absolute inset-0" style={drift ? { x: glowX, y: glowY } : still}>
          <div className="k-rise k-rise-in absolute inset-0" {...anim}>
            <div className="k-geo k-atm k-atm-wide" style={{ ...SUN_STYLE, ["--end" as string]: 0.85 }} {...sway} />
            <div className="k-geo k-atm k-atm-hot" style={SUN_STYLE} {...sway} />
          </div>
        </motion.div>

        <motion.div className="absolute inset-0" style={drift ? { x: planetX, y: planetY } : still}>
          <div className="k-rise k-rise-in absolute inset-0">
            <div className="k-geo k-planet">
              <div className="k-body" />
              <div className="k-clouds">
                <div className="k-clouds-track" {...anim} style={{ backgroundImage: `url(${cloudsUrl})` }} />
              </div>
              <div className="k-cities" {...anim}>
                <svg viewBox={`0 0 ${CITY_FIELD.w} ${CITY_FIELD.h}`} preserveAspectRatio="xMidYMin slice" className="absolute inset-0 h-full w-full" focusable="false">
                  <g className="k-city-glow" {...anim}>
                    {cities.map((c, i) => (
                      <circle key={i} cx={c.x} cy={c.y} r={c.r * 2.6} fill={c.hue ? "var(--k-g-3)" : "var(--k-g-4)"} opacity={c.o * 0.45} />
                    ))}
                  </g>
                  {cities.map((c, i) => (
                    <circle
                      key={i}
                      cx={c.x}
                      cy={c.y}
                      r={c.r}
                      fill={c.hue ? "#ffd3e6" : "#ffe3b0"}
                      opacity={c.o}
                      {...(c.twinkle ? anim : {})}
                      style={moving && c.twinkle ? { ["--o" as string]: c.o, animation: `k-star ${4 + (i % 4)}s ease-in-out ${c.delay}s infinite` } : undefined}
                    />
                  ))}
                </svg>
              </div>
              <div className="k-shade" />
              <div className="k-limb" style={SUN_STYLE} {...sway} />
            </div>

            {/* The low sun on the limb. */}
            <div className="k-geo" style={{ pointerEvents: "none" }}>
              <div className="k-arm" style={SUN_STYLE} {...sway}>
                <span className="k-sunbloom" />
                <span className="k-suncore" />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
});

export default HeroUniverse;
