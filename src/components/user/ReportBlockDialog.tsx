import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Ban, Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ReportBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  mode: 'report' | 'block';
  onBlocked?: () => void;
}

const REPORT_REASONS = [
  { value: 'spam', label: '🚫 Spam', description: 'Unsolicited or repetitive content' },
  { value: 'harassment', label: 'Harassment', description: 'Bullying, threats, or intimidation' },
  { value: 'fake_profile', label: 'Fake Profile', description: 'Impersonation or misleading identity' },
  { value: 'inappropriate_content', label: '🔞 Inappropriate Content', description: 'Offensive or NSFW material' },
  { value: 'other', label: 'Other', description: 'Something else not listed above' },
] as const;

export function ReportBlockDialog({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  mode,
  onBlocked,
}: ReportBlockDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alsoBlock, setAlsoBlock] = useState(false);

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSubmitting(true);

    try {
      if (mode === 'report') {
        if (!reason) {
          toast({ title: 'Please select a reason', variant: 'destructive' });
          setSubmitting(false);
          return;
        }

        const { error } = await supabase.from('user_reports').insert({
          reporter_id: user.id,
          reported_user_id: targetUserId,
          reason,
          description: description.trim() || null,
        });

        if (error) throw error;

        // Also block if checked
        if (alsoBlock) {
          await supabase.from('user_blocks').insert({
            blocker_id: user.id,
            blocked_user_id: targetUserId,
          });
          onBlocked?.();
        }

        toast({
          title: 'Report Submitted',
          description: 'Thank you. Our team will review this report.',
        });
      } else {
        // Block mode
        const { error } = await supabase.from('user_blocks').insert({
          blocker_id: user.id,
          blocked_user_id: targetUserId,
        });

        if (error) {
          if (error.code === '23505') {
            toast({ title: 'Already blocked', description: `${targetUserName} is already blocked.` });
          } else {
            throw error;
          }
        } else {
          toast({
            title: 'User Blocked',
            description: `${targetUserName} has been blocked. They won't appear in your feed or be able to message you.`,
          });
          onBlocked?.();
        }
      }

      onOpenChange(false);
      setReason('');
      setDescription('');
      setAlsoBlock(false);
    } catch (err: any) {
      console.error('[ReportBlock] Error:', err);
      toast({ title: 'Error', description: err.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'report' ? (
              <>
                <Flag className="h-5 w-5 text-destructive" />
                Report {targetUserName}
              </>
            ) : (
              <>
                <Ban className="h-5 w-5 text-destructive" />
                Block {targetUserName}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'report'
              ? 'Help us keep the community safe. Select a reason for your report.'
              : `Blocking ${targetUserName} will hide them from your feed, remove any connections, and prevent messaging.`}
          </DialogDescription>
        </DialogHeader>

        {mode === 'report' && (
          <div className="space-y-4">
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={r.value} id={r.value} className="mt-0.5" />
                  <Label htmlFor={r.value} className="cursor-pointer flex-1">
                    <div className="font-medium text-sm">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.description}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div>
              <Label htmlFor="description" className="text-sm">Additional details (optional)</Label>
              <Textarea
                id="description"
                placeholder="Provide any additional context..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <input
                type="checkbox"
                id="also-block"
                checked={alsoBlock}
                onChange={(e) => setAlsoBlock(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="also-block" className="text-sm cursor-pointer">
                Also block this user
              </Label>
            </div>
          </div>
        )}

        {mode === 'block' && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>This will:</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Remove any existing connection</li>
                  <li>Hide them from your discovery feed</li>
                  <li>Prevent them from messaging you</li>
                </ul>
                <p className="mt-2">You can unblock them later from Settings.</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || (mode === 'report' && !reason)}
          >
            {submitting ? 'Submitting...' : mode === 'report' ? 'Submit Report' : 'Block User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
