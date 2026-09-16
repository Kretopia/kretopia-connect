import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/**
 * Creator Orbit Loader — replaces generic spinners with rotating real-creator
 * avatars. Shares pool across the app (module cache) so it's instant after the
 * first load. Falls back to a clean gradient pulse before avatars arrive.
 */

const SIZES = {
  sm: { wrap: "py-2", stage: 64, ring: 56, avatar: 22, hero: 28, text: "text-[10px]" },
  md: { wrap: "py-5", stage: 110, ring: 92, avatar: 32, hero: 44, text: "text-xs" },
  lg: { wrap: "py-8", stage: 150, ring: 124, avatar: 40, hero: 56, text: "text-sm" },
  page: { wrap: "min-h-[60vh] py-12", stage: 200, ring: 168, avatar: 48, hero: 72, text: "text-sm" },
} as const;

type Size = keyof typeof SIZES;

interface Creator {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

let CACHE: Creator[] | null = null;
let INFLIGHT: Promise<Creator[]> | null = null;

async function loadCreators(): Promise<Creator[]> {
  if (CACHE && CACHE.length > 0) return CACHE;
  if (INFLIGHT) return INFLIGHT;
  INFLIGHT = (async () => {
    try {
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url")
        .not("avatar_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(40);
      const list = (data || []).filter((d: any) => d.avatar_url) as Creator[];
      CACHE = list.sort(() => Math.random() - 0.5);
      return CACHE;
    } catch {
      return [] as Creator[];
    } finally {
      INFLIGHT = null;
    }
  })();
  return INFLIGHT;
}

interface Props {
  size?: Size;
  label?: string;
  hint?: string;
  className?: string;
}

const ROTATION_LINES = [
  "Gathering the crew",
  "Cueing real creators",
  "Lining up the talent",
  "Almost ready…",
];

export const CreatorOrbitLoader = ({ size = "md", label, hint, className }: Props) => {
  const s = SIZES[size];
  const [pool, setPool] = useState<Creator[]>(CACHE ?? []);
  const [tick, setTick] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!CACHE || CACHE.length === 0) {
      loadCreators().then((p) => alive && setPool(p));
    }
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (label) return;
    const id = setInterval(() => setStepIdx((i) => (i + 1) % ROTATION_LINES.length), 1400);
    return () => clearInterval(id);
  }, [label]);

  const ORBIT_COUNT = 5;
  const window = pool.length > 0
    ? Array.from({ length: ORBIT_COUNT }, (_, i) => pool[(tick + i) % pool.length])
    : [];

  const heroIndex = pool.length > 0 ? pool[(tick + ORBIT_COUNT) % pool.length] : null;
  const currentLine = label ?? ROTATION_LINES[stepIdx];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={currentLine}
      className={cn("relative flex flex-col items-center justify-center overflow-hidden", s.wrap, className)}
    >
      {/* Soft brand glow */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.15), transparent 45%), radial-gradient(circle at 75% 80%, hsl(var(--energy) / 0.12), transparent 50%)",
        }}
      />

      {/* Orbit stage */}
      <div className="relative" style={{ width: s.stage, height: s.stage }}>
        {/* Pulsing ring */}
        <div
          className="absolute inset-0 m-auto rounded-full border-2 border-primary/25"
          style={{ width: s.ring, height: s.ring, animation: "co-ring 2.4s ease-out infinite" }}
        />
        <div
          className="absolute inset-0 m-auto rounded-full border-2 border-energy/30"
          style={{ width: s.ring, height: s.ring, animation: "co-ring 2.4s ease-out 0.8s infinite" }}
        />

        {/* Orbiting avatars */}
        {window.map((c, i) => {
          const angle = (i / ORBIT_COUNT) * 360;
          const r = s.ring / 2;
          return (
            <div
              key={`${tick}-${i}-${c?.user_id}`}
              className="absolute top-1/2 left-1/2 rounded-full border-2 border-background shadow-md overflow-hidden bg-muted animate-fade-in"
              style={{
                width: s.avatar,
                height: s.avatar,
                marginLeft: -s.avatar / 2,
                marginTop: -s.avatar / 2,
                transform: `rotate(${angle}deg) translateY(-${r}px) rotate(-${angle}deg)`,
              }}
            >
              {c?.avatar_url ? (
                <img
                  src={c.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => ((e.currentTarget.style.display = "none"))}
                />
              ) : null}
            </div>
          );
        })}

        {/* Hero center — featured creator OR brand pulse */}
        <div
          className="absolute top-1/2 left-1/2 rounded-full bg-gradient-to-br from-primary to-energy shadow-xl flex items-center justify-center overflow-hidden border-2 border-background"
          style={{
            width: s.hero,
            height: s.hero,
            marginLeft: -s.hero / 2,
            marginTop: -s.hero / 2,
            animation: "co-pulse 1.6s ease-in-out infinite",
          }}
        >
          {heroIndex?.avatar_url ? (
            <img
              key={heroIndex.user_id}
              src={heroIndex.avatar_url}
              alt=""
              className="w-full h-full object-cover animate-fade-in"
              loading="lazy"
            />
          ) : (
            <span className="text-primary-foreground font-black" style={{ fontSize: s.hero / 3 }}>
              IN
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-4 text-center px-4 max-w-xs">
        <p key={stepIdx + currentLine} className={cn("font-semibold animate-fade-in", s.text)}>
          {currentLine}
        </p>
        {hint && <p className={cn("mt-1.5 text-muted-foreground", s.text)}>{hint}</p>}
      </div>

      <style>{`
        @keyframes co-ring {
          0% { transform: scale(0.85); opacity: 0.75; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes co-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 24px hsl(var(--primary) / 0.35); }
          50% { transform: scale(1.06); box-shadow: 0 0 44px hsl(var(--primary) / 0.65); }
        }
      `}</style>
    </div>
  );
};

export default CreatorOrbitLoader;
