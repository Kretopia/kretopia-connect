import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, Copy, Megaphone, ExternalLink } from "lucide-react";

interface Application {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  primary_platform: string | null;
  audience_size: string | null;
  social_links: any;
  niche: string | null;
  pitch: string | null;
  status: "pending" | "approved" | "rejected" | string;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface AmbassadorRow {
  user_id: string;
  full_name: string | null;
  ambassador_code: string | null;
  referral_count: number;
}

const STATUS_TABS: { key: "pending" | "approved" | "rejected"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function AmbassadorsTab() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [apps, setApps] = useState<Application[]>([]);
  const [ambassadors, setAmbassadors] = useState<AmbassadorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: appData, error: appErr }, { data: ambData }] = await Promise.all([
        supabase
          .from("ambassador_applications")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("user_id, full_name, ambassador_code")
          .not("ambassador_code", "is", null),
      ]);
      if (appErr) throw appErr;
      setApps((appData || []) as Application[]);

      // Fetch counts per ambassador code
      const codes = (ambData || []).map((a: any) => a.ambassador_code).filter(Boolean);
      let counts: Record<string, number> = {};
      if (codes.length) {
        const { data: refs } = await supabase
          .from("profiles")
          .select("referred_by_ambassador")
          .in("referred_by_ambassador", codes);
        (refs || []).forEach((r: any) => {
          if (r.referred_by_ambassador) {
            counts[r.referred_by_ambassador] = (counts[r.referred_by_ambassador] || 0) + 1;
          }
        });
      }
      setAmbassadors(
        ((ambData || []) as any[]).map((a) => ({
          user_id: a.user_id,
          full_name: a.full_name,
          ambassador_code: a.ambassador_code,
          referral_count: counts[a.ambassador_code] || 0,
        }))
      );
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (app: Application, status: "approved" | "rejected") => {
    setBusyId(app.id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ambassador_applications")
        .update({
          status,
          review_notes: notes[app.id] || null,
          reviewed_by: auth.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", app.id);
      if (error) throw error;
      toast({
        title: status === "approved" ? "Ambassador approved" : "Application rejected",
        description: status === "approved"
          ? "Code minted automatically. They'll see their dashboard at /ambassador."
          : "They have been marked as rejected.",
      });
      await load();
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = (code: string) => {
    const url = `https://www.kretopia.com/?amb=${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: url });
  };

  const filtered = apps.filter((a) => a.status === tab);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Ambassador Program
          </CardTitle>
          <CardDescription>
            Review applications submitted at{" "}
            <a href="/ambassadors" target="_blank" rel="noopener" className="underline">
              /ambassadors
            </a>
            . Approving auto-mints a 6-digit code and grants Lifetime Creator+.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {STATUS_TABS.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={tab === t.key ? "default" : "outline"}
                onClick={() => setTab(t.key)}
              >
                {t.label}{" "}
                <Badge variant="secondary" className="ml-2">
                  {apps.filter((a) => a.status === t.key).length}
                </Badge>
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No {tab} applications.</p>
          ) : (
            <div className="space-y-4">
              {filtered.map((app) => (
                <Card key={app.id} className="border-muted">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{app.full_name}</div>
                        <div className="text-xs text-muted-foreground">{app.email}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(app.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {app.primary_platform && <Badge variant="outline">{app.primary_platform}</Badge>}
                        {app.audience_size && <Badge variant="outline">{app.audience_size}</Badge>}
                        {app.niche && <Badge variant="outline">{app.niche}</Badge>}
                      </div>
                    </div>
                    {app.pitch && (
                      <div className="text-sm bg-muted/50 rounded p-3 whitespace-pre-wrap">{app.pitch}</div>
                    )}
                    {app.social_links && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {Object.entries(app.social_links as Record<string, string>).map(([k, v]) =>
                          v ? (
                            <a
                              key={k}
                              href={v.startsWith("http") ? v : `https://${v}`}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex items-center gap-1 underline text-primary"
                            >
                              {k} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null
                        )}
                      </div>
                    )}

                    {tab === "pending" && (
                      <>
                        <Textarea
                          placeholder="Internal review notes (optional)"
                          value={notes[app.id] || ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [app.id]: e.target.value }))}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={busyId === app.id}
                            onClick={() => decide(app, "approved")}
                          >
                            {busyId === app.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-1" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === app.id}
                            onClick={() => decide(app, "rejected")}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </>
                    )}
                    {tab !== "pending" && app.review_notes && (
                      <p className="text-xs text-muted-foreground italic">Notes: {app.review_notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Ambassadors</CardTitle>
          <CardDescription>Live referral counts. Click to copy their share link.</CardDescription>
        </CardHeader>
        <CardContent>
          {ambassadors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No ambassadors yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Referrals</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambassadors
                  .sort((a, b) => b.referral_count - a.referral_count)
                  .map((a) => (
                    <TableRow key={a.user_id}>
                      <TableCell>{a.full_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.ambassador_code}</Badge>
                      </TableCell>
                      <TableCell>{a.referral_count}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => copyLink(a.ambassador_code!)}>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
