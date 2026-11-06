import { KretoMark } from "@/components/brand/KretoMark";
import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";

interface DestinationIconProps {
  className?: string;
}

export function PassportDestinationIcon({ className }: DestinationIconProps) {
  return <KretopiaIcon name="passport" size={20} className={className} />;
}

export function ScoutDestinationIcon({ className }: DestinationIconProps) {
  return <KretopiaIcon name="scout" size={20} className={className} />;
}

export function StudioDestinationIcon({ className }: DestinationIconProps) {
  return <KretopiaIcon name="studio" size={20} className={className} />;
}

export function KretoDestinationIcon({ className }: DestinationIconProps) {
  return <KretoMark variant="bare" size="md" className={className} />;
}
