import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PenLine, Upload, Sheet as SheetIcon, Mic, Loader2,
  FileCheck2, Trash2, Plus, Sparkles, Square, Calendar as CalendarIcon,
  ShieldCheck,
} from "lucide-react";
import {
  parseCsvToDeliverables,
  googleSheetCsvUrl,
  type ParsedDeliverable,
} from "@/lib/csvBriefParser";
import { SmartBriefBuilder } from "./SmartBriefBuilder";

interface BriefHubProps {
  projectId: string;
  projectTitle: string;
  onCreated?: () => void;
}

interface MoodboardItem {
  url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  kind?: "image" | "link" | "video" | null;
}

interface DraftDeliverable {
  id: string;
  title: string;
  description?: string;
  due_date?: string | null;
  reference_url?: string | null;
  references?: MoodboardItem[];
  notes?: string | null;
  kind?: string;
  source?: "typed" | "document" | "sheet" | "csv" | "voice";
}

const newId = () => Math.random().toString(36).slice(2, 10);

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || "");
      resolve(r.includes(",") ? r.split(",")[1] : r);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result || "");
      resolve(r.includes(",") ? r.split(",")[1] : r);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const BriefHub = ({ projectId, projectTitle, onCreated }: BriefHubProps) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"smart" | "doc" | "sheet">("smart");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<DraftDeliverable[]>([]);

  // type
  const [text, setText] = useState("");
  // sheet/csv
  const [sheetUrl, setSheetUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  // doc
  const [docFile, setDocFile] = useState<File | null>(null);
  // voice
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);

  const callExtract = async (payload: Record<string, unknown>) => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-brief", {
        body: { project_title: projectTitle, ...payload },
      });
      if (error) throw error;
      const list = (data?.deliverables ?? []) as Array<Omit<DraftDeliverable, "id">>;
      if (!list.length) {
        toast({ title: "Nothing to import", description: "We couldn't find any deliverables.", variant: "destructive" });
        return;
      }
      setDrafts(list.map((d) => ({ ...d, id: newId() })));
      toast({ title: `Found ${list.length} deliverables`, description: "Review, edit, then save to your board." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Extraction failed";
      toast({ title: "Couldn't read brief", description: msg, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleType = () => {
    if (!text.trim()) return;
    callExtract({ source: "text", text });
  };

  // Deterministic Sheet/CSV import — NO AI rewriting. What's in the cells is what shows up.
  const importCsvText = (csv: string, sourceTag: "sheet" | "csv") => {
    const { deliverables, rowCount } = parseCsvToDeliverables(csv);
    if (!deliverables.length) {
      toast({
        title: "Couldn't read any rows",
        description: rowCount === 0
          ? "The sheet looks empty. Make sure it has a header row + at least one data row."
          : "Found rows but no titles. Check that one column is named Title / Name / Asset.",
        variant: "destructive",
      });
      return;
    }
    setDrafts(deliverables.map((d: ParsedDeliverable) => ({
      id: newId(),
      title: d.title,
      description: d.description,
      due_date: d.due_date,
      references: d.references,
      notes: d.notes,
      kind: d.kind,
      source: sourceTag,
    })));
    toast({
      title: `Imported ${deliverables.length} rows exactly`,
      description: "Pulled straight from your sheet — nothing rewritten by AI. Review, edit, save.",
    });
  };

  const handleSheet = async () => {
    if (!sheetUrl.trim()) return;
    const exportUrl = googleSheetCsvUrl(sheetUrl.trim());
    if (!exportUrl) {
      toast({ title: "That doesn't look like a Sheets URL", variant: "destructive" });
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch(exportUrl);
      if (!res.ok) {
        throw new Error(`Couldn't read sheet (status ${res.status}). Make sure it's shared as "Anyone with the link — Viewer".`);
      }
      const csv = await res.text();
      importCsvText(csv, "sheet");
    } catch (e) {
      toast({
        title: "Couldn't fetch sheet",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleCsvText = () => {
    if (!csvText.trim()) return;
    importCsvText(csvText, "csv");
  };

  const handleCsvFile = async (file: File) => {
    const txt = await file.text();
    setCsvText(txt);
    importCsvText(txt, "csv");
  };

  const handleDoc = async () => {
    if (!docFile) return;
    const b64 = await fileToBase64(docFile);
    callExtract({ source: "doc", data_base64: b64, mime_type: docFile.type || "application/pdf" });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast({ title: "Microphone blocked", description: "Allow mic access to record a brief.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleVoice = async () => {
    if (!voiceBlob) return;
    const b64 = await blobToBase64(voiceBlob);
    callExtract({ source: "audio", data_base64: b64, mime_type: "audio/webm" });
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const updateDraft = (id: string, patch: Partial<DraftDeliverable>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const removeDraft = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));
  const addBlankDraft = () =>
    setDrafts((prev) => [...prev, { id: newId(), title: "", description: "" }]);

  const saveAll = async () => {
    const valid = drafts.filter((d) => d.title.trim().length > 0);
    if (!valid.length) {
      toast({ title: "Add at least one deliverable", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const submittedBy = userRes?.user?.id ?? null;
      const sourceTag = tab === "doc" ? "document" : tab === "sheet" ? "sheet" : "smart";

      const rows = valid.map((d, i) => {
        // Merge legacy reference_url into the moodboard so nothing gets lost
        const refs: MoodboardItem[] = [...(d.references ?? [])];
        if (d.reference_url && !refs.some((r) => r.url === d.reference_url)) {
          const isImg = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(d.reference_url);
          refs.push({
            url: d.reference_url,
            thumbnail_url: isImg ? d.reference_url : null,
            kind: isImg ? "image" : "link",
            caption: null,
          });
        }
        return {
          project_id: projectId,
          title: d.title.trim().slice(0, 200),
          description: [d.description, d.notes].filter(Boolean).join("\n\n") || null,
          status: "pending",
          version: 1,
          source: d.source ?? sourceTag,
          kind: d.kind ?? "other",
          sort_order: i,
          due_date: d.due_date || null,
          submitted_by: submittedBy,
          moodboard: refs as unknown as Record<string, unknown>[],
        };
      });

      const { error } = await supabase.from("project_deliverables").insert(rows as never);
      if (error) throw error;

      toast({ title: `Added ${rows.length} deliverables`, description: "Open the Board tab to drag, assign and approve." });
      setDrafts([]);
      setText("");
      setSheetUrl("");
      setCsvText("");
      setDocFile(null);
      setVoiceBlob(null);
      onCreated?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast({ title: "Couldn't save deliverables", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">Add a Brief</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Bring whatever you have — type it, drop a doc, paste a Sheet, or record it.
                We'll turn it into deliverables on your board.
              </p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="smart" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Smart</TabsTrigger>
              <TabsTrigger value="doc" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Doc</TabsTrigger>
              <TabsTrigger value="sheet" className="gap-1.5"><SheetIcon className="h-3.5 w-3.5" />Sheet</TabsTrigger>
            </TabsList>

            <TabsContent value="smart" className="pt-4">
              <SmartBriefBuilder
                projectId={projectId}
                projectTitle={projectTitle}
                onSent={onCreated}
              />
            </TabsContent>

            <TabsContent value="doc" className="space-y-3 pt-4">
              <Input
                type="file"
                accept="application/pdf,image/*,.docx"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
              {docFile && <p className="text-xs text-muted-foreground">Selected: {docFile.name}</p>}
              <p className="text-xs text-muted-foreground">PDF, image, or screenshot of the brief works best.</p>
              <Button onClick={handleDoc} disabled={extracting || !docFile} className="w-full">
                {extracting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck2 className="h-4 w-4 mr-2" />}
                Extract deliverables
              </Button>
            </TabsContent>

            <TabsContent value="sheet" className="space-y-3 pt-4">
              <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Imported exactly as you wrote it — no AI rewriting. Every cell, link, and date is preserved.</span>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Public Google Sheet URL</label>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Share &rarr; "Anyone with the link — Viewer". One row = one deliverable.
                </p>
                <Button onClick={handleSheet} disabled={extracting || !sheetUrl.trim()} className="w-full">
                  {extracting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SheetIcon className="h-4 w-4 mr-2" />}
                  Import from Sheet
                </Button>
              </div>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or upload CSV</span>
                </div>
              </div>

              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCsvFile(f);
                }}
              />
              <Textarea
                placeholder="…or paste CSV / TSV rows here"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={4}
              />
              {csvText && (
                <Button onClick={handleCsvText} disabled={extracting} variant="outline" className="w-full">
                  {extracting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Import pasted rows
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {drafts.length > 0 && (
        <Card>
          <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold">Review & save</h3>
                <p className="text-xs text-muted-foreground">Edit anything, then add them all to your board.</p>
              </div>
              <Badge variant="secondary" className="shrink-0">{drafts.length} items</Badge>
            </div>

            <ScrollArea className="max-h-[60vh] sm:max-h-[420px] pr-1 sm:pr-2">
              <div className="space-y-3">
                {drafts.map((d, i) => (
                  <div key={d.id} className="p-2.5 sm:p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] sm:text-xs font-mono text-muted-foreground mt-2 w-5 sm:w-6 shrink-0">#{i + 1}</span>
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Deliverable title"
                          value={d.title}
                          onChange={(e) => updateDraft(d.id, { title: e.target.value })}
                          maxLength={200}
                        />
                        <Textarea
                          placeholder="Description / notes"
                          value={d.description ?? ""}
                          onChange={(e) => updateDraft(d.id, { description: e.target.value })}
                          rows={2}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            type="date"
                            value={d.due_date ?? ""}
                            onChange={(e) => updateDraft(d.id, { due_date: e.target.value || null })}
                            className="h-8 text-xs w-auto"
                          />
                          {(d.references?.length ?? 0) > 0 && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              🎨 {d.references!.length} ref{d.references!.length === 1 ? "" : "s"}
                            </Badge>
                          )}
                        </div>
                        {(d.references?.length ?? 0) > 0 && (
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {d.references!.slice(0, 6).map((r, idx) =>
                              r.thumbnail_url ? (
                                <a key={idx} href={r.url} target="_blank" rel="noreferrer" className="shrink-0">
                                  <img
                                    src={r.thumbnail_url}
                                    alt={r.caption ?? "reference"}
                                    className="h-12 w-12 rounded object-cover border"
                                    loading="lazy"
                                  />
                                </a>
                              ) : (
                                <a
                                  key={idx}
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 h-12 px-2 rounded border bg-muted text-[10px] text-muted-foreground inline-flex items-center max-w-[140px] truncate"
                                  title={r.url}
                                >
                                  {r.caption || new URL(r.url).hostname.replace("www.", "")}
                                </a>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeDraft(d.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={addBlankDraft} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add row
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setDrafts([])}>Discard</Button>
              <Button size="sm" onClick={saveAll} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save to board
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BriefHub;
