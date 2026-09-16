import { Shield, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BlockchainVerifiedBadgeProps {
  walletAddress?: string;
  compact?: boolean;
}

export const BlockchainVerifiedBadge = ({
  walletAddress,
  compact = false,
}: BlockchainVerifiedBadgeProps) => {
  if (!walletAddress) return null;

  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1 text-primary">
              <Shield className="h-3.5 w-3.5" />
              <CheckCircle className="h-2.5 w-2.5 -ml-1.5 mt-1.5 text-accent" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">On-Chain Verified: {shortAddress}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-primary/30 bg-primary/5 text-primary gap-1.5 text-xs font-medium"
    >
      <Shield className="h-3 w-3" />
      On-Chain Verified
    </Badge>
  );
};
