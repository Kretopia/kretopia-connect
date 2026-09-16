import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, ExternalLink, Mail, User } from "lucide-react";

interface WaitlistEntry {
  id: string;
  email: string;
  full_name: string;
  role: string;
  instagram_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  spotify_url: string | null;
  website: string | null;
  bio: string | null;
  why_join: string | null;
  status: string;
  created_at: string;
  ai_score: number | null;
  ai_decision: string | null;
  ai_reasoning: string | null;
  invite_code: string | null;
}

const WaitlistAdmin = () => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // For now, this is a simple admin check. You'll want to add proper admin roles later
    if (!user) {
      navigate("/auth");
      return;
    }

    fetchWaitlist();
  }, [user, navigate]);

  const fetchWaitlist = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("waitlist")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch waitlist",
        variant: "destructive",
      });
    } else {
      setWaitlist(data || []);
    }
    setLoading(false);
  };

  const handleApprove = async (entry: WaitlistEntry) => {
    const { error: updateError } = await supabase
      .from("waitlist")
      .update({ 
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", entry.id);

    if (updateError) {
      toast({
        title: "Error",
        description: "Failed to approve entry",
        variant: "destructive",
      });
      return;
    }

    // TODO: Send email with invite code to the approved user
    // For now, just update the UI
    toast({
      title: "Approved!",
      description: `${entry.full_name} has been approved. Send them an invite code manually.`,
    });

    fetchWaitlist();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("waitlist")
      .update({ 
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject entry",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Rejected",
        description: "Entry has been rejected",
      });
      fetchWaitlist();
    }
  };

  const renderEntry = (entry: WaitlistEntry) => (
    <Card key={entry.id} className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{entry.full_name}</h3>
            <p className="text-sm text-muted-foreground">{entry.role}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Mail className="h-3 w-3" />
              {entry.email}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={
            entry.status === "approved" || entry.status === "auto_approved" ? "default" :
            entry.status === "rejected" ? "destructive" : "secondary"
          }>
            {entry.status}
          </Badge>
          {entry.ai_score !== null && (
            <Badge variant="outline" className="text-xs">
              AI Score: {entry.ai_score}/100
            </Badge>
          )}
        </div>
      </div>

      {entry.ai_reasoning && (
        <div className="mb-3 p-3 bg-accent/50 rounded-lg">
          <p className="text-xs font-medium mb-1">AI Analysis:</p>
          <p className="text-xs text-muted-foreground">{entry.ai_reasoning}</p>
        </div>
      )}

      {entry.invite_code && (
        <div className="mb-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-xs font-medium mb-1">Invite Code:</p>
          <p className="text-sm font-mono font-bold text-primary">{entry.invite_code}</p>
        </div>
      )}

      {entry.bio && (
        <div className="mb-3">
          <p className="text-sm font-medium mb-1">Bio:</p>
          <p className="text-sm text-muted-foreground">{entry.bio}</p>
        </div>
      )}

      {entry.why_join && (
        <div className="mb-3">
          <p className="text-sm font-medium mb-1">Why Join:</p>
          <p className="text-sm text-muted-foreground">{entry.why_join}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {entry.instagram_url && (
          <a href={entry.instagram_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Instagram <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
        {entry.twitter_url && (
          <a href={entry.twitter_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Twitter <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
        {entry.linkedin_url && (
          <a href={entry.linkedin_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              LinkedIn <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
        {entry.spotify_url && (
          <a href={entry.spotify_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Spotify <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
        {entry.website && (
          <a href={entry.website} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Website <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </a>
        )}
      </div>

      {entry.status === "pending" && (
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => handleApprove(entry)}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleReject(entry.id)}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Applied: {new Date(entry.created_at).toLocaleDateString()}
      </p>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading waitlist...</p>
      </div>
    );
  }

  const pending = waitlist.filter(e => e.status === "pending");
  const approved = waitlist.filter(e => e.status === "approved");
  const rejected = waitlist.filter(e => e.status === "rejected");

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Waitlist Management</h1>
          <p className="text-muted-foreground">
            Review and approve creator applications
          </p>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="pending">
              Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({approved.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({rejected.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pending.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No pending applications</p>
              </Card>
            ) : (
              pending.map(renderEntry)
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approved.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No approved applications</p>
              </Card>
            ) : (
              approved.map(renderEntry)
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejected.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No rejected applications</p>
              </Card>
            ) : (
              rejected.map(renderEntry)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WaitlistAdmin;
