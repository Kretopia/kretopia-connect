import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Link2, Copy, Check, Upload, Send, Users, MessageSquare, Share2,
} from "lucide-react";

interface CircleInviteToolsProps {
  circleId: string;
  circleTitle: string;
  inviteCode: string | null;
}

export const CircleInviteTools = ({ circleId, circleTitle, inviteCode }: CircleInviteToolsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const inviteLink = `https://www.kretopia.com/circle/${circleId}`;

  const copyLink = async () => {
    const text = `Join "${circleTitle}" on Kretopia\n${inviteLink}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied!" });
  };

  const shareNative = async () => {
    if (navigator.share) {
      await navigator.share({
        title: circleTitle,
        text: `Join "${circleTitle}" on Kretopia — where creatives connect and collaborate`,
        url: inviteLink,
      });
    } else {
      copyLink();
    }
  };

  const sendEmailInvites = async () => {
    if (!emails.trim()) return;
    setSending(true);
    const emailList = emails.split(/[,;\n]/).map(e => e.trim()).filter(e => e.includes("@"));
    try {
      await supabase.functions.invoke("send-circle-invite", {
        body: { circleId, emails: emailList, circleTitle },
      });
      toast({ title: `${emailList.length} invite(s) sent!` });
      setEmails("");
    } catch {
      toast({ title: "Some invites failed", variant: "destructive" });
    }
    setSending(false);
  };

  const handleCSVImport = async () => {
    if (!csvFile) return;
    setImporting(true);
    try {
      const text = await csvFile.text();
      const lines = text.split("\n").slice(1); // skip header
      const contacts = lines
        .map(line => {
          const parts = line.split(",").map(p => p.trim().replace(/"/g, ""));
          return { name: parts[0], email: parts[1] };
        })
        .filter(c => c.email?.includes("@"));

      if (contacts.length === 0) {
        toast({ title: "No valid emails found in CSV", variant: "destructive" });
        setImporting(false);
        return;
      }

      await supabase.functions.invoke("send-circle-invite", {
        body: { circleId, emails: contacts.map(c => c.email), circleTitle },
      });
      toast({ title: `${contacts.length} invites sent from CSV!` });
      setCsvFile(null);
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      {/* Share link */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Invite Link</h4>
        </div>
        <div className="flex gap-2">
          <Input value={inviteLink} readOnly className="text-xs bg-muted/50 font-mono" />
          <Button size="icon" variant="outline" onClick={copyLink} className="shrink-0" aria-label={copied ? "Link copied" : "Copy invite link"}>
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={shareNative}>
          <Share2 className="h-3.5 w-3.5" /> Share via WhatsApp, Telegram, etc.
        </Button>
      </Card>

      {/* Email invites */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Email Invites</h4>
        </div>
        <Textarea
          placeholder={"Enter emails (comma or newline separated)\njohn@example.com\njane@example.com"}
          value={emails}
          onChange={e => setEmails(e.target.value)}
          className="min-h-[80px] text-sm"
        />
        <Button size="sm" className="w-full" onClick={sendEmailInvites} disabled={!emails.trim() || sending}>
          {sending ? "Sending..." : "Send Invites"}
        </Button>
      </Card>

      {/* CSV Import */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Import from CSV</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload a CSV with columns: Name, Email. Perfect for migrating WhatsApp or Telegram groups.
        </p>
        <Input
          type="file"
          accept=".csv"
          onChange={e => setCsvFile(e.target.files?.[0] || null)}
          className="text-xs"
        />
        {csvFile && (
          <Button size="sm" className="w-full" onClick={handleCSVImport} disabled={importing}>
            {importing ? "Importing..." : `Import from ${csvFile.name}`}
          </Button>
        )}
      </Card>

      {/* Quick tips */}
      <Card className="p-4 border-primary/10 bg-primary/5">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-primary" />
          Migration Tips
        </h4>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li>• Export your WhatsApp group → use "Export chat" → extract contacts</li>
          <li>• Share the invite link directly in your existing groups</li>
          <li>• CSV format: Name, Email (one per row)</li>
          <li>• Invitees get a branded email with one-click join</li>
        </ul>
      </Card>
    </div>
  );
};
