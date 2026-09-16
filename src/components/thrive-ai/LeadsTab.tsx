import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, User, Building2, Mail, Trash2, Edit2, ArrowRight, Sparkles, Upload, Download, Check, ExternalLink, Loader2 } from "lucide-react";

type Lead = {
  id: string;
  name: string;
  type: string;
  stage: string;
  email: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
  tags: string[];
  source: string | null;
  priority: string;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type ScoutedLead = {
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  website: string | null;
  notes: string;
  type: string;
  priority: string;
};

const STAGES = [
  { key: "cold", label: "Cold", color: "bg-primary/10 text-primary border-primary/20" },
  { key: "warm", label: "Warm", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  { key: "hot", label: "Hot", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { key: "converted", label: "Converted", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { key: "lost", label: "Lost", color: "bg-muted text-muted-foreground border-border" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-primary/10 text-primary",
  low: "bg-muted text-muted-foreground",
};

const LeadsTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [view, setView] = useState<"pipeline" | "scout">("pipeline");
  const [form, setForm] = useState({
    name: "", type: "client", email: "", company: "", role: "", notes: "", priority: "medium", source: "",
  });

  // Scout state
  const [scoutQuery, setScoutQuery] = useState("");
  const [scoutIndustry, setScoutIndustry] = useState("");
  const [scoutLocation, setScoutLocation] = useState("");
  const [scoutResults, setScoutResults] = useState<ScoutedLead[]>([]);
  const [scoutSources, setScoutSources] = useState<string[]>([]);
  const [scouting, setScouting] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  // Import state
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (lead: { name: string; type: string; email?: string | null; company?: string | null; role?: string | null; notes?: string | null; priority: string; source?: string | null }) => {
      const { error } = await supabase.from("leads").insert({
        user_id: user!.id,
        name: lead.name,
        type: lead.type,
        email: lead.email || null,
        company: lead.company || null,
        role: lead.role || null,
        notes: lead.notes || null,
        priority: lead.priority,
        source: lead.source || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Failed to add lead"),
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removed");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const updateMutation = useMutation({
    mutationFn: async (lead: Lead) => {
      const { error } = await supabase.from("leads").update({
        name: lead.name, type: lead.type, email: lead.email, company: lead.company,
        role: lead.role, notes: lead.notes, priority: lead.priority,
      }).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setEditingLead(null);
      toast.success("Lead updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const resetForm = () => setForm({ name: "", type: "client", email: "", company: "", role: "", notes: "", priority: "medium", source: "" });

  const leadsPerStage = (stage: string) => leads.filter((l) => l.stage === stage);

  // AI Scout
  const handleScout = async () => {
    if (!scoutQuery.trim()) return;
    setScouting(true);
    setScoutResults([]);
    setSavedIds(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("scout-leads", {
        body: { query: scoutQuery, industry: scoutIndustry, location: scoutLocation },
      });
      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setScoutResults(data.leads || []);
      setScoutSources(data.sources || []);
      if ((data.leads || []).length === 0) {
        toast.info("No leads found — try a different query");
      }
    } catch (e) {
      console.error(e);
      toast.error("Scout failed — please try again");
    } finally {
      setScouting(false);
    }
  };

  const saveScoutedLead = async (lead: ScoutedLead, idx: number) => {
    await addMutation.mutateAsync({
      name: lead.name,
      type: lead.type || "client",
      email: lead.email,
      company: lead.company,
      role: lead.role,
      notes: lead.notes,
      priority: lead.priority || "medium",
      source: "AI Scout",
    });
    setSavedIds((prev) => new Set(prev).add(idx));
    toast.success(`${lead.name} saved to leads`);
  };

  const saveAllScouted = async () => {
    for (let i = 0; i < scoutResults.length; i++) {
      if (!savedIds.has(i)) {
        await saveScoutedLead(scoutResults[i], i);
      }
    }
    toast.success("All leads saved");
  };

  // CSV Import
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const companyIdx = headers.findIndex((h) => h.includes("company") || h.includes("brand"));
      const roleIdx = headers.findIndex((h) => h.includes("role") || h.includes("title"));
      const notesIdx = headers.findIndex((h) => h.includes("note"));

      if (nameIdx === -1) {
        toast.error("CSV must have a 'name' column");
        return;
      }

      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const name = cols[nameIdx];
        if (!name) continue;
        await addMutation.mutateAsync({
          name,
          type: "client",
          email: emailIdx >= 0 ? cols[emailIdx] || null : null,
          company: companyIdx >= 0 ? cols[companyIdx] || null : null,
          role: roleIdx >= 0 ? cols[roleIdx] || null : null,
          notes: notesIdx >= 0 ? cols[notesIdx] || null : null,
          priority: "medium",
          source: "CSV Import",
        });
        imported++;
      }
      toast.success(`Imported ${imported} leads`);
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // CSV Export
  const handleExport = () => {
    if (leads.length === 0) return toast.info("No leads to export");
    const headers = "Name,Type,Stage,Email,Company,Role,Priority,Source,Notes";
    const rows = leads.map((l) =>
      [l.name, l.type, l.stage, l.email || "", l.company || "", l.role || "", l.priority, l.source || "", (l.notes || "").replace(/,/g, ";")].join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kretopia-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="h-8">
            <TabsTrigger value="pipeline" className="text-xs px-3 h-7">Pipeline</TabsTrigger>
            <TabsTrigger value="scout" className="text-xs px-3 h-7 gap-1">
              <Sparkles className="h-3 w-3" /> AI Scout
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1.5">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3 w-3" /> Import
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={handleExport}>
              <Download className="h-3 w-3" /> Export
            </Button>
            <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 text-xs h-7">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contact name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client / Brand</SelectItem>
                          <SelectItem value="collaborator">Collaborator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" type="email" /></div>
                  <div><Label>Company / Brand</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" /></div>
                  <div><Label>Role / Title</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Creative Director" /></div>
                  <div><Label>Source</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Instagram, Referral" /></div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything notable..." rows={2} /></div>
                  <Button className="w-full" onClick={() => { addMutation.mutate(form); setAddOpen(false); resetForm(); toast.success("Lead added"); }} disabled={!form.name.trim() || addMutation.isPending}>
                    {addMutation.isPending ? "Adding..." : "Add Lead"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Pipeline view */}
        <TabsContent value="pipeline" className="mt-3">
          <p className="text-xs text-muted-foreground mb-3">{leads.length} total leads</p>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading leads...</div>
          ) : (
            <div className="space-y-4">
              {STAGES.map((stage) => {
                const stageLeads = leadsPerStage(stage.key);
                return (
                  <div key={stage.key}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={`text-xs ${stage.color}`}>{stage.label}</Badge>
                      <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
                    </div>
                    {stageLeads.length === 0 ? (
                      <div className="border border-dashed border-border rounded-lg p-3 text-xs text-muted-foreground text-center">
                        No {stage.label.toLowerCase()} leads
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stageLeads.map((lead) => (
                          <LeadCard key={lead.id} lead={lead}
                            onStageChange={(s) => updateStageMutation.mutate({ id: lead.id, stage: s })}
                            onDelete={() => deleteMutation.mutate(lead.id)}
                            onEdit={() => setEditingLead(lead)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* AI Scout view */}
        <TabsContent value="scout" className="mt-3">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">AI Lead Scout</h3>
            </div>
            <p className="text-xs text-muted-foreground">Describe what kind of leads you're looking for and AI will search the web to find contacts.</p>
            <div className="space-y-2">
              <Input value={scoutQuery} onChange={(e) => setScoutQuery(e.target.value)} placeholder="e.g. music video production companies looking for editors"
                onKeyDown={(e) => e.key === "Enter" && handleScout()} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={scoutIndustry} onChange={(e) => setScoutIndustry(e.target.value)} placeholder="Industry (optional)" />
                <Input value={scoutLocation} onChange={(e) => setScoutLocation(e.target.value)} placeholder="Location (optional)" />
              </div>
              <Button className="w-full gap-1.5" onClick={handleScout} disabled={scouting || !scoutQuery.trim()}>
                {scouting ? <><Loader2 className="h-4 w-4 animate-spin" /> Scouting the web...</> : <><Sparkles className="h-4 w-4" /> Find Leads</>}
              </Button>
            </div>
          </Card>

          {scoutResults.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{scoutResults.length} leads found</p>
                <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={saveAllScouted}>
                  <Download className="h-3 w-3" /> Save All
                </Button>
              </div>
              <div className="space-y-2">
                {scoutResults.map((lead, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {lead.type === "client" ? <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="font-medium text-sm truncate">{lead.name}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[lead.priority || "medium"]}`}>
                            {lead.priority || "medium"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {lead.company && <span>{lead.company}</span>}
                          {lead.role && <span>· {lead.role}</span>}
                          {lead.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" /> {lead.email}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lead.notes}</p>
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary flex items-center gap-0.5 mt-1 hover:underline">
                            <ExternalLink className="h-2.5 w-2.5" /> {lead.website}
                          </a>
                        )}
                      </div>
                      <Button size="sm" variant={savedIds.has(idx) ? "secondary" : "default"} className="shrink-0 gap-1 text-xs h-7"
                        onClick={() => saveScoutedLead(lead, idx)} disabled={savedIds.has(idx)}>
                        {savedIds.has(idx) ? <><Check className="h-3 w-3" /> Saved</> : <><Plus className="h-3 w-3" /> Save</>}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              {scoutSources.length > 0 && (
                <div className="text-[10px] text-muted-foreground/60 space-y-0.5">
                  <p className="font-medium">Sources:</p>
                  {scoutSources.slice(0, 5).map((s, i) => (
                    <a key={i} href={s} target="_blank" rel="noopener noreferrer" className="block truncate hover:text-muted-foreground">{s}</a>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editingLead} onOpenChange={(o) => { if (!o) setEditingLead(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
          {editingLead && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editingLead.name} onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={editingLead.type} onValueChange={(v) => setEditingLead({ ...editingLead, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client / Brand</SelectItem>
                      <SelectItem value="collaborator">Collaborator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={editingLead.priority} onValueChange={(v) => setEditingLead({ ...editingLead, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Email</Label><Input value={editingLead.email || ""} onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })} /></div>
              <div><Label>Company</Label><Input value={editingLead.company || ""} onChange={(e) => setEditingLead({ ...editingLead, company: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={editingLead.notes || ""} onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })} rows={2} /></div>
              <Button className="w-full" onClick={() => updateMutation.mutate(editingLead)} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LeadCard = ({ lead, onStageChange, onDelete, onEdit }: {
  lead: Lead;
  onStageChange: (stage: string) => void;
  onDelete: () => void;
  onEdit: () => void;
}) => {
  const nextStage = () => {
    const order = ["cold", "warm", "hot", "converted"];
    const idx = order.indexOf(lead.stage);
    if (idx >= 0 && idx < order.length - 1) return order[idx + 1];
    return null;
  };
  const next = nextStage();

  return (
    <Card className="p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {lead.type === "client" ? <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <span className="font-medium text-sm truncate">{lead.name}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {lead.company && <span>{lead.company}</span>}
            {lead.role && <span>· {lead.role}</span>}
            {lead.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" /> {lead.email}</span>}
          </div>
          {lead.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{lead.notes}</p>}
          {lead.source && <span className="text-[10px] text-muted-foreground/70 mt-0.5 block">via {lead.source}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {next && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onStageChange(next)} title={`Move to ${next}`}>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </Card>
  );
};

export default LeadsTab;
