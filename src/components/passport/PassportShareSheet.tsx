import { useMemo, useState } from "react";
import {
  Copy, Check, Share2, Mail, MessageCircle, Globe, Lock, Linkedin, Twitter, Instagram, QrCode, ChevronDown,
  UserRound, FileText, IdCard, Clapperboard, Newspaper, Receipt, Users, FileDown, type LucideIcon,
} from "lucide-react";
import { KretopiaQRCode } from "@/components/brand/KretopiaQRCode";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { getProfessionLayout, type ShareTarget } from "@/lib/passport/professionProfiles";
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

/** One glyph per target, so the EPK, the website and the rest are told apart at a glance (they all used a globe). */
const TARGET_ICONS: Record<ShareTarget, LucideIcon> = {
  profile: UserRound,
  epk: FileText,
  compcard: IdCard,
  reel: Clapperboard,
  press: Newspaper,
  rate: Receipt,
  rollcall: Users,
  portfolio_pdf: FileDown,
  site: Globe,
};

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
            const Icon = locked ? Lock : TARGET_ICONS[t.id] ?? Globe;
            const channel = "h-14 flex-col gap-1 px-1 text-xs font-medium";
            return (
              <section key={t.id} aria-labelledby={`share-target-${t.id}`} className="rounded-xl border border-border/60 bg-card p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <h4 id={`share-target-${t.id}`} className="text-sm font-semibold">{t.label}</h4>
                      {t.paidOnly && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {canPublishSite ? "Paid" : "Upgrade"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </div>

                {!locked ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="default" className="h-10 gap-1.5 px-2" onClick={() => nativeShare(t)} aria-label={`Share ${t.label}`}>
                        <Share2 className="h-4 w-4" aria-hidden />
                        Share
                      </Button>
                      <Button variant="outline" className="h-10 gap-1.5 px-2" onClick={() => copy(t)} aria-label={`Copy link to ${t.label}`}>
                        {copiedId === t.id ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                        {copiedId === t.id ? "Copied" : "Copy link"}
                      </Button>
                    </div>

                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="group h-10 w-full justify-between text-xs">
                          More ways to share
                          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <Button asChild variant="outline" className={channel}>
                            <a href={whatsapp(t)} target="_blank" rel="noreferrer" aria-label={`Share ${t.label} on WhatsApp`}>
                              <MessageCircle className="h-4 w-4" aria-hidden />
                              WhatsApp
                            </a>
                          </Button>
                          <Button asChild variant="outline" className={channel}>
                            <a href={linkedin(t)} target="_blank" rel="noreferrer" aria-label={`Share ${t.label} on LinkedIn`}>
                              <Linkedin className="h-4 w-4" aria-hidden />
                              LinkedIn
                            </a>
                          </Button>
                          <Button asChild variant="outline" className={channel}>
                            <a href={twitter(t)} target="_blank" rel="noreferrer" aria-label={`Share ${t.label} on X`}>
                              <Twitter className="h-4 w-4" aria-hidden />
                              X
                            </a>
                          </Button>
                          <Button variant="outline" className={channel} onClick={() => shareViaInstagram(t)} aria-label={`Copy link for Instagram: ${t.label}`}>
                            <Instagram className="h-4 w-4" aria-hidden />
                            Instagram
                          </Button>
                          <Button asChild variant="outline" className={channel}>
                            <a href={email(t)} aria-label={`Share ${t.label} by email`}>
                              <Mail className="h-4 w-4" aria-hidden />
                              Email
                            </a>
                          </Button>
                          <Button
                            variant={qrOpen ? "default" : "outline"}
                            className={channel}
                            onClick={() => setQrOpenId(qrOpen ? null : t.id)}
                            aria-label={`${qrOpen ? "Hide" : "Show"} QR code for ${t.label}`}
                            aria-expanded={qrOpen}
                          >
                            <QrCode className="h-4 w-4" aria-hidden />
                            QR code
                          </Button>
                        </div>

                        {qrOpen && (
                          <div className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-background p-3">
                            <div role="img" aria-label={`QR code for ${t.label}`}>
                              <KretopiaQRCode data={t.href(userId)} size={128} />
                            </div>
                            <p className="text-center text-[11px] text-muted-foreground">Scan to open {t.shortLabel.toLowerCase()}</p>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ) : (
                  <div className="mt-3">
                    <Button asChild size="sm" variant="default" className="h-9">
                      <a href="/subscription">Upgrade to publish</a>
                    </Button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </GlassModalContent>
    </GlassModal>
  );
};
