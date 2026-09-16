import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, Upload, Loader2, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectEntry {
  title: string;
  type: string;
  year: string;
  description: string;
  roles: { name: string; role: string }[];
}

interface BulkProjectSubmissionProps {
  currentUserId: string;
}

const EMPTY_PROJECT: ProjectEntry = {
  title: '', type: 'other', year: '', description: '', roles: [{ name: '', role: '' }],
};

export const BulkProjectSubmission = ({ currentUserId }: BulkProjectSubmissionProps) => {
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [projects, setProjects] = useState<ProjectEntry[]>([{ ...EMPTY_PROJECT }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ processed: number; total: number } | null>(null);

  const addProject = () => setProjects(prev => [...prev, { ...EMPTY_PROJECT, roles: [{ name: '', role: '' }] }]);

  const removeProject = (idx: number) => setProjects(prev => prev.filter((_, i) => i !== idx));

  const updateProject = (idx: number, field: keyof ProjectEntry, value: any) => {
    setProjects(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const addRole = (projIdx: number) => {
    setProjects(prev => prev.map((p, i) =>
      i === projIdx ? { ...p, roles: [...p.roles, { name: '', role: '' }] } : p
    ));
  };

  const updateRole = (projIdx: number, roleIdx: number, field: 'name' | 'role', value: string) => {
    setProjects(prev => prev.map((p, i) =>
      i === projIdx ? {
        ...p,
        roles: p.roles.map((r, ri) => ri === roleIdx ? { ...r, [field]: value } : r)
      } : p
    ));
  };

  const handleSubmit = async () => {
    if (!companyName.trim()) { toast.error("Company name required"); return; }
    const validProjects = projects.filter(p => p.title.trim());
    if (validProjects.length === 0) { toast.error("Add at least one project"); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-submit-projects', {
        body: {
          projects: validProjects.map(p => ({
            ...p,
            year: p.year ? parseInt(p.year) : null,
            roles: p.roles.filter(r => r.name || r.role),
          })),
          companyName: companyName.trim(),
          contactEmail: contactEmail.trim(),
          submittedBy: currentUserId,
        },
      });

      if (error) throw error;
      setResult({ processed: data.processed, total: data.total });
      toast.success(`${data.processed} projects submitted to Kretopia Credits!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit projects");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Projects Submitted!</h3>
          <p className="text-sm text-muted-foreground">
            {result.processed} of {result.total} projects added as verified Stamps on the Creative Passport network.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Tagged creators can now claim their credits.
          </p>
          <Button className="mt-4" onClick={() => { setResult(null); setProjects([{ ...EMPTY_PROJECT }]); }}>
            Submit More
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Bulk Project Submission
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Studios, labels, and agencies can submit multiple projects at once
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Company Name *</Label>
            <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g., Universal Music" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Contact Email</Label>
            <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contact@company.com" className="h-8 text-xs" />
          </div>
        </div>

        <div className="space-y-3">
          {projects.map((proj, pi) => (
            <div key={pi} className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">Project {pi + 1}</Badge>
                {projects.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeProject(pi)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input value={proj.title} onChange={e => updateProject(pi, 'title', e.target.value)} placeholder="Project title" className="h-7 text-[11px] col-span-2" />
                <Select value={proj.type} onValueChange={v => updateProject(pi, 'type', v)}>
                  <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['film', 'album', 'single', 'music_video', 'commercial', 'fashion_show', 'live_event', 'documentary', 'podcast', 'other'].map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input value={proj.year} onChange={e => updateProject(pi, 'year', e.target.value)} placeholder="Year" type="number" className="h-7 text-[11px] w-24" />

              {/* Roles */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Credits</p>
                {proj.roles.map((role, ri) => (
                  <div key={ri} className="flex gap-1.5">
                    <Input value={role.name} onChange={e => updateRole(pi, ri, 'name', e.target.value)} placeholder="Person name" className="h-6 text-[10px]" />
                    <Input value={role.role} onChange={e => updateRole(pi, ri, 'role', e.target.value)} placeholder="Role" className="h-6 text-[10px]" />
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-0.5" onClick={() => addRole(pi)}>
                  <Plus className="h-2 w-2" /> Add credit
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addProject}>
            <Plus className="h-3 w-3" /> Add Project
          </Button>
          <Button size="sm" className="gap-1 text-xs ml-auto" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Submit {projects.filter(p => p.title.trim()).length} Projects
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
