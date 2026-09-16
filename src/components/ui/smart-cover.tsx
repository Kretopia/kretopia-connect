import { useState, CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartCoverProps {
  src?: string | null;
  alt: string;
  className?: string;
  style?: CSSProperties;
  fallbackClassName?: string;
}

/**
 * Image with built-in graceful fallback. If src is missing OR errors,
 * renders a branded gradient placeholder instead of broken alt text.
 */
export const SmartCover = ({ src, alt, className, style, fallbackClassName }: SmartCoverProps) => {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={cn(
          "w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex items-center justify-center",
          fallbackClassName,
          className,
        )}
        aria-label={alt}
      >
        <Sparkles className="h-8 w-8 text-primary/30" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className={className}
      style={style}
    />
  );
};
