import { KretopiaLoader } from "@/components/brand/KretopiaLoader";

/**
 * Legacy CreatorOrbitLoader API. It used to orbit real-creator avatars (and
 * fetch them from the database just to show a spinner); it now renders the one
 * Kretopia loader -- the K-mark inside the brand-gradient ring -- so every
 * wait state looks the same. Kept so existing imports and call sites work.
 * New code: use `KretopiaLoader` / `KretopiaSpinner` from
 * "@/components/brand/KretopiaLoader".
 */
type Size = "sm" | "md" | "lg" | "page";

interface Props {
  size?: Size;
  label?: string;
  hint?: string;
  className?: string;
}

export const CreatorOrbitLoader = ({ size = "md", label, hint, className }: Props) => (
  <KretopiaLoader size={size} label={label} hint={hint} className={className} />
);

export default CreatorOrbitLoader;
