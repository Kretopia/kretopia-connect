import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle, Users, Gift, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";

interface InviteCode {
  id: string;
  invite_code: string;
  status: string;
  used_by: string | null;
  used_at: string | null;
  invitee_email: string | null;
  max_uses: number;
  current_uses: number;
}

export const InviteCodesCard = () => {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchInviteCodes();
  }, []);

  const fetchInviteCodes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("invites")
      .select("*")
      .eq("inviter_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load invite codes",
        variant: "destructive",
      });
    } else {
      setInviteCodes(data || []);
    }
    setLoading(false);
  };

  const copyToClipboard = async (code: string) => {
    try {
      const inviteUrl = `https://www.kretopia.com/auth?invite=${code}`;
      const inviteMessage = `Stop cold DMing strangers for collabs.

Kretopia matches you with verified creatives who actually fit your style — portfolio-first, style-aware.

I'm already on. Join me 👇
${inviteUrl}`;
      
      await navigator.clipboard.writeText(inviteMessage);
      setCopiedCode(code);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy invite link",
        variant: "destructive",
      });
    }
  };

  const availableInvites = inviteCodes.filter(
    (inv) => (inv.current_uses || 0) < (inv.max_uses || 1)
  ).length;

  const totalUsed = inviteCodes.reduce((acc, inv) => acc + (inv.current_uses || 0), 0);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold">Your Invite Codes</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Share these codes with friends to invite them to Kretopia
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            {availableInvites} available
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <CheckCircle className="h-3 w-3" />
            {totalUsed} total uses
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {inviteCodes.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <p className="text-sm">No invite codes available yet</p>
          </div>
        ) : (
          inviteCodes.map((invite) => (
            <div
              key={invite.id}
              className={`rounded-lg border p-3 sm:p-4 transition-colors ${
                (invite.current_uses || 0) >= (invite.max_uses || 1)
                  ? "bg-muted/50 border-muted"
                  : "bg-card border-primary/20 hover:border-primary/40"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <code className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-primary/10 text-primary rounded font-mono font-semibold text-base sm:text-lg flex-shrink-0">
                    {invite.invite_code}
                  </code>
                  {(invite.current_uses || 0) < (invite.max_uses || 1) && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQRCode(showQRCode === invite.invite_code ? null : invite.invite_code)}
                        className="gap-1.5"
                      >
                        <QrCode className="h-4 w-4" />
                        <span className="hidden sm:inline">QR</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(invite.invite_code)}
                        className="gap-1.5"
                      >
                        {copiedCode === invite.invite_code ? (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <span className="hidden sm:inline">Copy</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {(invite.max_uses || 1) > 1 && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      <Users className="h-3 w-3" />
                      Multi-use: {invite.current_uses || 0}/{invite.max_uses}
                    </Badge>
                  )}
                  {(invite.current_uses || 0) >= (invite.max_uses || 1) && (
                    <Badge variant="default" className="text-xs">
                      Fully Used
                    </Badge>
                  )}
                </div>

                {invite.invitee_email && invite.invitee_email.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {(invite.max_uses || 1) > 1 ? (
                      <p>{invite.current_uses || 0} people used this code</p>
                    ) : (
                      <>
                        <p>Used by {invite.invitee_email}</p>
                        {invite.used_at && (
                          <p className="mt-0.5">on {new Date(invite.used_at).toLocaleDateString()}</p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {showQRCode === invite.invite_code && (
                  <div className="flex flex-col items-center gap-3 pt-3 border-t border-border">
                    <div className="bg-white p-4 rounded-lg">
                      <QRCodeSVG
                        value={`https://www.kretopia.com/auth?invite=${invite.invite_code}`}
                        size={200}
                        level="H"
                        includeMargin
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Scan to join Kretopia with this invite code
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {availableInvites > 0 && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <strong>Pro Tip:</strong> Share your invite codes with fellow creators you know
            and trust. Each person who joins with your code strengthens the Kretopia community!
          </p>
        </div>
      )}
    </Card>
  );
};
