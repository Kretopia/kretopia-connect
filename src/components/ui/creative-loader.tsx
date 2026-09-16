import { CreatorOrbitLoader } from "./creator-orbit-loader";
import type { ComponentProps } from "react";

/**
 * Legacy CreativeLoader API — now backed by CreatorOrbitLoader so every
 * loader across the app shows orbiting real-creator avatars. The old
 * `vignette` / `context` props are accepted for backwards compatibility
 * but ignored.
 */

export type CreativeVignette =
  | "studio" | "music" | "guitarist" | "dj" | "photographer"
  | "filmmaker" | "painter" | "writer" | "stylist" | "podcaster"
  | "event" | "designer";

export function vignetteForContext(_input?: string | null): CreativeVignette | null {
  return null;
}

interface CreativeLoaderProps {
  vignette?: CreativeVignette;
  context?: string | null;
  label?: string;
  hint?: string;
  size?: ComponentProps<typeof CreatorOrbitLoader>["size"];
  className?: string;
}

export const CreativeLoader = ({ label, hint, size = "md", className }: CreativeLoaderProps) => {
  return <CreatorOrbitLoader size={size} label={label} hint={hint} className={className} />;
};

export default CreativeLoader;
