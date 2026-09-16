import { useState, useEffect, useRef, useCallback } from "react";
import { useDeskIntent } from "@/hooks/useDeskIntent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, AlertCircle, Clock, Upload, MessageSquare,
  Eye, ChevronDown, ChevronUp, Plus, Send, Image as ImageIcon, Film, FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { getProjectFileSignedUrl } from "@/lib/projectFiles";

interface Deliverable {
  id: string;
  title: string;
  description: string | null;
  version: number;
  status: string;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  media_type: string | null;
  created_at: string;
}

interface DeliverableComment {
  id: string;
  content: string;
  user_id: string;
  annotation_x: number | null;
  annotation_y: number | null;
  created_at: string;
  profiles?: { full_name: string; avatar_url: string | null } | null;
}

interface ApprovalWorkflowsProps {
  projectId: string;
  currentUserId: string;
  collaborators: Array<{ id: string; full_name: string; avatar_url: string | null }>;
  userRole: 'creator' | 'client';
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  pending: { label: "Pending Review", icon: Clock, color: "bg-muted text-muted-foreground" },
  in_review: { label: "In Review", icon: Eye, color: "bg-primary/10 text-primary" },
  approved: { label: "Approved", icon: CheckCircle2, color: "bg-green-500/10 text-green-500" },
  revision_requested: { label: "Revision Needed", icon: AlertCircle, color: "bg-amber-500/10 text-amber-500" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-destructive/10 text-destructive" },
};

export const ApprovalWorkflows = ({ projectId, currentUserId, collaborators, userRole }: ApprovalWorkflowsProps) => {
  const { toast } = useToast();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [comments, setComments] = useState<DeliverableComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen for "create-approval" intent (NextStepBar / chat action chips)
  useDeskIntent("approvals", useCallback((intent, payload) => {
    if (intent === "create-approval") {
      setShowCreateForm(true);
      if (payload?.title) setNewTitle(String(payload.title));
      if (payload?.description) setNewDescription(String(payload.description));
    }
  }, []));

  useEffect(() => {
    fetchDeliverables();
    const channel = supabase
      .channel(`deliverables:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_deliverables', filter: `project_id=eq.${projectId}` }, () => fetchDeliverables())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  useEffect(() => {
    if (selectedDeliverable) {
      fetchComments(selectedDeliverable.id);
    }
  }, [selectedDeliverable]);

  const fetchDeliverables = async () => {
    const { data } = await supabase
      .from('project_deliverables')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setDeliverables(data || []);
    setLoading(false);
  };

  const fetchComments = async (deliverableId: string) => {
    const { data } = await supabase
      .from('deliverable_comments')
      .select('*')
      .eq('deliverable_id', deliverableId)
      .order('created_at', { ascending: true });
    if (data) {
      const enriched = await Promise.all(
        data.map(async (c) => {
          const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('user_id', c.user_id).single();
          return { ...c, profiles: profile };
        })
      );
      setComments(enriched);
    }
  };

  const handleSubmitDeliverable = async (file?: File) => {
    if (!newTitle.trim()) return;
    setUploading(true);
    try {
      let fileUrl: string | null = null;
      let mediaType = 'document';
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${projectId}/deliverables/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('project-files').upload(path, file);
        if (upErr) throw upErr;
        fileUrl = path;
        if (file.type.startsWith('image/')) mediaType = 'image';
        else if (file.type.startsWith('video/')) mediaType = 'video';
        else if (file.type.startsWith('audio/')) mediaType = 'audio';
      }
      const { error } = await supabase.from('project_deliverables').insert({
        project_id: projectId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        submitted_by: currentUserId,
        file_url: fileUrl,
        media_type: mediaType,
        status: 'pending',
      });
      if (error) throw error;
      setNewTitle("");
      setNewDescription("");
      setShowCreateForm(false);
      toast({ title: "Deliverable submitted", description: "Waiting for review" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleReview = async (deliverableId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('project_deliverables')
        .update({ status: newStatus, reviewed_by: currentUserId, reviewed_at: new Date().toISOString(), review_note: reviewNote || null })
        .eq('id', deliverableId);
      if (error) throw error;
      setReviewNote("");
      setSelectedDeliverable(null);
      toast({ title: `Deliverable ${newStatus.replace('_', ' ')}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDeliverable) return;
    try {
      const { error } = await supabase.from('deliverable_comments').insert({
        deliverable_id: selectedDeliverable.id,
        user_id: currentUserId,
        content: newComment.trim(),
      });
      if (error) throw error;
      setNewComment("");
      fetchComments(selectedDeliverable.id);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getSubmitterName = (userId: string) => {
    const c = collaborators.find(c => c.id === userId);
    return c?.full_name || 'Unknown';
  };

  const getMediaIcon = (mediaType: string | null) => {
    if (mediaType === 'image') return <ImageIcon className="h-5 w-5" />;
    if (mediaType === 'video') return <Film className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const pendingCount = deliverables.filter(d => d.status === 'pending' || d.status === 'in_review').length;
  const approvedCount = deliverables.filter(d => d.status === 'approved').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Approvals
          </h2>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pending · {approvedCount} approved
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Submit Deliverable
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Deliverable title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <Textarea placeholder="Description (optional)..." value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" /> Attach File
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) handleSubmitDeliverable(e.target.files[0]); }} />
              <Button size="sm" onClick={() => handleSubmitDeliverable()} disabled={!newTitle.trim() || uploading}>
                {uploading ? "Uploading..." : "Submit for Review"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deliverables list */}
      {deliverables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No deliverables yet</p>
            <p className="text-sm mt-1">Submit work for client review and approval</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {deliverables.map((d) => {
            const sc = statusConfig[d.status] || statusConfig.pending;
            const StatusIcon = sc.icon;
            return (
              <Card key={d.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedDeliverable(d)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Preview thumbnail */}
                    {d.file_url && d.media_type === 'image' ? (
                      <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0">
                        <img src={d.file_url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                        {getMediaIcon(d.media_type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{d.title}</h3>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${sc.color}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {sc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        v{d.version} · by {getSubmitterName(d.submitted_by)} · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                      </p>
                      {d.review_note && (
                        <p className="text-xs mt-1 text-muted-foreground italic">"{d.review_note}"</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedDeliverable} onOpenChange={(open) => { if (!open) setSelectedDeliverable(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedDeliverable && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedDeliverable.title}
                  <Badge variant="secondary" className={statusConfig[selectedDeliverable.status]?.color}>
                    {statusConfig[selectedDeliverable.status]?.label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              {/* File preview */}
              {selectedDeliverable.file_url && (
                <div className="rounded-lg overflow-hidden bg-muted">
                  {selectedDeliverable.media_type === 'image' ? (
                    <img src={selectedDeliverable.file_url} alt={selectedDeliverable.title} className="w-full max-h-96 object-contain" />
                  ) : selectedDeliverable.media_type === 'video' ? (
                    <video src={selectedDeliverable.file_url} controls className="w-full max-h-96" />
                  ) : (
                    <div className="p-8 text-center">
                      <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
                      <a href={selectedDeliverable.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                        Open file
                      </a>
                    </div>
                  )}
                </div>
              )}

              {selectedDeliverable.description && (
                <p className="text-sm text-muted-foreground">{selectedDeliverable.description}</p>
              )}

              {/* Review actions */}
              {selectedDeliverable.status !== 'approved' && (
                <div className="space-y-3 border-t pt-3">
                  <Textarea
                    placeholder="Add review feedback..."
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleReview(selectedDeliverable.id, 'approved')}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="border-amber-500 text-amber-500 hover:bg-amber-500/10" onClick={() => handleReview(selectedDeliverable.id, 'revision_requested')}>
                      <AlertCircle className="h-4 w-4 mr-1" /> Request Revision
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReview(selectedDeliverable.id, 'rejected')}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Comments / Feedback thread */}
              <div className="border-t pt-3">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" /> Feedback ({comments.length})
                </h4>
                <ScrollArea className="max-h-48">
                  <div className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={c.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">{c.profiles?.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium">{c.profiles?.full_name}</span>
                            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                          </div>
                          <p className="text-sm">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 mt-3">
                  <Input placeholder="Add feedback..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
                  <Button size="icon" onClick={handleAddComment} disabled={!newComment.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
