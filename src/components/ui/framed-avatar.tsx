import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface FramedAvatarProps {
  src?: string | null;
  fallback: string;
  frame?: string | null;
  className?: string;
  onClick?: () => void;
  /** Defaults to a generic label derived from `fallback` (usually an
   *  initial) when the caller doesn't have a real name handy -- pass the
   *  person's name whenever it's available for a meaningful screen-reader
   *  label instead of nothing. */
  alt?: string;
}

const frameStyles: Record<string, string> = {
  gradient_gold:
    "ring-[3px] ring-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.4)]",
  gradient_rainbow:
    "ring-[3px] ring-transparent bg-clip-padding [background-image:linear-gradient(var(--background),var(--background)),var(--kretopia-sunset,hsl(327_100%_59%))] [background-origin:border-box] [background-clip:padding-box,border-box]",
  pulse_primary:
    "ring-[3px] ring-primary/60 shadow-[0_0_14px_3px_hsl(var(--primary)/0.35)] animate-pulse",
};

/**
 * Avatar with optional animated profile frame from Rewards Shop
 */
export const FramedAvatar = ({
  src,
  fallback,
  frame,
  className,
  onClick,
  alt,
}: FramedAvatarProps) => {
  const frameClass = frame ? frameStyles[frame] || "" : "";

  return (
    <Avatar
      className={cn(
        "transition-all duration-300",
        frameClass,
        className
      )}
      onClick={onClick}
    >
      <AvatarImage src={src || undefined} alt={alt || `${fallback} avatar`} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
};
