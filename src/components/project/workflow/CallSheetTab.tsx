import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Cloud, Users, Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CallSheetTabProps {
  projectId: string;
  currentUserId: string;
}

interface CallSheet {
  id: string;
  project_id: string;
  shoot_date: string | null;
  call_time: string | null;
  location_name: string | null;
  location_address: string | null;
  weather_note: string | null;
  contact_list: any;
  notes: string | null;
}

export function CallSheetTab({ projectId, currentUserId }: CallSheetTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheets, setSheets] = useState<CallSheet[]>([]);

  useEffect(() => { void load(); }, [projectId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("project_call_sheets")
        .select("*")
        .eq("project_id", projectId)
        .order("shoot_date", { ascending: true });
      setSheets((data as any[]) || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const create = async () => {
    setSaving(true);
    const { error } = await supabase.from("project_call_sheets").insert({
      project_id: projectId,
      created_by: currentUserId,
      shoot_date: new Date().toISOString().slice(0, 10),
      call_time: "07:00",
      location_name: "",
      contact_list: [],
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't add call sheet", description: error.message, variant: "destructive" });
      return;
    }
    void load();
  };

  const update = async (id: string, patch: Partial<CallSheet>) => {
    const { error } = await supabase.from("project_call_sheets").update(patch).eq("id", id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("project_call_sheets").delete().eq("id", id);
    if (!error) void load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Call Sheets</h2>
          <p className="text-sm text-muted-foreground">Date, location, weather & key contacts for each shoot day.</p>
        </div>
        <Button onClick={create} disabled={saving} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {sheets.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No call sheets yet. Add one for your first shoot day.
        </CardContent></Card>
      )}

      {sheets.map((s) => (
        <Card key={s.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">
              {s.shoot_date ? format(new Date(s.shoot_date), "EEE, MMM d") : "Untitled day"}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(s.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</Label>
                <Input type="date" defaultValue={s.shoot_date ?? ""} onBlur={(e) => update(s.id, { shoot_date: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Call time</Label>
                <Input type="time" defaultValue={s.call_time ?? ""} onBlur={(e) => update(s.id, { call_time: e.target.value || null })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Location name</Label>
              <Input defaultValue={s.location_name ?? ""} placeholder="Studio name" onBlur={(e) => update(s.id, { location_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</Label>
              <Input defaultValue={s.location_address ?? ""} placeholder="Full address" onBlur={(e) => update(s.id, { location_address: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Cloud className="h-3 w-3" /> Weather / wardrobe note</Label>
              <Input defaultValue={s.weather_note ?? ""} placeholder="e.g. Sunny 24°C — bring jackets for backup" onBlur={(e) => update(s.id, { weather_note: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> Notes</Label>
              <Textarea defaultValue={s.notes ?? ""} placeholder="Crew call, parking, special instructions..." rows={3} onBlur={(e) => update(s.id, { notes: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
