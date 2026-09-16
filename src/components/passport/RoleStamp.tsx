import {
  Code2, Shirt, Music2, Camera, Palette, PenLine, Footprints, HardHat, UserRound, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getRoleStampCategory, ROLE_STAMP_LABEL, type RoleStampCategory } from "@/lib/passport/roleStamp";

const CATEGORY_ICON: Record<RoleStampCategory, LucideIcon> = {
  software: Code2,
  fashion: Shirt,
  music: Music2,
  photo_video: Camera,
  design: Palette,
  writing: PenLine,
  dance: Footprints,
  crew: HardHat,
  model: UserRound,
  creator: Sparkles,
};

interface RoleStampProps {
  role?: string | null;
  subRoles?: string[] | null;
  /** Pixel diameter of the stamp. */
  size?: number;
  className?: string;
}

/**
 * The gold metallic Passport seal -- replaces the old "L1" numeric level
 * badge. One consistent look per craft (see roleStamp.ts), not level-gated:
 * the point is "what you do", not a gamified rank. CSS-only metallic look
 * (layered gradients, no image asset) so it stays crisp at every size.
 */
export function RoleStamp({ role, subRoles, size = 32, className }: RoleStampProps) {
  const category = getRoleStampCategory({ role, sub_roles: subRoles });
  const label = ROLE_STAMP_LABEL[category];
  const Icon = CATEGORY_ICON[category];
  const iconSize = Math.round(size * 0.46);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", className)}
          style={{
            width: size,
            height: size,
            background:
              "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.9), transparent 42%)," +
              "linear-gradient(135deg, #FDE68A 0%, #F3C543 24%, #D69A1E 55%, #8A550F 100%)",
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.65), inset 0 -2px 3px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.35)",
            border: "1px solid rgba(112, 68, 10, 0.55)",
          }}
        >
          <Icon
            aria-hidden
            style={{ width: iconSize, height: iconSize, color: "#4A2E08" }}
            strokeWidth={2.25}
          />
          <span className="sr-only">{label} — Kretopia Passport</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-sm">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default RoleStamp;
