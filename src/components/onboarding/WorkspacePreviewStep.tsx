import { Card } from "@/components/ui/card";
import { Shield, MessageSquare, CheckSquare, FileText, Clock, DollarSign, Users, Zap } from "lucide-react";

export const WorkspacePreviewStep = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">See Where Your Projects Happen</h2>
        <p className="text-muted-foreground">
          When you match with someone, you get instant access to your complete workspace
        </p>
      </div>

      {/* Preview mockup */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <h3 className="font-semibold text-lg">Your Project Workspace</h3>
              <p className="text-sm text-muted-foreground">Everything in one place</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-secondary" />
              </div>
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
              <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Real-time Chat</p>
                <p className="text-xs text-muted-foreground">Instant messaging built-in</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
              <CheckSquare className="h-5 w-5 text-secondary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Task Board</p>
                <p className="text-xs text-muted-foreground">Track all deliverables</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
              <FileText className="h-5 w-5 text-accent mt-0.5" />
              <div>
                <p className="font-medium text-sm">File Sharing</p>
                <p className="text-xs text-muted-foreground">Secure uploads & storage</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Time Tracking</p>
                <p className="text-xs text-muted-foreground">Log hours automatically</p>
              </div>
            </div>
          </div>

          {/* Payment protection highlight */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <Shield className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                  Payment Protection Included
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">Protected</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Funds held safely in escrow until work is approved. Both sides protected with milestone-based releases.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Key benefits */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <Zap className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="font-medium text-sm">No Setup Needed</p>
          <p className="text-xs text-muted-foreground mt-1">Created instantly when you match</p>
        </Card>
        <Card className="p-4 text-center">
          <DollarSign className="h-8 w-8 text-secondary mx-auto mb-2" />
          <p className="font-medium text-sm">Safe Payments</p>
          <p className="text-xs text-muted-foreground mt-1">Escrow protection built-in</p>
        </Card>
        <Card className="p-4 text-center">
          <Users className="h-8 w-8 text-accent mx-auto mb-2" />
          <p className="font-medium text-sm">Invite Anyone</p>
          <p className="text-xs text-muted-foreground mt-1">Add team members anytime</p>
        </Card>
      </div>

      <div className="text-center pt-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">No more juggling tools.</span>
          {" "}Everything you need to collaborate professionally.
        </p>
      </div>
    </div>
  );
};
