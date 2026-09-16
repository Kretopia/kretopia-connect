import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Bug, Lightbulb, Palette, MessageCircle, CheckCircle2, Clock,
  AlertTriangle, ArrowRight, X, Loader2, ChevronDown
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface FeedbackItem {
  id: string;
  user_id: string;
  category: string;
  message: string;
  status: string;
  page_url: string | null;
  admin_notes: string | null;
  action_taken: string | null;
  priority: string | null;
  created_at: string;
  screenshot_url: string | null;
}

const categoryConfig: Record<string, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: "Bug", color: "bg-red-500/10 text-red-500" },
  feature: { icon: Lightbulb, label: "Feature", color: "bg-blue-500/10 text-blue-500" },
  ui: { icon: Palette, label: "UI/UX", color: "bg-primary/10 text-primary" },
  general: { icon: MessageCircle, label: "General", color: "bg-muted text-muted-foreground" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-yellow-500/10 text-yellow-600" },
  reviewed: { label: "Reviewed", color: "bg-blue-500/10 text-blue-500" },
  in_progress: { label: "In Progress", color: "bg-orange-500/10 text-orange-500" },
  implemented: { label: "Implemented", color: "bg-green-500/10 text-green-600" },
  wont_fix: { label: "Won't Fix", color: "bg-muted text-muted-foreground" },
};

const FeedbackAdmin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (isAdmin) fetchFeedback();
  }, [isAdmin]);

  const checkAdmin = async () => {
    const { data } = await supabase.rpc("has_role", {
      _user_id: user!.id,
      _role: "admin",
    });
    setIsAdmin(!!data);
  };

  const fetchFeedback = async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading feedback", variant: "destructive" });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("feedback")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({ title: "Error updating", variant: "destructive" });
    } else {
      toast({ title: `Marked as ${statusConfig[status]?.label || status}` });
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      if (selectedItem?.id === id) setSelectedItem(prev => prev ? { ...prev, status } : null);
    }
    setSaving(false);
  };

  const saveNotes = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("feedback")
      .update({ admin_notes: adminNotes })
      .eq("id", id);

    if (error) {
      toast({ title: "Error saving notes", variant: "destructive" });
    } else {
      toast({ title: "Notes saved" });
      setItems(prev => prev.map(i => i.id === id ? { ...i, admin_notes: adminNotes } : i));
    }
    setSaving(false);
  };

  const setActionTaken = async (id: string, action: string) => {
    setSaving(true);
    const newStatus = action === "fix_it" ? "in_progress" : action === "implement" ? "in_progress" : "reviewed";
    const { error } = await supabase
      .from("feedback")
      .update({ action_taken: action, status: newStatus })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", variant: "destructive" });
    } else {
      toast({ title: action === "fix_it" ? "Marked for fixing" : action === "implement" ? "Marked for implementation" : "Acknowledged ✓" });
      setItems(prev => prev.map(i => i.id === id ? { ...i, action_taken: action, status: newStatus } : i));
      if (selectedItem?.id === id) setSelectedItem(prev => prev ? { ...prev, action_taken: action, status: newStatus } : null);
    }
    setSaving(false);
  };

  if (isAdmin === null) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (isAdmin === false) return <Navigate to="/circle" replace />;

  const filtered = filter === "all" ? items : items.filter(i => i.category === filter || i.status === filter);

  const parseMessage = (msg: string) => {
    const summaryMatch = msg.match(/\[AI Summary\]\s*(.*?)(?:\n|$)/);
    const conversationMatch = msg.match(/\[Full conversation\]\s*([\s\S]*)/);
    return {
      summary: summaryMatch?.[1]?.trim() || msg,
      conversation: conversationMatch?.[1]?.trim() || null,
    };
  };

  return (
    <div className="min-h-screen p-4 md:p-6 pb-24">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Feedback Dashboard</h1>
          <p className="text-sm text-muted-foreground">{items.length} total submissions</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { key: "all", label: "All", count: items.length, icon: MessageCircle },
            { key: "bug", label: "Bugs", count: items.filter(i => i.category === "bug").length, icon: Bug },
            { key: "feature", label: "Features", count: items.filter(i => i.category === "feature").length, icon: Lightbulb },
            { key: "new", label: "New", count: items.filter(i => i.status === "new").length, icon: Clock },
            { key: "in_progress", label: "In Progress", count: items.filter(i => i.status === "in_progress").length, icon: ArrowRight },
          ].map(s => (
            <Card
              key={s.key}
              className={`cursor-pointer transition-all hover:shadow-md ${filter === s.key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilter(s.key)}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feedback list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const cat = categoryConfig[item.category] || categoryConfig.general;
              const stat = statusConfig[item.status] || statusConfig.new;
              const { summary } = parseMessage(item.message);
              const CatIcon = cat.icon;

              return (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => { setSelectedItem(item); setAdminNotes(item.admin_notes || ""); }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge className={`text-xs ${cat.color}`}>
                            <CatIcon className="h-3 w-3 mr-1" />
                            {cat.label}
                          </Badge>
                          <Badge className={`text-xs ${stat.color}`}>{stat.label}</Badge>
                          {item.action_taken && (
                            <Badge variant="outline" className="text-xs">
                              {item.action_taken === "fix_it" ? "Fix" : item.action_taken === "implement" ? "Implement" : "✓ Ack"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm line-clamp-2">{summary}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          {item.page_url && <span>{item.page_url}</span>}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {item.category === "bug" && item.action_taken !== "fix_it" && (
                          <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => setActionTaken(item.id, "fix_it")}>
                            Fix
                          </Button>
                        )}
                        {item.category === "feature" && item.action_taken !== "implement" && (
                          <Button size="sm" className="h-8 text-xs" onClick={() => setActionTaken(item.id, "implement")}>
                            Implement
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(item.id, "reviewed")}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Reviewed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(item.id, "in_progress")}>
                              <ArrowRight className="h-4 w-4 mr-2" /> In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(item.id, "implemented")}>
                              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Implemented
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(item.id, "wont_fix")}>
                              <X className="h-4 w-4 mr-2" /> Won't Fix
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No feedback found for this filter
              </div>
            )}
          </div>
        )}

        {/* Detail modal */}
        {selectedItem && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={categoryConfig[selectedItem.category]?.color || ""}>
                        {categoryConfig[selectedItem.category]?.label || selectedItem.category}
                      </Badge>
                      <Badge className={statusConfig[selectedItem.status]?.color || ""}>
                        {statusConfig[selectedItem.status]?.label || selectedItem.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">
                      {new Date(selectedItem.created_at).toLocaleString()}
                      {selectedItem.page_url && <span className="text-muted-foreground font-normal text-sm ml-2">on {selectedItem.page_url}</span>}
                    </CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-auto space-y-4">
                {/* Full message */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">AI Summary</h3>
                  <p className="text-sm bg-muted p-3 rounded-lg">{parseMessage(selectedItem.message).summary}</p>
                </div>

                {parseMessage(selectedItem.message).conversation && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Full Conversation</h3>
                    <ScrollArea className="max-h-48">
                      <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap font-sans">
                        {parseMessage(selectedItem.message).conversation}
                      </pre>
                    </ScrollArea>
                  </div>
                )}

                {selectedItem.screenshot_url && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Screenshot</h3>
                    <img src={selectedItem.screenshot_url} alt="Feedback screenshot" className="rounded-lg max-h-48 object-contain" />
                  </div>
                )}

                {/* Action buttons */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Take Action</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={selectedItem.action_taken === "fix_it" ? "default" : "outline"}
                      onClick={() => setActionTaken(selectedItem.id, "fix_it")}
                      disabled={saving}
                    >
                      Fix This Bug
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedItem.action_taken === "implement" ? "default" : "outline"}
                      onClick={() => setActionTaken(selectedItem.id, "implement")}
                      disabled={saving}
                    >
                      Implement Feature
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedItem.action_taken === "acknowledge" ? "default" : "outline"}
                      onClick={() => setActionTaken(selectedItem.id, "acknowledge")}
                      disabled={saving}
                    >
                      ✓ Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatus(selectedItem.id, "wont_fix")}
                      disabled={saving}
                    >
                      Won't Fix
                    </Button>
                  </div>
                </div>

                {/* Admin notes */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Admin Notes</h3>
                  <Textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes about this feedback..."
                    className="text-sm"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => saveNotes(selectedItem.id)}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Save Notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackAdmin;
