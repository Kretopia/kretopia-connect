import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DripAnalyticsPanel } from "./DripAnalyticsPanel";
import {
  Upload, Send, Loader2, FolderPlus, Play, Pause, BarChart3, Mail, Users, CheckCircle, XCircle, Clock
} from "lucide-react";

interface Segment {
  id: string;
  name: string;
  description: string | null;
  contact_count: number;
  created_at: string;
}

interface Campaign {
  id: string;
  segment_id: string;
  subject: string;
  body: string;
  cta_text: string;
  cta_url: string;
  status: string;
  daily_limit: number;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  last_batch_at: string | null;
  created_at: string;
  email_segments?: { name: string } | null;
}

export const DripCampaignTab = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Segment creation
  const [newSegmentName, setNewSegmentName] = useState("");
  const [newSegmentDesc, setNewSegmentDesc] = useState("");
  const [creatingSegment, setCreatingSegment] = useState(false);

  // CSV upload
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ imported: number; duplicates: number; total: number } | null>(null);

  // Campaign creation
  const [campaignSegmentId, setCampaignSegmentId] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignBody, setCampaignBody] = useState("");
  const [campaignCta, setCampaignCta] = useState("Visit Kretopia →");
  const [campaignCtaUrl, setCampaignCtaUrl] = useState("https://www.kretopia.com");
  const [campaignDailyLimit, setCampaignDailyLimit] = useState("95");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Processing
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-drip-campaign', {
        body: { action: 'get_stats' }
      });
      if (error) throw error;
      setSegments(data?.segments || []);
      setCampaigns(data?.campaigns || []);
    } catch (err: any) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const createSegment = async () => {
    if (!newSegmentName.trim()) return;
    setCreatingSegment(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-drip-campaign', {
        body: { action: 'create_segment', segment_name: newSegmentName.trim(), segment_description: newSegmentDesc.trim() }
      });
      if (error) throw error;
      toast({ title: "Segment Created", description: `"${newSegmentName}" is ready for contacts` });
      setNewSegmentName("");
      setNewSegmentDesc("");
      loadStats();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingSegment(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSegmentId) return;

    setUploading(true);
    setUploadStats(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());

      if (lines.length < 2) {
        toast({ title: "Error", description: "CSV must have a header row and at least one contact", variant: "destructive" });
        return;
      }

      const header = lines[0].toLowerCase();
      const emailIdx = header.split(',').findIndex(h => h.trim().includes('email'));
      const nameIdx = header.split(',').findIndex(h => h.trim().includes('name'));

      if (emailIdx === -1) {
        toast({ title: "Error", description: "CSV must have an 'email' column", variant: "destructive" });
        return;
      }

      const contacts = lines.slice(1).map(line => {
        // Handle quoted CSV fields
        const cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || line.split(',').map(c => c.trim());
        return {
          email: cols[emailIdx] || '',
          name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
        };
      }).filter(c => c.email && c.email.includes('@'));

      if (!contacts.length) {
        toast({ title: "Error", description: "No valid email addresses found in CSV", variant: "destructive" });
        return;
      }

      toast({ title: "Importing...", description: `Processing ${contacts.length} contacts` });

      // Send in batches of 2000 to avoid payload limits
      let totalImported = 0;
      let totalDupes = 0;
      const batchSize = 2000;

      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const { data, error } = await supabase.functions.invoke('process-drip-campaign', {
          body: { action: 'import_contacts', segment_id: selectedSegmentId, contacts: batch }
        });
        if (error) throw error;
        totalImported += data?.imported || 0;
        totalDupes += data?.duplicates || 0;
      }

      setUploadStats({ imported: totalImported, duplicates: totalDupes, total: contacts.length });
      toast({
        title: "Import Complete!",
        description: `${totalImported} imported, ${totalDupes} duplicates skipped`,
      });
      loadStats();
    } catch (err: any) {
      toast({ title: "Import Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const createCampaign = async () => {
    if (!campaignSegmentId || !campaignSubject.trim() || !campaignBody.trim()) {
      toast({ title: "Missing fields", description: "Segment, subject, and body are required", variant: "destructive" });
      return;
    }

    const segName = segments.find(s => s.id === campaignSegmentId)?.name;
    const confirmed = window.confirm(`Launch drip campaign to all contacts in "${segName}"? Emails will be sent in batches of ${campaignDailyLimit}/day.`);
    if (!confirmed) return;

    setCreatingCampaign(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-drip-campaign', {
        body: {
          action: 'create_campaign',
          segment_id: campaignSegmentId,
          subject: campaignSubject,
          email_body: campaignBody,
          cta_text: campaignCta,
          cta_url: campaignCtaUrl,
          daily_limit: parseInt(campaignDailyLimit),
        }
      });
      if (error) throw error;
      toast({ title: "Campaign Created!", description: `${data?.queued || 0} contacts queued. Run "Send Next Batch" to start.` });
      setCampaignSubject("");
      setCampaignBody("");
      loadStats();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingCampaign(false);
    }
  };

  const processBatch = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-drip-campaign', {
        body: { action: 'process_batch' }
      });
      if (error) throw error;
      toast({
        title: "Batch Processed!",
        description: `Sent: ${data?.sent || 0}, Failed: ${data?.failed || 0}`,
      });
      loadStats();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const toggleCampaign = async (campaignId: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'pause_campaign' : 'resume_campaign';
    try {
      await supabase.functions.invoke('process-drip-campaign', {
        body: { action, campaign_id: campaignId }
      });
      toast({ title: action === 'pause_campaign' ? "Campaign Paused" : "Campaign Resumed" });
      loadStats();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalContacts = segments.reduce((sum, s) => sum + s.contact_count, 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  return (
    <Tabs defaultValue="manage" className="space-y-4">
      <TabsList className="w-full">
        <TabsTrigger value="manage" className="flex-1">Manage</TabsTrigger>
        <TabsTrigger value="analytics" className="flex-1">📊 Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="analytics">
        <DripAnalyticsPanel />
      </TabsContent>

      <TabsContent value="manage">
      <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-primary" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Segments</span></div>
          <p className="text-2xl font-bold">{segments.length}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1"><Mail className="h-4 w-4 text-blue-500" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Contacts</span></div>
          <p className="text-2xl font-bold">{totalContacts.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1"><Send className="h-4 w-4 text-green-500" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</span></div>
          <p className="text-2xl font-bold">{activeCampaigns}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1"><BarChart3 className="h-4 w-4 text-amber-500" /><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily Limit</span></div>
          <p className="text-2xl font-bold">95</p>
          <p className="text-[10px] text-muted-foreground">Resend free tier</p>
        </Card>
      </div>

      {/* Process Batch Button */}
      {activeCampaigns > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <Button onClick={processBatch} disabled={processing} className="w-full bg-green-600 hover:bg-green-700">
              {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending Batch...</> : <><Play className="h-4 w-4 mr-2" />Send Next Batch (up to 95 emails)</>}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">Run this once per day to send the next batch. Can also be automated via cron.</p>
          </CardContent>
        </Card>
      )}

      {/* Create Segment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FolderPlus className="h-5 w-5" />Create Segment</CardTitle>
          <CardDescription>Organize your contacts (e.g. Bali, Trini, Music, Film)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Segment name (e.g. Bali Creatives)" value={newSegmentName} onChange={e => setNewSegmentName(e.target.value)} />
            <Button onClick={createSegment} disabled={creatingSegment || !newSegmentName.trim()} size="sm">
              {creatingSegment ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            </Button>
          </div>
          <Input placeholder="Description (optional)" value={newSegmentDesc} onChange={e => setNewSegmentDesc(e.target.value)} />

          {segments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {segments.map(s => (
                <Badge key={s.id} variant="secondary" className="gap-1">
                  {s.name} <span className="text-muted-foreground">({s.contact_count.toLocaleString()})</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload CSV */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-5 w-5" />Import Contacts (CSV)</CardTitle>
          <CardDescription>CSV must have an "email" column. Optional "name" column. Select a segment first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
            <SelectTrigger><SelectValue placeholder="Select segment..." /></SelectTrigger>
            <SelectContent>
              {segments.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.contact_count})</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} disabled={uploading || !selectedSegmentId} className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50" />
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Importing contacts...
            </div>
          )}

          {uploadStats && (
            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
              <p className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> {uploadStats.imported} imported</p>
              <p className="flex items-center gap-1"><Clock className="h-3 w-3 text-yellow-500" /> {uploadStats.duplicates} duplicates skipped</p>
              <p className="font-medium">Total in segment: {uploadStats.total?.toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Send className="h-5 w-5" />Create Drip Campaign</CardTitle>
          <CardDescription>Sends emails in daily batches within your Resend free tier limit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={campaignSegmentId} onValueChange={setCampaignSegmentId}>
            <SelectTrigger><SelectValue placeholder="Select segment..." /></SelectTrigger>
            <SelectContent>
              {segments.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.contact_count.toLocaleString()} contacts)</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input placeholder="e.g. 🚀 Join Kretopia - The Platform for Creatives" value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Email Body</Label>
            <Textarea placeholder="Write your message. Line breaks become paragraphs. Recipients will be greeted by name." value={campaignBody} onChange={e => setCampaignBody(e.target.value)} rows={6} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">CTA Button Text</Label>
              <Input value={campaignCta} onChange={e => setCampaignCta(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CTA URL</Label>
              <Input value={campaignCtaUrl} onChange={e => setCampaignCtaUrl(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Daily Send Limit</Label>
            <Input type="number" value={campaignDailyLimit} onChange={e => setCampaignDailyLimit(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">Resend free tier = 100/day. We use 95 to leave buffer.</p>
          </div>

          <Button onClick={createCampaign} disabled={creatingCampaign} className="w-full">
            {creatingCampaign ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : <><Send className="h-4 w-4 mr-2" />Launch Campaign</>}
          </Button>
        </CardContent>
      </Card>

      {/* Active Campaigns */}
      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaigns.map(c => {
              const progress = c.total_contacts > 0 ? ((c.sent_count + c.failed_count) / c.total_contacts) * 100 : 0;
              const remaining = c.total_contacts - c.sent_count - c.failed_count;
              const daysLeft = c.daily_limit > 0 ? Math.ceil(remaining / c.daily_limit) : 0;

              return (
                <div key={c.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {(c as any).email_segments?.name || 'Unknown segment'} · Created {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === 'active' ? 'default' : c.status === 'completed' ? 'secondary' : 'outline'}>
                        {c.status}
                      </Badge>
                      {(c.status === 'active' || c.status === 'paused') && (
                        <Button size="sm" variant="ghost" onClick={() => toggleCampaign(c.id, c.status)}>
                          {c.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  <Progress value={progress} className="h-2" />

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> {c.sent_count} sent</span>
                    <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" /> {c.failed_count} failed</span>
                    <span>{remaining} remaining</span>
                    {c.status === 'active' && <span>~{daysLeft} days left</span>}
                  </div>

                  {c.last_batch_at && (
                    <p className="text-[10px] text-muted-foreground">Last batch: {new Date(c.last_batch_at).toLocaleString()}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
    </TabsContent>
    </Tabs>
  );
};
