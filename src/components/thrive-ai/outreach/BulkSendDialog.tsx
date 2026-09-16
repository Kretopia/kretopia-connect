import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart3, CalendarClock, Image, Loader2, Mail, Paperclip, Save, Send, Sparkles, Upload, Users, Video,
} from "lucide-react";
import { format } from "date-fns";
import type { Lead } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;

  // bulk state + setters
  bulkMode: "select" | "csv" | "manual";
  setBulkMode: (m: "select" | "csv" | "manual") => void;
  manualEmails: string;
  setManualEmails: (s: string) => void;
  bulkSelected: string[];
  csvEmails: { name: string; email: string }[];
  bulkSubject: string;
  setBulkSubject: (s: string) => void;
  bulkBody: string;
  setBulkBody: (s: string) => void;
  bulkSending: boolean;
  bulkProgress: number;
  bulkScheduledFor: string;
  setBulkScheduledFor: (s: string) => void;
  bulkAttachments: File[];
  setBulkAttachments: React.Dispatch<React.SetStateAction<File[]>>;
  selectedTemplate: string;

  // data
  leads: Lead[];
  templates: any[];
  campaigns: any[];
  bulkUsage: number | undefined;
  bulkLimit: number;

  // ui state
  generating: boolean;
  setGenerating: (b: boolean) => void;
  mediaUploading: boolean;

  // actions
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleBulkSelect: (id: string) => void;
  selectAllLeads: () => void;
  onSend: () => void;
  onMediaInsert: (file: File, type: "image" | "video") => void;
  onAiGenerate: () => void;
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onOpenSaveTemplate: () => void;
}

export const BulkSendDialog = (p: Props) => {
  const recipientCount =
    p.bulkMode === "csv" ? p.csvEmails.length :
    p.bulkMode === "manual" ? p.manualEmails.split(/[,;\n]+/).map((e) => e.trim()).filter((e) => e.includes("@")).length :
    p.bulkSelected.length;

  return (
    <Dialog open={p.open} onOpenChange={(o) => { if (!o) p.onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Bulk Campaign
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Usage meter */}
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border">
            <div className="text-xs">
              <span className="font-medium">{p.bulkUsage || 0}</span>
              <span className="text-muted-foreground"> / {p.bulkLimit} sends used this month</span>
            </div>
            <div className="w-24 bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${((p.bulkUsage || 0) / p.bulkLimit) > 0.8 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, ((p.bulkUsage || 0) / p.bulkLimit) * 100)}%` }}
              />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button size="sm" variant={p.bulkMode === "select" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => p.setBulkMode("select")}>
              <Users className="h-3.5 w-3.5" /> Leads
            </Button>
            <Button size="sm" variant={p.bulkMode === "manual" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => p.setBulkMode("manual")}>
              <Mail className="h-3.5 w-3.5" /> Manual
            </Button>
            <Button size="sm" variant={p.bulkMode === "csv" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => p.setBulkMode("csv")}>
              <Upload className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>

          {p.bulkMode === "select" ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Select leads ({p.bulkSelected.length} selected)</Label>
                <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2" onClick={p.selectAllLeads}>
                  {p.bulkSelected.length === p.leads.filter((l) => l.email).length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-md p-2">
                {p.leads.filter((l) => l.email).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No leads with emails</p>
                ) : (
                  p.leads.filter((l) => l.email).map((lead) => (
                    <label key={lead.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs">
                      <input type="checkbox" checked={p.bulkSelected.includes(lead.id)} onChange={() => p.toggleBulkSelect(lead.id)} className="rounded" />
                      <span className="font-medium">{lead.name}</span>
                      <span className="text-muted-foreground truncate">{lead.email}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : p.bulkMode === "manual" ? (
            <div>
              <Label className="text-xs">Enter email addresses (comma, semicolon, or newline separated)</Label>
              <Textarea
                value={p.manualEmails}
                onChange={(e) => p.setManualEmails(e.target.value)}
                placeholder={"john@example.com, jane@company.com\nmark@studio.com; lisa@agency.co"}
                rows={4}
                className="mt-1 text-xs"
              />
              {p.manualEmails.trim() && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {p.manualEmails.split(/[,;\n]+/).map((e) => e.trim()).filter((e) => e.includes("@")).length} valid email(s) detected
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label className="text-xs">Upload CSV (columns: name, email)</Label>
              <input type="file" accept=".csv,.txt" className="text-xs mt-1 w-full" onChange={p.onCsvUpload} />
              {p.csvEmails.length > 0 && (
                <div className="mt-2 border border-border rounded-md p-2 max-h-32 overflow-y-auto">
                  <p className="text-[10px] text-muted-foreground mb-1">{p.csvEmails.length} recipients parsed:</p>
                  {p.csvEmails.slice(0, 20).map((r, i) => (
                    <p key={i} className="text-[11px] truncate">{r.name} — {r.email}</p>
                  ))}
                  {p.csvEmails.length > 20 && <p className="text-[10px] text-muted-foreground">...and {p.csvEmails.length - 20} more</p>}
                </div>
              )}
            </div>
          )}

          {/* Template selector */}
          {p.templates.length > 0 && (
            <div>
              <Label className="text-xs mb-1 flex items-center gap-1"><Save className="h-3 w-3" /> Load Template</Label>
              <div className="flex gap-1.5 flex-wrap">
                {p.templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <Button size="sm" variant={p.selectedTemplate === t.id ? "default" : "outline"} className="text-[10px] h-6 px-2" onClick={() => p.onLoadTemplate(t.id)}>
                      {t.name}
                    </Button>
                    <button onClick={() => p.onDeleteTemplate(t.id)} className="text-muted-foreground hover:text-destructive text-xs">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">Use <code className="bg-muted px-1 rounded">{"{name}"}</code> and <code className="bg-muted px-1 rounded">{"{email}"}</code> for personalization. Unsubscribed contacts are auto-excluded.</p>

          <div className="flex justify-between gap-2">
            <Button size="sm" variant="ghost" className="gap-1 text-[10px]" onClick={p.onOpenSaveTemplate} disabled={!p.bulkSubject.trim() || !p.bulkBody.trim()}>
              <Save className="h-3 w-3" /> Save as Template
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={p.onAiGenerate} disabled={p.generating}>
              {p.generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI Generate
            </Button>
          </div>

          <div>
            <Label>Subject *</Label>
            <Input value={p.bulkSubject} onChange={(e) => p.setBulkSubject(e.target.value)} placeholder="e.g. Hey {name}, let's collaborate!" />
          </div>
          <div>
            <Label>Body *</Label>
            <Textarea value={p.bulkBody} onChange={(e) => p.setBulkBody(e.target.value)} placeholder="Write your message... Use {name} for personalization" rows={6} />
            <div className="flex gap-1.5 mt-1.5">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" disabled={p.mediaUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onMediaInsert(f, "image"); e.target.value = ""; }} />
                <Badge variant="outline" className="gap-1 text-[10px] cursor-pointer hover:bg-muted">
                  <Image className="h-3 w-3" /> Embed Image
                </Badge>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="video/*" className="hidden" disabled={p.mediaUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onMediaInsert(f, "video"); e.target.value = ""; }} />
                <Badge variant="outline" className="gap-1 text-[10px] cursor-pointer hover:bg-muted">
                  <Video className="h-3 w-3" /> Add Video Link
                </Badge>
              </label>
              {p.mediaUploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5 text-xs"><Paperclip className="h-3.5 w-3.5" /> Attachments</Label>
            <input type="file" multiple className="text-xs mt-1" onChange={(e) => {
              if (e.target.files) p.setBulkAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
            }} />
            {p.bulkAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {p.bulkAttachments.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                    {f.name}
                    <button onClick={() => p.setBulkAttachments((prev) => prev.filter((_, j) => j !== i))} className="hover:text-destructive">×</button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">Files will be uploaded and linked in the email</p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant={!p.bulkScheduledFor ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => p.setBulkScheduledFor("")}>
                <Send className="h-3.5 w-3.5" /> Send Now
              </Button>
              <Button size="sm" variant={p.bulkScheduledFor ? "default" : "outline"} className="flex-1 gap-1 text-xs"
                onClick={() => { if (!p.bulkScheduledFor) p.setBulkScheduledFor(new Date(Date.now() + 3600000).toISOString().slice(0, 16)); }}>
                <CalendarClock className="h-3.5 w-3.5" /> Schedule
              </Button>
            </div>
            {p.bulkScheduledFor && (
              <div>
                <Input type="datetime-local" value={p.bulkScheduledFor} onChange={(e) => p.setBulkScheduledFor(e.target.value)} className="text-xs" />
                <p className="text-[10px] text-muted-foreground mt-1">Campaign will be sent at the scheduled time</p>
              </div>
            )}
          </div>

          {p.bulkSending && (
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${p.bulkProgress}%` }} />
            </div>
          )}

          <Button className="w-full gap-1.5" onClick={p.onSend} disabled={p.bulkSending || (p.bulkUsage || 0) >= p.bulkLimit}>
            {p.bulkSending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending... {p.bulkProgress}%</>
            ) : p.bulkScheduledFor ? (
              <><CalendarClock className="h-4 w-4" /> Schedule Campaign</>
            ) : (
              <><Send className="h-4 w-4" /> Send to {recipientCount} recipients</>
            )}
          </Button>

          {p.campaigns.length > 0 && (
            <div className="border-t border-border pt-3 mt-2">
              <p className="text-xs font-medium mb-2 flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> Recent Campaigns</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {p.campaigns.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.sent_at ? format(new Date(c.sent_at), "MMM d") : c.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] shrink-0">
                      <span className="text-green-500">{c.sent_count} sent</span>
                      {c.failed_count > 0 && <span className="text-destructive">{c.failed_count} failed</span>}
                      <Badge variant="outline" className="text-[9px] px-1">{c.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
