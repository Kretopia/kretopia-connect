import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, CameraOff, CheckCircle, Search, Users, Loader2, Ticket, Radio } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Attendee {
  id: string;
  kind: "participant" | "guest";
  user_id?: string | null;
  check_in_token: string;
  checked_in_at: string | null;
  joined_at: string;
  display_name: string;
  username?: string | null;
  avatar_url?: string | null;
  email?: string | null;
}

interface EventCheckInDialogProps {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EventCheckInDialog = ({ eventId, eventTitle, open, onOpenChange }: EventCheckInDialogProps) => {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualToken, setManualToken] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [recentlyChangedId, setRecentlyChangedId] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "qr-reader";
  const lastScannedRef = useRef<string>("");
  const { toast } = useToast();

  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: tokenRows, error: tokErr },
        { data: pData, error: pErr },
        { data: gData, error: gErr },
      ] = await Promise.all([
        supabase.rpc('get_event_check_in_tokens', { _jam_id: eventId }),
        supabase
          .from('jam_participants')
          .select('id, user_id, checked_in_at, status, joined_at')
          .eq('jam_id', eventId)
          .eq('status', 'going'),
        supabase
          .from('guest_rsvps')
          .select('id, guest_name, guest_email, check_in_token, checked_in_at, created_at')
          .eq('event_id', eventId),
      ]);

      if (pErr) throw pErr;
      if (tokErr) throw tokErr;
      if (gErr) throw gErr;

      const tokenMap = new Map<string, string>(
        ((tokenRows as { user_id: string; check_in_token: string }[]) || [])
          .map(r => [r.user_id, r.check_in_token])
      );

      const userIds = (pData || []).map(p => p.user_id);
      const { data: profiles } = userIds.length
        ? await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url, username')
            .in('user_id', userIds)
        : { data: [] as any[] };

      const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.user_id, p] as [string, any]));

      const participants: Attendee[] = (pData || []).map((p: any) => {
        const prof: any = profileMap.get(p.user_id);
        return {
          id: `p:${p.id}`,
          kind: 'participant',
          user_id: p.user_id,
          check_in_token: tokenMap.get(p.user_id) || '',
          checked_in_at: p.checked_in_at,
          joined_at: p.joined_at,
          display_name: prof?.full_name || 'Unknown',
          username: prof?.username,
          avatar_url: prof?.avatar_url,
        };
      });

      const guests: Attendee[] = (gData || []).map((g: any) => ({
        id: `g:${g.id}`,
        kind: 'guest',
        check_in_token: g.check_in_token || '',
        checked_in_at: g.checked_in_at,
        joined_at: g.created_at,
        display_name: g.guest_name || 'Guest',
        email: g.guest_email,
      }));

      setAttendees([...participants, ...guests]);
    } catch (err) {
      console.error('Error fetching attendees:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (open) fetchAttendees();
  }, [open, fetchAttendees]);

  // Realtime subscription — live updates for participants + guests
  useEffect(() => {
    if (!open) return;

    const flash = (id: string) => {
      setRecentlyChangedId(id);
      setTimeout(() => setRecentlyChangedId(prev => (prev === id ? null : prev)), 2500);
    };

    const channel = supabase
      .channel(`event-checkin:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jam_participants', filter: `jam_id=eq.${eventId}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          const id = `p:${row.id}`;
          if (payload.eventType === 'DELETE') {
            setAttendees(prev => prev.filter(a => a.id !== id));
            return;
          }
          // Refetch to pick up profile + token for new rows
          fetchAttendees();
          flash(id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guest_rsvps', filter: `event_id=eq.${eventId}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          const id = `g:${row.id}`;
          if (payload.eventType === 'DELETE') {
            setAttendees(prev => prev.filter(a => a.id !== id));
            return;
          }
          setAttendees(prev => {
            const next: Attendee = {
              id,
              kind: 'guest',
              check_in_token: row.check_in_token || '',
              checked_in_at: row.checked_in_at,
              joined_at: row.created_at,
              display_name: row.guest_name || 'Guest',
              email: row.guest_email,
            };
            const idx = prev.findIndex(a => a.id === id);
            if (idx === -1) return [...prev, next];
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...next };
            return copy;
          });
          flash(id);
        }
      )
      .subscribe(status => {
        setLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      setLiveConnected(false);
      supabase.removeChannel(channel);
    };
  }, [open, eventId, fetchAttendees]);

  // Cleanup scanner when dialog closes
  useEffect(() => {
    if (!open && scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
      setScannerReady(false);
      setScanning(false);
    }
  }, [open]);

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      setScanning(true);
      setScannerReady(false);
      await new Promise(r => setTimeout(r, 200));
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1 },
        (decodedText: string) => {
          if (decodedText === lastScannedRef.current) return;
          lastScannedRef.current = decodedText;
          checkInByToken(decodedText.trim());
          setTimeout(() => { lastScannedRef.current = ""; }, 3000);
        },
        () => {}
      );
      setScannerReady(true);
    } catch (err: any) {
      console.error("Scanner error:", err);
      setScanning(false);
      toast({
        title: "Camera unavailable",
        description: err?.message?.includes("NotAllowed")
          ? "Please allow camera access in your browser settings."
          : "Could not start camera. Try pasting the code manually.",
        variant: "destructive",
      });
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
    setScannerReady(false);
  };

  const checkInByToken = async (rawToken: string) => {
    const token = (rawToken || "").trim();
    if (!token) return;
    setCheckingIn(token);
    try {
      // 1) Registered participant fast-path
      const participant = attendees.find(a => a.kind === 'participant' && a.check_in_token === token);
      if (participant) {
        if (participant.checked_in_at) {
          toast({ title: "Already checked in", description: `${participant.display_name} was already checked in.` });
          return;
        }
        const realId = participant.id.replace(/^p:/, '');
        const { error } = await supabase
          .from('jam_participants')
          .update({ checked_in_at: new Date().toISOString() })
          .eq('id', realId);
        if (error) throw error;
        setAttendees(prev =>
          prev.map(a => a.id === participant.id ? { ...a, checked_in_at: new Date().toISOString() } : a)
        );
        toast({ title: "Checked in", description: `${participant.display_name} is now checked in.` });
        return;
      }

      // 2) Guest pass fallback — host-only RPC redeems guest_rsvps token
      const { data, error } = await (supabase as any).rpc('check_in_guest_by_token', {
        p_event_id: eventId,
        p_token: token,
      });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("no matching")) {
          toast({ title: "Invalid pass", description: "This QR doesn't match anyone for this event.", variant: "destructive" });
        } else if (msg.includes("only the event host")) {
          toast({ title: "Host only", description: "Only the event host can check in guests.", variant: "destructive" });
        } else {
          toast({ title: "Couldn't check in", description: error.message || "Try again.", variant: "destructive" });
        }
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        toast({ title: "Invalid pass", description: "No matching guest pass for this event.", variant: "destructive" });
        return;
      }
      if (row.was_already_checked_in) {
        toast({ title: "Already checked in", description: `${row.guest_name || 'Guest'} was already in.` });
      } else {
        toast({ title: "Guest checked in", description: `${row.guest_name || 'Guest'} (${row.guest_email}) is in.` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to check in. Please try again.", variant: "destructive" });
    } finally {
      setCheckingIn(null);
      setManualToken("");
    }
  };

  const checkInById = async (attendeeId: string) => {
    const att = attendees.find(a => a.id === attendeeId);
    if (!att) return;
    setCheckingIn(attendeeId);
    try {
      if (att.kind === 'participant') {
        const realId = att.id.replace(/^p:/, '');
        const { error } = await supabase
          .from('jam_participants')
          .update({ checked_in_at: new Date().toISOString() })
          .eq('id', realId);
        if (error) throw error;
      } else {
        if (!att.check_in_token) {
          toast({ title: "No token", description: "This guest has no check-in token.", variant: "destructive" });
          return;
        }
        const { error } = await (supabase as any).rpc('check_in_guest_by_token', {
          p_event_id: eventId,
          p_token: att.check_in_token,
        });
        if (error) throw error;
      }
      setAttendees(prev =>
        prev.map(a => a.id === attendeeId ? { ...a, checked_in_at: new Date().toISOString() } : a)
      );
      toast({ title: "Checked in", description: `${att.display_name} is now checked in.` });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to check in.", variant: "destructive" });
    } finally {
      setCheckingIn(null);
    }
  };

  const checkedInCount = attendees.filter(a => a.checked_in_at).length;

  // Sort: checked-in last, most recently changed first within each group
  const sortedAttendees = [...attendees].sort((a, b) => {
    const aIn = a.checked_in_at ? 1 : 0;
    const bIn = b.checked_in_at ? 1 : 0;
    if (aIn !== bIn) return aIn - bIn;
    return (b.joined_at || '').localeCompare(a.joined_at || '');
  });

  const filteredAttendees = sortedAttendees.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.display_name.toLowerCase().includes(q) ||
      (a.username || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Check-In: {eventTitle}</DialogTitle>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {checkedInCount}/{attendees.length} checked in
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${liveConnected ? 'text-emerald-600 border-emerald-200' : 'text-muted-foreground'}`}
            >
              <Radio className={`h-3 w-3 mr-1 ${liveConnected ? 'animate-pulse' : ''}`} />
              {liveConnected ? 'Live' : 'Connecting…'}
            </Badge>
          </div>
        </DialogHeader>

        {/* QR Scanner */}
        <div className="space-y-2">
          <Button
            variant={scanning ? "outline" : "gradient"}
            className="w-full gap-2"
            onClick={scanning ? stopScanner : startScanner}
          >
            {scanning ? (
              <><CameraOff className="h-4 w-4" /> Stop Scanner</>
            ) : (
              <><Camera className="h-4 w-4" /> Scan QR Code</>
            )}
          </Button>

          {scanning && (
            <div className="relative rounded-xl overflow-hidden border border-border bg-black">
              <div id={scannerContainerId} className="w-full" />
              {!scannerReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual Token Entry */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Or paste token manually</label>
          <div className="flex gap-2">
            <Input
              placeholder="Paste check-in token..."
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && manualToken.trim()) checkInByToken(manualToken.trim());
              }}
              className="text-sm"
            />
            <Button
              size="sm"
              disabled={!manualToken.trim() || !!checkingIn}
              onClick={() => checkInByToken(manualToken.trim())}
            >
              {checkingIn === manualToken ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search attendees or guests..."
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Attendee List */}
        <ScrollArea className="max-h-[35vh]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAttendees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No attendees yet</p>
          ) : (
            <div className="space-y-2 pr-1">
              {filteredAttendees.map(a => {
                const isFlashing = recentlyChangedId === a.id;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border bg-card transition-all ${
                      isFlashing
                        ? 'border-primary ring-2 ring-primary/30 shadow-sm'
                        : 'border-border/50'
                    }`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={a.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {(a.display_name || '?')[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{a.display_name}</p>
                        {a.kind === 'guest' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                            <Ticket className="h-2.5 w-2.5 mr-0.5" />
                            Guest
                          </Badge>
                        )}
                      </div>
                      {a.username && (
                        <p className="text-xs text-muted-foreground truncate">@{a.username}</p>
                      )}
                      {!a.username && a.email && (
                        <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                      )}
                    </div>
                    {a.checked_in_at ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs shrink-0 hover:bg-emerald-100">
                        <CheckCircle className="h-3 w-3 mr-1" /> In
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 shrink-0 px-3"
                        disabled={!!checkingIn}
                        onClick={() => checkInById(a.id)}
                      >
                        {checkingIn === a.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Check In"
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
