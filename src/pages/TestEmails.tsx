import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

const TestEmails = () => {
  const [email, setEmail] = useState("thriveuae@gmail.com");
  const [loading, setLoading] = useState(false);

  const sendTestEmails = async () => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-emails', {
        body: { email }
      });

      if (error) throw error;

      toast.success(`Successfully sent ${data.emailTypes.length} test emails to ${email}!`);
      console.log('Test emails sent:', data);
    } catch (error: any) {
      console.error('Error sending test emails:', error);
      toast.error(error.message || "Failed to send test emails");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Test Email Templates
          </CardTitle>
          <CardDescription>
            Send test emails to preview all email templates in your inbox
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This will send the following email templates:
            </p>
            <ul className="text-sm space-y-1 text-muted-foreground ml-4">
              <li>• Welcome Email</li>
              <li>• New Opportunity Alert</li>
              <li>• Match Notification</li>
              <li>• Application Status Update</li>
              <li>• Re-engagement Email</li>
              <li>• Weekly Digest</li>
              <li>• Activity Digest</li>
              <li>• Streak Warning</li>
            </ul>
          </div>

          <Button 
            onClick={sendTestEmails} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Test Emails...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Test Emails
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestEmails;
