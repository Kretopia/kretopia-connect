import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";

/**
 * Lightweight glow toast that appears on /profile after a successful
 * universal claim flow. Shows for ~3s then auto-dismisses.
 * Triggered by ?claimed=true in URL.
 */
export const ClaimedProfileGlow = () => {
  const [params, setParams] = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (params.get("claimed") === "true") {
      setVisible(true);
      // Strip the param so a refresh doesn't re-trigger
      const next = new URLSearchParams(params);
      next.delete("claimed");
      setParams(next, { replace: true });
      const t = setTimeout(() => setVisible(false), 4000);
      return () => clearTimeout(t);
    }
  }, [params, setParams]);

  if (!visible) return null;

  return (
    <div className="fixed top-[max(env(safe-area-inset-top),1rem)] left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-md px-4 py-2 shadow-lg shadow-primary/20">
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        <p className="text-sm font-semibold">Welcome — your profile is live</p>
      </div>
    </div>
  );
};
