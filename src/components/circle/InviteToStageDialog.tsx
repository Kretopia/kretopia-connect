import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, Send, Link2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stageId: string;
  stageTitle: string;
  inviteToken?: string | null;
  visibility?: "public" | "unlisted" | "private";
}

const APP_URL = "https://www.kretopia.com";

/**
 * Host-only — invite people to a private/unlisted curated stage by email
 * or by sharing the magic link.
 */
export function InviteToStageDialog({
  open, onOpenChange, stageId, stageTitle, inviteToken, visibility = "private",
}: Props) {
  const { toast } = useToast();
  const [emailsRaw, setEmailsRaw] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const shareUrl = useMemo(() => {
    if (!inviteToken) return `${APP_URL}/circle/stage/${stageId}`;
    return `${APP_URL}/circle/stage/${stageId}?invite=${inviteToken}`;
  }, [stageId, inviteToken]);

  const emails = useMemo(
    () => emailsRaw
      .split(/[,\s\n;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    [emailsRaw],
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  };

  const sendInvites = async () => {
    if (!emails.length) {
      toast({ title: "Add at least one email", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-to-stage", {
        body: { stage_id: stageId, emails, note: note.trim() || undefined },
      });
      if (error) throw error;
      toast({
        title: `Invited ${data?.invited ?? emails.length}`,
        description: "They'll get a magic link by email.",
      });
      setEmailsRaw("");
      setNote("");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't send invites", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Invite to "{stageTitle}"</DialogTitle>
          <DialogDescription>
            {visibility === "private"
              ? "Anyone you invite — by email or with this link — can join. Others will be turned away."
              : "Anyone with the link can join."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Magic link */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shareable link</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-muted/50 text-xs truncate font-mono">
                {shareUrl}
              </div>
              <Button size="icon" variant="outline" onClick={copyLink} aria-label="Copy link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Link2 className="h-3 w-3" /> Works for anyone you send it to.
            </p>
          </div>

          {visibility === "private" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="invite-emails" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Or invite by email
                </Label>
                <Textarea
                  id="invite-emails"
                  value={emailsRaw}
                  onChange={(e) => setEmailsRaw(e.target.value)}
                  placeholder="aaliyah@example.com, brent@example.com, maya@example.com"
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground">
                  Separate with commas or new lines. {emails.length > 0 && <span className="text-foreground font-semibold">{emails.length} valid</span>}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-note" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Personal note (optional)
                </Label>
                <Input
                  id="invite-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Loved your last reel — want to hear you live."
                  maxLength={500}
                />
              </div>

              <Button onClick={sendInvites} disabled={sending || !emails.length} className="w-full" size="lg">
                {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : <><Send className="h-4 w-4 mr-2" /> Send {emails.length || ""} invite{emails.length === 1 ? "" : "s"}</>}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
