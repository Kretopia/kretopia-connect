import { cn } from "@/lib/utils";
import { CreatorOrbitLoader } from "./creator-orbit-loader";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  /** Optional context (kept for API compatibility — ignored by orbit loader). */
  context?: string | null;
}

/**
 * Unified Kretopia loader: rotating real-creator avatars orbiting a hero
 * portrait. Same API as before — drop-in replacement for the previous
 * CreativeLoader-backed spinner.
 */
export const LoadingSpinner = ({ size = "md", className, text }: LoadingSpinnerProps) => {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <CreatorOrbitLoader size={size} label={text} />
    </div>
  );
};
