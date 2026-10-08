import { KretopiaLoader } from "@/components/brand/KretopiaLoader";
import { cn } from "@/lib/utils";

interface PassportLoaderProps {
  label?: string;
  className?: string;
}

/**
 * The loading state for opening a Creative Passport (CreatorEPK.tsx). This is
 * the look every loader in the product now shares -- the K-mark breathing
 * inside a rotating brand-gradient ring -- so it simply renders the shared
 * KretopiaLoader at its large size with the Passport label.
 */
export function PassportLoader({ label = "Opening your Creative Passport…", className }: PassportLoaderProps) {
  return <KretopiaLoader size="lg" label={label} className={cn("py-0", className)} />;
}

export default PassportLoader;
