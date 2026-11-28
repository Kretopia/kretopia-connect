import { UserRound } from "lucide-react";

import { MatchKretoArtwork } from "./MatchKretoArtwork";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The Match card's own little world, for the moments a deck is on its way: Kreto at the centre of three rings drawn in the logo's
 * gradient (blue, violet, magenta, orange), with a few Passports travelling around them. While something is loading the rings turn
 * and the Passports orbit; once there is a message to read they settle to a slow drift. Everything is CSS on the compositor
 * (transform and opacity), the artwork is the cached official character, and under prefers-reduced-motion the scene is drawn once and
 * nothing moves. Decorative: it carries no text and is hidden from assistive technology.
 */

const CSS = `
.k-mwait { --size: min(100%, 15.5rem); position: relative; margin-inline: auto; width: var(--size); aspect-ratio: 1; isolation: isolate; }
.k-mwait .k-mw-glow { position: absolute; inset: 6%; border-radius: 9999px; z-index: -1;
  background: radial-gradient(closest-side, rgba(165,22,197,0.34), rgba(64,18,248,0.18) 55%, transparent 100%); filter: blur(6px); }
.k-mwait .k-mw-ring { position: absolute; border-radius: 9999px; inset: var(--i); }
.k-mwait .k-mw-ring::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px;
  background: conic-gradient(from var(--r, 0deg), var(--k-g-1), var(--k-g-2), var(--k-g-3), var(--k-g-4), transparent 62%, var(--k-g-1));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; opacity: var(--o, 0.85); }
.k-mwait .k-mw-ring[data-r="1"] { --i: 0%; --o: 0.35; }
.k-mwait .k-mw-ring[data-r="2"] { --i: 13%; --o: 0.6; --r: 120deg; }
.k-mwait .k-mw-ring[data-r="3"] { --i: 26%; --o: 0.95; --r: 240deg; }
.k-mwait[data-live] .k-mw-ring[data-r="1"] { animation: k-mw-spin 22s linear infinite; }
.k-mwait[data-live] .k-mw-ring[data-r="2"] { animation: k-mw-spin 14s linear infinite reverse; }
.k-mwait[data-live] .k-mw-ring[data-r="3"] { animation: k-mw-spin 9s linear infinite; }
.k-mwait[data-live="idle"] .k-mw-ring[data-r="1"] { animation-duration: 60s; }
.k-mwait[data-live="idle"] .k-mw-ring[data-r="2"] { animation-duration: 44s; }
.k-mwait[data-live="idle"] .k-mw-ring[data-r="3"] { animation-duration: 30s; }
.k-mwait .k-mw-ping { position: absolute; inset: 26%; border-radius: 9999px; border: 1px solid var(--k-g-3); opacity: 0; }
.k-mwait[data-live="busy"] .k-mw-ping { animation: k-mw-ping 2.6s ease-out infinite; }
.k-mwait[data-live="busy"] .k-mw-ping + .k-mw-ping { animation-delay: 1.3s; }
.k-mwait .k-mw-core { position: absolute; inset: 31%; border-radius: 9999px; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(closest-side, hsl(var(--card)), hsl(var(--card) / 0.65)); box-shadow: 0 0 28px rgba(165,22,197,0.35); overflow: hidden; }
.k-mwait .k-mw-orbit { position: absolute; inset: var(--i); }
.k-mwait[data-live] .k-mw-orbit { animation: k-mw-spin var(--s) linear infinite; animation-delay: var(--d, 0s); }
.k-mwait[data-live="idle"] .k-mw-orbit { animation-duration: calc(var(--s) * 3); }
.k-mwait .k-mw-dot { position: absolute; left: 50%; top: 0; width: 1.65rem; height: 1.65rem; margin-left: -0.825rem; margin-top: -0.825rem; border-radius: 9999px;
  display: flex; align-items: center; justify-content: center; color: #fff; background: linear-gradient(135deg, var(--c1), var(--c2)); box-shadow: 0 4px 14px color-mix(in srgb, var(--c2) 55%, transparent); }
.k-mwait[data-live] .k-mw-dot > svg { animation: k-mw-spin var(--s) linear infinite reverse; animation-delay: var(--d, 0s); }
.k-mwait[data-live="idle"] .k-mw-dot > svg { animation-duration: calc(var(--s) * 3); }
@keyframes k-mw-spin { to { transform: rotate(360deg); } }
@keyframes k-mw-ping { 0% { opacity: 0.7; transform: scale(0.9); } 100% { opacity: 0; transform: scale(2.1); } }
@media (prefers-reduced-motion: reduce) { .k-mwait, .k-mwait * { animation: none !important; } }
`;

const ORBITS = [
  { inset: "0%", seconds: 9, delay: "0s", c1: "var(--k-g-2)", c2: "var(--k-g-3)" },
  { inset: "13%", seconds: 14, delay: "-5s", c1: "var(--k-g-3)", c2: "var(--k-g-4)" },
  { inset: "26%", seconds: 11, delay: "-2s", c1: "var(--k-g-1)", c2: "var(--k-g-2)" },
] as const;

/** `busy`: something is loading, so it moves quickly; otherwise it drifts. */
export function MatchWaitingScene({ busy = false }: { busy?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className="k-mwait" aria-hidden data-match-scene data-live={reduced ? undefined : busy ? "busy" : "idle"}>
      <style>{CSS}</style>
      <span className="k-mw-glow" />
      {[1, 2, 3].map((r) => <span key={r} className="k-mw-ring" data-r={r} />)}
      <span className="k-mw-ping" />
      <span className="k-mw-ping" />
      {ORBITS.map((o, i) => (
        <span key={i} className="k-mw-orbit" style={{ ["--i" as string]: o.inset, ["--s" as string]: `${o.seconds}s`, ["--d" as string]: o.delay, ["--c1" as string]: o.c1, ["--c2" as string]: o.c2 }}>
          <span className="k-mw-dot"><UserRound className="h-3.5 w-3.5" strokeWidth={2.2} /></span>
        </span>
      ))}
      <span className="k-mw-core"><MatchKretoArtwork className="scale-125" /></span>
    </div>
  );
}
