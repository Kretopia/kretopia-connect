import { cn } from "@/lib/utils";
import { KretopiaLoader } from "@/components/brand/KretopiaLoader";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  /** Optional context (kept for API compatibility -- ignored). */
  context?: string | null;
}

/**
 * Block-level loading state: the Kretopia loader (K-mark in the rotating
 * brand ring). Same API as before so existing call sites keep working; for
 * an inline spinner inside a button or row use `KretopiaSpinner`.
 */
export const LoadingSpinner = ({ size = "md", className, text }: LoadingSpinnerProps) => {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <KretopiaLoader size={size} label={text} />
    </div>
  );
};
