import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VerificationRequest {
  id: string;
  user_id: string;
  profile_data: any;
  ai_score: number;
  ai_decision: string;
  ai_reasoning: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
    role: string;
  };
}

export const VerificationTab = () => {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    
    // Fetch verification requests
    const { data: requestsData, error: requestsError } = await supabase
      .from("verification_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (requestsError) {
      console.error("Error fetching verification requests:", requestsError);
      toast({
        title: "Error",
        description: "Failed to load verification requests",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Fetch associated profiles
    if (requestsData && requestsData.length > 0) {
      const userIds = requestsData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, role")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      // Merge the data and remove duplicates (keep most recent per user)
      const mergedData = requestsData.map(request => {
        const profile = profilesData?.find(p => p.user_id === request.user_id);
        return {
          ...request,
          profiles: profile || { full_name: "Unknown", avatar_url: "", role: "Unknown" }
        };
      });

      // Remove duplicates - keep only the most recent request per user_id
      const uniqueRequests = mergedData.reduce((acc, current) => {
        const existingIndex = acc.findIndex(item => item.user_id === current.user_id);
        if (existingIndex === -1) {
          acc.push(current);
        } else {
          // Keep the more recent one
          if (new Date(current.created_at) > new Date(acc[existingIndex].created_at)) {
            acc[existingIndex] = current;
          }
        }
        return acc;
      }, [] as any[]);

      setRequests(uniqueRequests as VerificationRequest[]);
    } else {
      setRequests([]);
    }

    setLoading(false);
  };

  const handleApprove = async (request: VerificationRequest) => {
    setActionLoading(true);
    try {
      // Update verification request
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({
          status: "approved",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      // profiles.verification_status is admin-only, enforced server-side —
      // this RPC also fixes a latent bug: the raw .update() below used to
      // target another user's row with no admin RLS policy backing it, so
      // it was silently affecting 0 rows even though this toast claimed
      // success.
      const { error: profileError } = await supabase.rpc("admin_verify_profile_identity", {
        p_user_id: request.user_id,
        p_approved: true,
      });

      if (profileError) throw profileError;

      toast({
        title: "Approved",
        description: "User profile has been verified",
      });

      fetchRequests();
    } catch (error) {
      console.error("Error approving:", error);
      toast({
        title: "Error",
        description: "Failed to approve profile",
        variant: "destructive",
      });
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
    try {
      // Update verification request
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({
          status: "rejected",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq("id", selectedRequest.id);

      if (requestError) throw requestError;

      // Same admin-only path as approval above.
      const { error: profileError } = await supabase.rpc("admin_verify_profile_identity", {
        p_user_id: selectedRequest.user_id,
        p_approved: false,
        p_notes: rejectionReason,
      });

      if (profileError) throw profileError;

      toast({
        title: "Rejected",
        description: "Profile has been rejected",
      });

      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedRequest(null);
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting:", error);
      toast({
        title: "Error",
        description: "Failed to reject profile",
        variant: "destructive",
      });
    }
    setActionLoading(false);
  };

  const getScoreBadge = (score: number) => {
    if (score >= 75) return <Badge className="bg-green-500">High: {score}</Badge>;
    if (score >= 50) return <Badge variant="secondary">Medium: {score}</Badge>;
    return <Badge variant="destructive">Low: {score}</Badge>;
  };

  const renderRequest = (request: VerificationRequest) => (
    <Card key={request.id}>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {request.profiles.avatar_url && !failedAvatars.has(request.id) && (
              <img
                src={request.profiles.avatar_url}
                alt={request.profiles.full_name}
                loading="lazy"
                onError={() => setFailedAvatars((prev) => new Set(prev).add(request.id))}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg truncate">{request.profiles.full_name}</CardTitle>
              <CardDescription className="text-xs sm:text-sm truncate">{request.profiles.role}</CardDescription>
            </div>
          </div>
          <div className="flex-shrink-0">
            {getScoreBadge(request.ai_score)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
        <div>
          <h4 className="text-sm sm:text-base font-semibold mb-1 sm:mb-2">AI Analysis</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">{request.ai_reasoning}</p>
        </div>

        <div>
          <h4 className="text-sm sm:text-base font-semibold mb-1 sm:mb-2">Profile Data</h4>
          <div className="text-xs sm:text-sm space-y-1">
            <p><strong>Account Type:</strong> {request.profile_data.accountType}</p>
            {request.profile_data.bio && (
              <p><strong>Bio:</strong> {request.profile_data.bio}</p>
            )}
            {request.profile_data.website && (
              <p>
                <strong>Website:</strong>{" "}
                <a href={request.profile_data.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {request.profile_data.website} <ExternalLink className="inline h-3 w-3" />
                </a>
              </p>
            )}
            {request.profile_data.portfolioItems > 0 && (
              <p><strong>Portfolio Items:</strong> {request.profile_data.portfolioItems}</p>
            )}
          </div>
        </div>

        {request.profile_data.socialLinks && Object.keys(request.profile_data.socialLinks).length > 0 && (
          <div>
            <h4 className="text-sm sm:text-base font-semibold mb-1 sm:mb-2">Social Links</h4>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {Object.entries(request.profile_data.socialLinks).map(([platform, url]: [string, any]) => 
                url && (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 bg-secondary rounded-md hover:bg-secondary/80 flex items-center gap-1"
                  >
                    {platform} <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </a>
                )
              )}
            </div>
          </div>
        )}

        {(request.status === "pending" || request.status === "flagged" || request.status === "appealed") && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => handleApprove(request)}
              disabled={actionLoading}
              className="flex-1 text-sm"
              size="sm"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setSelectedRequest(request);
                setShowRejectDialog(true);
              }}
              disabled={actionLoading}
              className="flex-1 text-sm"
              size="sm"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === "pending");
  const flaggedRequests = requests.filter(r => r.status === "flagged");
  const approvedRequests = requests.filter(r => r.status === "approved");
  const rejectedRequests = requests.filter(r => r.status === "rejected");
  const appealedRequests = requests.filter(r => r.status === "appealed");

  return (
    <>
      <Tabs defaultValue="flagged" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1">
          <TabsTrigger value="flagged" className="text-xs sm:text-sm px-1 sm:px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Flagged ({flaggedRequests.length})</span>
            <span className="sm:hidden">Flag ({flaggedRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="appealed" className="text-xs sm:text-sm px-1 sm:px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Appeals ({appealedRequests.length})</span>
            <span className="sm:hidden">App ({appealedRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs sm:text-sm px-1 sm:px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Pending ({pendingRequests.length})</span>
            <span className="sm:hidden">Pend ({pendingRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs sm:text-sm px-1 sm:px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Approved ({approvedRequests.length})</span>
            <span className="sm:hidden">App ({approvedRequests.length})</span>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs sm:text-sm px-1 sm:px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="hidden sm:inline">Rejected ({rejectedRequests.length})</span>
            <span className="sm:hidden">Rej ({rejectedRequests.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flagged" className="space-y-4">
          {flaggedRequests.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No profiles flagged for review</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            flaggedRequests.map(renderRequest)
          )}
        </TabsContent>

        <TabsContent value="appealed" className="space-y-4">
          {appealedRequests.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">No appeals pending</p>
              </CardContent>
            </Card>
          ) : (
            appealedRequests.map(renderRequest)
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">No pending verifications</p>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map(renderRequest)
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedRequests.map(renderRequest)}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedRequests.map(renderRequest)}
        </TabsContent>
      </Tabs>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Profile Verification</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be visible to the user.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain why this profile doesn't meet verification standards..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reject Profile"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};