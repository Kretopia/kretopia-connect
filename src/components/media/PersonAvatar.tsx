import { getInitials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { MediaImage } from "./MediaImage";

interface PersonAvatarProps {
  /** The person's real avatar URL, if they have one. */
  src: string | null | undefined;
  /** Their name, used for the initials and, with no photo, as the accessible name. */
  name: string | null | undefined;
  className?: string;
}

/**
 * A person is their photo or their initials, never an illustration. Square
 * crop (object-cover, so faces are not stretched), lazy-loaded, with the box
 * reserved up front. Size it with `h-* w-*` through className.
 */
export function PersonAvatar({ src, name, className }: PersonAvatarProps) {
  const initials = getInitials(name);
  return (
    <MediaImage
      src={src}
      alt=""
      aspect="aspect-square"
      className={cn("shrink-0 rounded-full bg-muted", className)}
      fallback={
        <span
          role="img"
          aria-label={name || "Creator"}
          className="flex h-full w-full select-none items-center justify-center text-[0.8em] font-bold text-muted-foreground"
        >
          {initials}
        </span>
      }
    />
  );
}

export default PersonAvatar;
