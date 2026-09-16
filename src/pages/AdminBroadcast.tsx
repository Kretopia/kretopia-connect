import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Bell, TestTube } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const AdminBroadcast = () => {
  const [title, setTitle] = useState("New on Kretopia: Voice tasks, video calls & KrePay");
  const [message, setMessage] = useState(`Hey Creator,

We shipped a lot this week — here's what's new in your Studio:

🎙️ Voice-to-Task — Tap the mic on ThriveDesk and talk. Copilot turns it into tasks with assignees and due dates.

🎬 Studio Room (mobile) — One smooth scroll: mood-tinted cover, Next Step, task feed. Done tasks auto-collapse so the list stays clean.

📞 Video Calls — One-tap from any chat or project. Group calls live in your Circles. Missed-call history in Messages.

🤖 Kreto — A proactive operator inside Desk that can draft invoices, start calls, and log credits for you.

💸 KrePay — New Pay tab in the bottom nav. Money Streak rewards you for invoicing, logging expenses, and scanning receipts.

📋 Smart Brief & The Vault — Voice or text → deliverables, moodboard, and tasks. The Vault keeps every project file in one place.

🏆 Founding Member Quest Board — Live progress at /founding-member. Only 135 OG seats — see how close you are.

— Build your Circle —
Great collabs start with the right people around you. Invite trusted creatives — better Circle = better matches, sharper credits, stronger ThriveStatus.

Top inviters this month get featured in Spotlight + early access to the next drop.

See you inside,
Ethan
Founder, Kretopia`);
  const [link, setLink] = useState("/circle");
  const [testEmail, setTestEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendInApp, setSendInApp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [userCount, setUserCount] = useState(0);

  // Get user count on mount
  useEffect(() => {
    const fetchUserCount = async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      setUserCount(count || 0);
    };
    fetchUserCount();
  }, []);

  const sendTestEmail = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }

    if (!title || !message) {
      toast.error("Please enter both title and message");
      return;
    }

    setTestLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          to: testEmail,
          type: 'general',
          data: {
            userName: 'Test User',
            notificationTitle: title,
            notificationMessage: message,
            actionUrl: link.startsWith('/') ? `https://kretopia.com${link}` : (link || 'https://kretopia.com')
          }
        }
      });

      if (error) throw error;
      toast.success(`Test email sent to ${testEmail}!`);
    } catch (error: any) {
      console.error('Test email error:', error);
      toast.error(error.message || "Failed to send test email");
    } finally {
      setTestLoading(false);
    }
  };

  const broadcastNotification = async () => {
    if (!title || !message) {
      toast.error("Please enter both title and message");
      return;
    }

    if (!sendEmail && !sendInApp) {
      toast.error("Please select at least one notification method");
      return;
    }

    // Confirm before sending to all users
    const confirmed = window.confirm(`Are you sure you want to send this broadcast to ${userCount} users?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      // Get all users with their emails via recipientId approach
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      if (profilesError) throw profilesError;

      let successCount = 0;
      let errorCount = 0;

      // Send to each user
      for (const profile of profiles || []) {
        try {
          // Create in-app notification if enabled
          if (sendInApp) {
            const { error: notifError } = await supabase
              .from('notifications')
              .insert({
                user_id: profile.user_id,
                title,
                message,
                type: 'general',
                link: link || null,
                priority: 'high',
                category: 'announcement'
              });

            if (notifError) {
              console.error('In-app notification error:', notifError);
            }
          }

          // Send email notification if enabled - use recipientId instead of to
          if (sendEmail) {
            const { error: emailError } = await supabase.functions.invoke('send-notification-email', {
              body: {
                recipientId: profile.user_id,
                type: 'general',
                data: {
                  userName: profile.full_name || 'Creator',
                  notificationTitle: title,
                  notificationMessage: message,
                  actionUrl: link.startsWith('/') ? `https://kretopia.com${link}` : (link || 'https://kretopia.com')
                }
              }
            });

            if (emailError) {
              console.error('Email error:', emailError);
              errorCount++;
              continue;
            }
          }

          successCount++;
        } catch (err) {
          console.error('Error sending to user:', err);
          errorCount++;
        }
      }

      toast.success(`Broadcast sent to ${successCount} users! ${errorCount > 0 ? `(${errorCount} failed)` : ''}`);
      
    } catch (error: any) {
      console.error('Error broadcasting:', error);
      toast.error(error.message || "Failed to broadcast notification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-2xl mx-auto py-8 px-4 mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Broadcast to All Users
            </CardTitle>
            <CardDescription>
              Send announcements, updates, and important messages to all platform users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Notification Title</Label>
              <Input
                id="title"
                placeholder="New Features Available!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="We've added amazing new features to help you collaborate better..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link">Action Link (optional)</Label>
              <Input
                id="link"
                placeholder="/circle"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Relative path (e.g., /circle) or full URL
              </p>
            </div>

            <div className="space-y-4 p-4 border rounded-lg">
              <p className="text-sm font-medium">Delivery Methods</p>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="in-app">In-App Notification</Label>
                  <p className="text-xs text-muted-foreground">
                    Show in notification bell
                  </p>
                </div>
                <Switch
                  id="in-app"
                  checked={sendInApp}
                  onCheckedChange={setSendInApp}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email">Email Notification</Label>
                  <p className="text-xs text-muted-foreground">
                    Send to user email address
                  </p>
                </div>
                <Switch
                  id="email"
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                />
              </div>
            </div>

            {/* Test Email Section */}
            <div className="space-y-3 p-4 border border-dashed rounded-lg bg-muted/30">
              <p className="text-sm font-medium flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Send Test Email First
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="your@email.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={sendTestEmail} 
                  disabled={testLoading}
                  variant="outline"
                >
                  {testLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send Test"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Test the email before sending to all users
              </p>
            </div>

            <Button 
              onClick={broadcastNotification} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Broadcasting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Broadcast to {userCount} Users
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              This will send to all {userCount} registered users. Test first!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminBroadcast;
