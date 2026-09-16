import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Share2, Mail, MessageCircle, Globe, Lock, Linkedin, Twitter, Instagram, QrCode } from "lucide-react";
import {
  GlassModal,
  GlassModalContent,
  GlassModalHeader,
  GlassModalTitle,
  GlassModalDescription,
  GlassModalTrigger,
} from "@/components/ui/glass/GlassModal";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getProfessionLayout } from "@/lib/passport/professionProfiles";
import { targetsFor, type ShareTargetMeta } from "@/lib/passport/shareTargets";

interface Props {
  userId: string;
  profile: { full_name?: string | null; role?: string | null; sub_roles?: string[] | null; passport_profession?: string | null };
  /** Whether the user has a paid plan — controls Site availability. */
  canPublishSite?: boolean;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Profession-aware share modal. Centered Liquid Glass dialog (focus trap +
 * Escape-close via Radix) listing share targets ordered by what makes the
 * user bookable — comp card for models, EPK for musicians, reel for
 * filmmakers, etc.
 */
export const PassportShareSheet = ({
  userId,
  profile,
  canPublishSite = false,
  trigger,
  defaultOpen,
  onOpenChange,
}: Props) => {
  const layout = useMemo(() => getProfessionLayout(profile), [profile]);
  const targets = useMemo(() => targetsFor(layout.shareTargets), [layout]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrOpenId, setQrOpenId] = useState<string | null>(null);

  const copy = async (t: ShareTargetMeta, silent = false) => {
    try {
      await navigator.clipboard.writeText(t.href(userId));
      if (!silent) {
        setCopiedId(t.id);
        setTimeout(() => setCopiedId(null), 1500);
      }
      toast({ title: "Link copied", description: t.label });
      return true;
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
      return false;
    }
  };

  const nativeShare = async (t: ShareTargetMeta) => {
    const url = t.href(userId);
    const title = profile.full_name ? `${profile.full_name} — ${t.shortLabel}` : t.label;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user canceled */
      }
    }
    void copy(t);
  };

  const shareViaInstagram = async (t: ShareTargetMeta) => {
    // Instagram has no web share-intent URL for arbitrary links — copy and
    // guide the user, rather than fabricating a link that would silently fail.
    const ok = await copy(t, true);
    if (ok) {
      toast({ title: "Link copied for Instagram", description: "Paste it into your bio or a Story." });
    }
  };

  const whatsapp = (t: ShareTargetMeta) =>
    `https://wa.me/?text=${encodeURIComponent(`${profile.full_name ?? "Passport"} — ${t.label}: ${t.href(userId)}`)}`;
  const email = (t: ShareTargetMeta) =>
    `mailto:?subject=${encodeURIComponent(profile.full_name ?? "Creative Passport")}&body=${encodeURIComponent(t.href(userId))}`;
  const linkedin = (t: ShareTargetMeta) =>
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(t.href(userId))}`;
  const twitter = (t: ShareTargetMeta) =>
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(t.href(userId))}&text=${encodeURIComponent(
      profile.full_name ? `${profile.full_name} — ${t.label}` : t.label,
    )}`;

  return (
    <GlassModal open={defaultOpen} onOpenChange={onOpenChange}>
      {trigger && <GlassModalTrigger asChild>{trigger}</GlassModalTrigger>}
      <GlassModalContent className="sm:max-w-md">
        <GlassModalHeader>
          <GlassModalTitle>Share your {layout.label}</GlassModalTitle>
          <GlassModalDescription>{layout.tagline}</GlassModalDescription>
        </GlassModalHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-0.5">
          {targets.map((t) => {
            const locked = t.paidOnly && !canPublishSite;
            const qrOpen = qrOpenId === t.id;
            return (
              <div key={t.id} className="rounded-xl border border-border/60 bg-card p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    {locked ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{t.label}</h4>
                      {t.paidOnly && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {canPublishSite ? "Paid" : "Upgrade"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </div>

                {!locked ? (
                  <>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button size="icon" variant="default" onClick={() => nativeShare(t)} className="h-8 w-8" aria-label={`Share ${t.label}`}>
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => copy(t)} className="h-8 w-8" aria-label={`Copy link to ${t.label}`}>
                        {copiedId === t.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <a href={whatsapp(t)} target="_blank" rel="noreferrer" aria-label={`Share ${t.label} on WhatsApp`}>
                        <Button size="icon" variant="outline" className="h-8 w-8" tabIndex={-1}>
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <a href={linkedin(t)} target="_blank" rel="noreferrer" aria-label={`Share ${t.label} on LinkedIn`}>
                        <Button size="icon" variant="outline" className="h-8 w-8" tabIndex={-1}>
                          <Linkedin className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <a href={twitter(t)} target="_blank" rel="noreferrer" aria-label={`Share ${t.label} on X`}>
                        <Button size="icon" variant="outline" className="h-8 w-8" tabIndex={-1}>
                          <Twitter className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <Button size="icon" variant="outline" onClick={() => shareViaInstagram(t)} className="h-8 w-8" aria-label={`Copy link for Instagram — ${t.label}`}>
                        <Instagram className="h-3.5 w-3.5" />
                      </Button>
                      <a href={email(t)} aria-label={`Share ${t.label} by email`}>
                        <Button size="icon" variant="outline" className="h-8 w-8" tabIndex={-1}>
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                      <Button
                        size="icon"
                        variant={qrOpen ? "default" : "outline"}
                        onClick={() => setQrOpenId(qrOpen ? null : t.id)}
                        className="h-8 w-8"
                        aria-label={`${qrOpen ? "Hide" : "Show"} QR code for ${t.label}`}
                        aria-expanded={qrOpen}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {qrOpen && (
                      <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background p-3">
                        <QRCodeSVG value={t.href(userId)} size={128} level="M" marginSize={2} title={`QR code for ${t.label}`} />
                        <p className="text-[11px] text-muted-foreground text-center">Scan to open {t.shortLabel.toLowerCase()}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-3">
                    <a href="/subscription">
                      <Button size="sm" variant="default" className="h-8">
                        Upgrade to publish
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassModalContent>
    </GlassModal>
  );
};
