import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'thrivein-newsletter-dismissed';
const DELAY_MS = 30000; // 30 seconds

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const timer = setTimeout(() => {
      // Only show for guests (not logged in)
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) {
          setOpen(true);
        }
      }).catch(() => {});
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      // Store in dedicated newsletter_subscribers table
      const { error: subError } = await supabase
        .from('newsletter_subscribers')
        .upsert({
          email: email.trim().toLowerCase(),
          source: 'popup',
          segments: ['weekly_founder_message', 'spotlight'],
          metadata: { page_path: window.location.pathname, referrer: document.referrer },
        }, { onConflict: 'email' });

      if (subError) throw subError;

      // Also track as analytics event (fire-and-forget)
      void supabase
        .from('analytics_events')
        .insert({
          event_name: 'newsletter_signup',
          event_category: 'engagement',
          event_properties: { email: email.trim(), source: 'popup' },
          page_path: window.location.pathname,
        });

      setSubmitted(true);
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      toast({
        title: "You're in!",
        description: "Welcome to the Kretopia creative community.",
      });
      setTimeout(() => setOpen(false), 2000);
    } catch (err) {
      console.error('[Newsletter] Error:', err);
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="sm:max-w-md border-primary/20">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Stay in the Creative Loop
          </DialogTitle>
          <DialogDescription className="text-center">
            Get weekly insights, opportunities, and stories from the creative industry — straight to your inbox.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-4">
            <p className="text-primary font-semibold">Welcome aboard!</p>
            <p className="text-sm text-muted-foreground mt-1">Check your inbox soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-center"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Subscribing...' : 'Subscribe — It\'s Free'}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              No spam. Unsubscribe anytime.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
