import { ArrowRight, Handshake, MessageCircle, UserPlus2, Eye } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";

interface Props {
  firstName: string;
  isOwner: boolean;
  connectionStatus?: "none" | "pending" | "connected";
  isConnecting?: boolean;
  onConnect?: () => void;
  onMessage?: () => void;
  onPropose?: () => void;
  onInvite?: () => void;
  onPreview?: () => void;
}

export function PassportCollaborationCta({ firstName, isOwner, connectionStatus = "none", isConnecting = false, onConnect, onMessage, onPropose, onInvite, onPreview }: Props) {
  const pending = connectionStatus === "pending";
  return (
    <section className="relative space-y-4 py-5" aria-label="Collaborate on Kretopia">
      <BrandLogo size="sm" />
      <div className="space-y-2">
        <h2 className="break-words text-xl font-bold text-foreground">
          {isOwner ? <>Your next collaboration <span className="k-gradient-text">starts here.</span></> : <>Create something great <span className="k-gradient-text">with {firstName}.</span></>}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isOwner ? "Your work. Your expertise. A direct invitation to work together on Kretopia." : pending ? "Connection request sent. The next step is theirs." : "Have a project in mind? Turn a first connection into your next creative partnership."}
        </p>
      </div>
      {isOwner ? (
        <Button variant="outline" onClick={onPreview} className="w-full gap-2"><Eye className="h-4 w-4" />View your public Passport<ArrowRight className="ml-auto h-4 w-4" /></Button>
      ) : connectionStatus === "connected" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={onMessage} className="min-w-0 gap-1.5 px-2 text-xs"><MessageCircle className="h-4 w-4 shrink-0" />Message</Button>
          <CtaButton onClick={onPropose} className="min-w-0 gap-1.5 px-2 text-xs"><Handshake className="h-4 w-4 shrink-0" />Start a Project</CtaButton>
          <Button variant="outline" onClick={onInvite} className="min-w-0 gap-1.5 px-2 text-xs"><UserPlus2 className="h-4 w-4 shrink-0" />Invite to Project</Button>
        </div>
      ) : (
        <CtaButton onClick={onConnect} disabled={pending || isConnecting} className="w-full gap-2"><Handshake className="h-4 w-4 shrink-0" />{pending ? "Request pending" : isConnecting ? "Sending…" : `Connect with ${firstName}`}<ArrowRight className="ml-auto h-4 w-4 shrink-0" /></CtaButton>
      )}
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Handshake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-energy" />Every project invitation and role proposal is subject to acceptance by the person or company concerned.</p>
    </section>
  );
}