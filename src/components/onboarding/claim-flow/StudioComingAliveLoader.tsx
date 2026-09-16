import { useEffect, useState } from "react";
import { Camera, Mic, Music2, Palette, Film, Sparkles, Lightbulb, Headphones } from "lucide-react";

/**
 * Cinematic "studio coming alive" loader shown while we build the profile.
 * Pure CSS animations — no external deps. Feels like a creative crew prepping a set:
 * lights flicker on, gear powers up, color swatches drift, status lines tick through.
 */
const STATUS_LINES = [
  { icon: Lightbulb, label: "Powering up the studio" },
  { icon: Camera, label: "Framing your portfolio" },
  { icon: Palette, label: "Mixing your color palette" },
  { icon: Mic, label: "Pulling your bio" },
  { icon: Film, label: "Verifying your credits" },
  { icon: Headphones, label: "Cueing your first match" },
  { icon: Sparkles, label: "Almost ready…" },
];

const FLOATING_GEAR = [
  { Icon: Camera, top: "12%", left: "8%", delay: "0s", size: 22 },
  { Icon: Mic, top: "22%", right: "10%", delay: "0.4s", size: 20 },
  { Icon: Music2, bottom: "28%", left: "12%", delay: "0.8s", size: 18 },
  { Icon: Film, bottom: "18%", right: "14%", delay: "1.2s", size: 22 },
  { Icon: Palette, top: "45%", left: "4%", delay: "1.6s", size: 18 },
  { Icon: Headphones, top: "52%", right: "6%", delay: "2s", size: 20 },
];

export const StudioComingAliveLoader = () => {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx((i) => (i + 1) % STATUS_LINES.length);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  const Current = STATUS_LINES[stepIdx];
  const CurrentIcon = Current.icon;

  return (
    <div className="relative py-10 overflow-hidden rounded-2xl bg-gradient-to-br from-background via-muted/30 to-background border border-border/50 min-h-[360px]">
      {/* Soft moving spotlights */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, hsl(var(--primary) / 0.18), transparent 45%), radial-gradient(circle at 75% 80%, hsl(var(--energy) / 0.15), transparent 50%)",
          animation: "studio-pan 6s ease-in-out infinite alternate",
        }}
      />

      {/* Floating gear icons drifting in */}
      {FLOATING_GEAR.map(({ Icon, delay, size, ...pos }, i) => (
        <div
          key={i}
          className="absolute text-muted-foreground/40"
          style={{
            ...pos,
            animation: `studio-float 4s ease-in-out ${delay} infinite, fade-in 0.8s ease-out ${delay} both`,
          }}
        >
          <Icon style={{ width: size, height: size }} />
        </div>
      ))}

      {/* Center stage: pulsing ring + glowing core */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-6">
        <div className="relative h-28 w-28">
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full border-2 border-primary/30"
            style={{ animation: "studio-ring 2.4s ease-out infinite" }}
          />
          <div
            className="absolute inset-0 rounded-full border-2 border-energy/40"
            style={{ animation: "studio-ring 2.4s ease-out 0.8s infinite" }}
          />
          <div
            className="absolute inset-0 rounded-full border-2 border-primary/20"
            style={{ animation: "studio-ring 2.4s ease-out 1.6s infinite" }}
          />
          {/* Core */}
          <div
            className="absolute inset-4 rounded-full bg-gradient-to-br from-primary to-energy shadow-2xl flex items-center justify-center"
            style={{ animation: "studio-pulse 1.6s ease-in-out infinite" }}
          >
            <CurrentIcon
              key={stepIdx}
              className="h-8 w-8 text-primary-foreground animate-scale-in"
            />
          </div>
        </div>

        {/* Animated status line */}
        <div className="text-center space-y-2 px-6">
          <p
            key={stepIdx}
            className="font-semibold text-base animate-fade-in"
          >
            {Current.label}
          </p>
          <div className="flex items-center justify-center gap-1.5">
            {STATUS_LINES.map((_, i) => (
              <span
                key={i}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: i === stepIdx ? 20 : 6,
                  background:
                    i === stepIdx
                      ? "hsl(var(--primary))"
                      : i < stepIdx
                      ? "hsl(var(--primary) / 0.5)"
                      : "hsl(var(--muted-foreground) / 0.25)",
                }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Your studio is coming alive…
          </p>
        </div>
      </div>

      <style>{`
        @keyframes studio-pan {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-20px, 10px); }
        }
        @keyframes studio-float {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }
        @keyframes studio-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes studio-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px hsl(var(--primary) / 0.4); }
          50% { transform: scale(1.06); box-shadow: 0 0 50px hsl(var(--primary) / 0.7); }
        }
      `}</style>
    </div>
  );
};
