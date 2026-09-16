import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, Target, QrCode, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InviteDialog = ({ open, onOpenChange }: InviteDialogProps) => {
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const { toast } = useToast();

  const primaryInvite = inviteCodes.find(i => i.current_uses < i.max_uses) || inviteCodes[0];
  const personalLink = primaryInvite ? `https://www.kretopia.com/join/${primaryInvite.invite_code}` : null;
  const totalUsed = inviteCodes.reduce((sum: number, i: any) => sum + (i.current_uses || 0), 0);
  const totalSlots = inviteCodes.reduce((sum: number, i: any) => sum + (i.max_uses || 0), 0);

  useEffect(() => {
    if (open) {
      fetchInviteCodes();
    }
  }, [open]);

  const fetchInviteCodes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('invites')
      .select('*')
      .eq('inviter_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    setInviteCodes(data || []);
  };

  const copyLink = async () => {
    if (!personalLink) return;
    try {
      const inviteMessage = `Stop cold DMing strangers for collabs.

Kretopia matches you with verified creatives who actually fit your style — portfolio-first, style-aware.

I'm already on. Join me 👇
${personalLink}`;
      
      await navigator.clipboard.writeText(inviteMessage);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Your personal invite link copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy invite link",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Invite Link</DialogTitle>
          <DialogDescription>
            Invite creatives to grow your Creative Circle and unlock tier rewards
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {!personalLink ? (
            <Card className="p-8 text-center">
              <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No invite link available yet</p>
            </Card>
          ) : (
            <>
              {/* Personal Link Card */}
              <Card className="p-4">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    Your personal invite link
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-secondary/50 px-3 py-2 rounded flex-1 truncate">
                      {personalLink.replace('https://', '')}
                    </code>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowQRCode(!showQRCode)}
                      className="gap-2 flex-1"
                    >
                      <QrCode className="h-4 w-4" />
                      QR Code
                    </Button>
                    <Button
                      size="sm"
                      onClick={copyLink}
                      className="gap-2 flex-1"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </Button>
                  </div>
                  
                  {showQRCode && (
                    <div className="flex flex-col items-center gap-3 pt-3 border-t border-border">
                      <div className="bg-white p-4 rounded-lg">
                        <QRCodeSVG
                          value={personalLink}
                          size={200}
                          level="H"
                          includeMargin
                        />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        Scan to join Kretopia via your link
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm px-1">
                <span className="text-muted-foreground">Signups from your link</span>
                <Badge variant="secondary">{totalUsed} / {totalSlots}</Badge>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
