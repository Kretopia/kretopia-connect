import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Building2, Mail, User } from "lucide-react";

const STAGES = [
  { key: "new", label: "New", color: "bg-primary" },
  { key: "contacted", label: "Contacted", color: "bg-amber-500" },
  { key: "hot", label: "Hot", color: "bg-orange-500" },
  { key: "negotiating", label: "Negotiating", color: "bg-primary" },
  { key: "converted", label: "Won", color: "bg-green-500" },
  { key: "lost", label: "Lost", color: "bg-muted-foreground" },
];

export function LeadPipelineKanban() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchLeads();
  }, [user]);

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false });
    setLeads(data || []);
    setLoading(false);
  };

  const moveToStage = async (leadId: string, newStage: string) => {
    const { error } = await supabase.from("leads").update({ stage: newStage, updated_at: new Date().toISOString() }).eq("id", leadId);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
      toast({ title: `Moved to ${STAGES.find(s => s.key === newStage)?.label}` });
    }
  };

  if (loading) return <div className="h-60 animate-pulse bg-muted rounded-lg" />;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Pipeline View</h3>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.key);
          const nextStage = STAGES[STAGES.indexOf(stage) + 1];

          return (
            <div key={stage.key} className="min-w-[220px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <span className="text-sm font-semibold">{stage.label}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{stageLeads.length}</Badge>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-2">
                  {stageLeads.length === 0 && (
                    <div className="border border-dashed rounded-lg p-4 text-center">
                      <p className="text-xs text-muted-foreground">No leads</p>
                    </div>
                  )}
                  {stageLeads.map(lead => (
                    <Card key={lead.id} className="p-3 hover:shadow-md transition-shadow">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium line-clamp-1">{lead.name || "Unnamed Lead"}</p>
                          {lead.score && (
                            <Badge variant={lead.score >= 70 ? "default" : "secondary"} className="text-[10px] shrink-0">
                              {lead.score}
                            </Badge>
                          )}
                        </div>
                        {lead.company && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">{lead.company}</span>
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                        {nextStage && stage.key !== "converted" && stage.key !== "lost" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs gap-1 mt-1"
                            onClick={() => moveToStage(lead.id, nextStage.key)}
                          >
                            Move to {nextStage.label}
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
