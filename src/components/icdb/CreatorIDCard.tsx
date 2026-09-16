import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, ShieldCheck, Fingerprint, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

interface CreatorIDCardProps {
  creatorId: string;
  fullName: string;
  role?: string;
  avatarUrl?: string;
  verificationTier?: string;
  creditCount?: number;
  compact?: boolean;
}

export const CreatorIDCard = ({
  creatorId,
  fullName,
  role,
  avatarUrl,
  verificationTier,
  creditCount = 0,
  compact = false,
}: CreatorIDCardProps) => {
  const copyId = () => {
    navigator.clipboard.writeText(creatorId);
    toast.success("Creator ID copied!");
  };

  const profileUrl = `${APP_URL}/epk/${creatorId}`;
  const copyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    toast.success("Profile link copied!");
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
        <Fingerprint className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-mono font-semibold text-primary">{creatorId}</span>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto" onClick={copyId}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-x-8 -translate-y-8" />
      <div className="p-4 relative">
        <div className="flex items-center gap-3 mb-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-12 h-12 rounded-full object-cover border-2 border-primary/20" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Fingerprint className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{fullName}</h3>
            {role && <p className="text-[11px] text-muted-foreground truncate">{role}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-background/80 rounded-md px-3 py-2 border border-primary/20">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5 text-primary" /> Creative Passport · Unique to you
            </p>
            <p className="font-mono font-bold text-sm text-primary tracking-wide">{creatorId}</p>
          </div>
          <Button variant="outline" size="sm" className="h-10 w-10 p-0 shrink-0" onClick={copyId}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3">
            {verificationTier && verificationTier !== 'none' && (
              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 border-primary/30 text-primary">
                <ShieldCheck className="h-2 w-2" />
                {verificationTier === 'verified' ? 'Verified' : verificationTier}
              </Badge>
            )}
            <span className="text-muted-foreground">{creditCount} {creditCount === 1 ? 'stamp' : 'stamps'}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={copyLink}>
            <ExternalLink className="h-2.5 w-2.5" /> Share Passport
          </Button>
        </div>
      </div>
    </Card>
  );
};
