import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ExternalLink, Mail, Phone, Globe, ImageOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const PartnerSubmissionsTab = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from('partner_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });
    
    setSubmissions(data || []);
    setLoading(false);
  };

  const handleApprove = async (submission: any) => {
    try {
      // Create partner discount
      const { error: insertError } = await supabase
        .from('partner_discounts')
        .insert({
          partner_name: submission.company_name,
          partner_logo_url: submission.logo_url,
          discount_type: submission.discount_type,
          discount_value: submission.discount_value,
          description: submission.description,
          terms: submission.terms,
          category: submission.category,
          tier_required: submission.tier_required,
          redemption_url: submission.redemption_url,
          redemption_code: submission.redemption_code,
          is_active: true
        });

      if (insertError) throw insertError;

      // Update submission status
      const { error: updateError } = await supabase
        .from('partner_submissions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', submission.id);

      if (updateError) throw updateError;

      toast({
        title: "Partner approved!",
        description: `${submission.company_name} is now live`
      });
      
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Failed to approve",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission || !rejectionReason) return;

    try {
      const { error } = await supabase
        .from('partner_submissions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      toast({
        title: "Submission rejected",
        description: "The partner has been notified"
      });
      
      setSelectedSubmission(null);
      setRejectionReason("");
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Failed to reject",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const pendingSubmissions = submissions.filter(s => s.status === 'pending');
  const reviewedSubmissions = submissions.filter(s => s.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Partner Submissions</h2>
        <p className="text-muted-foreground">
          Review and approve partner discount applications
        </p>
      </div>

      {/* Pending Submissions */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Pending ({pendingSubmissions.length})</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {pendingSubmissions.map(submission => (
            <Card key={submission.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {failedLogos.has(submission.id) ? (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                        <ImageOff className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    ) : (
                      <img
                        src={submission.logo_url}
                        alt={submission.company_name}
                        loading="lazy"
                        onError={() => setFailedLogos((prev) => new Set(prev).add(submission.id))}
                        className="h-12 w-12 object-contain rounded"
                      />
                    )}
                    <div>
                      <CardTitle className="text-lg">{submission.company_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="secondary">{submission.category}</Badge>
                        <Badge>{submission.tier_required}</Badge>
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Offer</p>
                  <p className="text-lg font-bold text-primary">{submission.discount_value}</p>
                  <p className="text-sm text-muted-foreground">{submission.description}</p>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {submission.contact_email}
                </div>

                {submission.contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {submission.contact_phone}
                  </div>
                )}

                {submission.website_url && (
                  <a
                    href={submission.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    Visit Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    variant="default"
                    onClick={() => handleApprove(submission)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    onClick={() => setSelectedSubmission(submission)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {pendingSubmissions.length === 0 && (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No pending submissions
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reviewed Submissions */}
      {reviewedSubmissions.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Reviewed ({reviewedSubmissions.length})</h3>
          <div className="space-y-2">
            {reviewedSubmissions.map(submission => (
              <Card key={submission.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {failedLogos.has(submission.id) ? (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                        <ImageOff className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    ) : (
                      <img
                        src={submission.logo_url}
                        alt={submission.company_name}
                        loading="lazy"
                        onError={() => setFailedLogos((prev) => new Set(prev).add(submission.id))}
                        className="h-10 w-10 object-contain rounded"
                      />
                    )}
                    <div>
                      <p className="font-medium">{submission.company_name}</p>
                      <p className="text-sm text-muted-foreground">{submission.contact_email}</p>
                    </div>
                  </div>
                  <Badge variant={submission.status === 'approved' ? 'default' : 'destructive'}>
                    {submission.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Partnership Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this application
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelectedSubmission(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleReject}
                disabled={!rejectionReason}
              >
                Reject Application
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
