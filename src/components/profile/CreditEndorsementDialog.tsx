import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Search, Loader2, ShieldCheck, Mail, MessageCircle, Copy, Check, UserPlus } from "lucide-react";
import { getShareUrl } from "@/lib/constants";
import { escapePostgrestValue } from "@/lib/postgrestFilter";

interface Credit {
  id: string;
  project_name: string;
  role: string;
  year?: number;
}

interface CreditEndorsementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: Credit;
  userId: string;
  requesterName?: string;
}

export function CreditEndorsementDialog({ open, onOpenChange, credit, userId, requesterName }: CreditEndorsementDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('collaborator');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifyLink, setVerifyLink] = useState('');
  const [copied, setCopied] = useState(false);

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const likeQ = escapePostgrestValue(`%${query}%`);
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, primary_role, username')
        .or(`full_name.ilike.${likeQ},username.ilike.${likeQ}`)
        .neq('user_id', userId)
        .limit(4);
      setSearchResults(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const createLink = async (endorserId?: string, endorserEmail?: string, endorserName?: string) => {
    setSending(true);
    try {
      const { data, error } = await supabase.from('credit_endorsements').insert({
        credit_id: credit.id,
        requested_by: userId,
        endorser_id: endorserId || null,
        endorser_email: endorserEmail || null,
        endorser_name: endorserName || name || null,
        relationship: relationship || null,
        status: 'pending',
      }).select('token').single();

      if (error) {
        if (error.code === '23505') {
          toast.error('You already sent a request to this person');
        } else {
          throw error;
        }
        return;
      }

      const link = data?.token ? getShareUrl(`/credit-verify?token=${encodeURIComponent(data.token)}`) : '';

      if (endorserId && !endorserEmail) {
        toast.success('Request sent!', { description: `${endorserName || 'They'} will see it in their inbox.` });
        onOpenChange(false);
        resetForm();
        return;
      }

      setVerifyLink(link);
      toast.success('Verify link ready — share it now');
    } catch (e: any) {
      console.error('Error creating verify link:', e);
      toast.error('Failed to create link');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setSearchQuery('');
    setSearchResults([]);
    setEmail('');
    setName('');
    setRelationship('collaborator');
    setVerifyLink('');
    setCopied(false);
  };

  const buildMessage = () => {
    const who = requesterName || 'I';
    const target = name.trim() ? `Hey ${name.trim().split(' ')[0]}, ` : '';
    return `${target}${who === 'I' ? 'I' : who} added you to my "${credit.project_name}" project on Kretopia (${credit.role}). Can you take 5 seconds to confirm we worked together?\n\n${verifyLink}\n\n(No account needed — one tap.)`;
  };

  const shareTargets = () => {
    if (!verifyLink) return null;
    const msg = buildMessage();
    const encoded = encodeURIComponent(msg);
    const emailSubject = encodeURIComponent(`Quick confirm: ${credit.project_name}`);
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1.5">Send now</p>
          <p className="text-xs text-muted-foreground break-all leading-relaxed">{msg}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white h-11"
            onClick={() => window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener')}
          >
            <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
          </Button>
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => window.open(`mailto:${email || ''}?subject=${emailSubject}&body=${encoded}`, '_self')}
          >
            <Mail className="h-4 w-4 mr-2" /> Email
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            navigator.clipboard.writeText(msg);
            setCopied(true);
            toast.success('Copied — paste anywhere');
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4 mr-2 text-primary" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copied' : 'Copy message + link'}
        </Button>

        <button
          className="text-[11px] text-white/60 hover:text-[#FF2DA1] w-full text-center underline transition-colors"
          onClick={resetForm}
        >
          Send to someone else
        </button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Get this verified
          </DialogTitle>
          <DialogDescription>
            One tap for them to confirm your <strong>{credit.role}</strong> on <strong>{credit.project_name}</strong>. No account required.
          </DialogDescription>
        </DialogHeader>

        {verifyLink ? (
          shareTargets()
        ) : (
          <div className="space-y-4">
            {/* Quick search — existing Kretopia users */}
            <div className="space-y-2">
              <Label className="text-xs">Search Kretopia users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-10"
                  placeholder="Name or @username"
                  value={searchQuery}
                  onChange={(e) => searchUsers(e.target.value)}
                />
              </div>
              {searching && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-border/60 p-1">
                  {searchResults.map((u) => (
                    <button
                      key={u.user_id}
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted/60 text-left"
                      onClick={() => createLink(u.user_id, undefined, u.full_name)}
                      disabled={sending}
                    >
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-medium">{u.full_name?.[0]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{u.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.primary_role || u.username}</p>
                      </div>
                      <Send className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-background px-2 text-muted-foreground">Or send outside Kretopia</span>
              </div>
            </div>

            {/* Guest — share to anyone */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Their name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="them@..." className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">How they know you</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborator">Collaborator / Co-worker</SelectItem>
                  <SelectItem value="client">Client / Hired me</SelectItem>
                  <SelectItem value="supervisor">Supervisor / Director</SelectItem>
                  <SelectItem value="producer">Producer</SelectItem>
                  <SelectItem value="guest">Guest / Attendee</SelectItem>
                  <SelectItem value="vendor">Vendor / Contractor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full h-10"
              onClick={() => createLink(undefined, email || undefined, name)}
              disabled={sending || !name.trim()}
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Create verify link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
