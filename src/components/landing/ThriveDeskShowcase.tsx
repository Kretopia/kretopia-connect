import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Shield, MessageSquare, FileText, CreditCard, Clock, Users, ArrowRight } from "lucide-react";

export const ThriveDeskShowcase = () => {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Shield className="h-4 w-4" />
            <span>Your Complete Workspace</span>
          </div>
          <h2 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
            Where Your Projects{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Actually Happen
            </span>
          </h2>
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Stop juggling Slack, Trello, Google Drive, and PayPal. Your complete collaboration workspace with built-in payment protection.
          </p>
        </div>

        {/* Split comparison */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Before - The old way */}
          <Card className="p-8 border-2 border-muted">
            <h3 className="text-2xl font-bold mb-6 text-muted-foreground">The Old Way 😓</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 opacity-60">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">1</div>
                <div>
                  <p className="font-medium">Match on platform</p>
                  <p className="text-sm text-muted-foreground">Then move to email</p>
                </div>
              </div>
              <div className="flex items-start gap-3 opacity-60">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">2</div>
                <div>
                  <p className="font-medium">Set up Slack/Discord</p>
                  <p className="text-sm text-muted-foreground">Another login to manage</p>
                </div>
              </div>
              <div className="flex items-start gap-3 opacity-60">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">3</div>
                <div>
                  <p className="font-medium">Create Trello board</p>
                  <p className="text-sm text-muted-foreground">Share access, set permissions</p>
                </div>
              </div>
              <div className="flex items-start gap-3 opacity-60">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">4</div>
                <div>
                  <p className="font-medium">Share Google Drive folder</p>
                  <p className="text-sm text-muted-foreground">Hope they have storage space</p>
                </div>
              </div>
              <div className="flex items-start gap-3 opacity-60">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">5</div>
                <div>
                  <p className="font-medium">Send PayPal invoice</p>
                  <p className="text-sm text-muted-foreground">No protection if things go wrong</p>
                </div>
              </div>
            </div>
          </Card>

          {/* After - Project Workspace */}
          <Card className="p-8 border-2 border-primary bg-gradient-to-br from-primary/5 to-secondary/5 shadow-glow">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span>Project Workspace</span>
              <span className="text-primary"></span>
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium">Match & Start Instantly</p>
                  <p className="text-sm text-muted-foreground">Workspace created automatically</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium">Built-in Real-time Chat</p>
                  <p className="text-sm text-muted-foreground">No extra apps needed</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium">Task Board & Milestones</p>
                  <p className="text-sm text-muted-foreground">Track progress visually</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium">Secure File Sharing</p>
                  <p className="text-sm text-muted-foreground">Included in your workspace</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium">Escrow Payment Protection</p>
                  <p className="text-sm text-muted-foreground">Funds released at milestones</p>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-semibold text-primary">Everything in one place. No drama. No extra costs.</p>
            </div>
          </Card>
        </div>

        {/* Key Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 hover:shadow-glow transition-smooth">
            <Shield className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold mb-2">Escrow Protection</h3>
            <p className="text-sm text-muted-foreground">
              Payments held safely until work is approved. Both sides protected.
            </p>
          </Card>
          <Card className="p-6 hover:shadow-glow transition-smooth">
            <Clock className="h-8 w-8 text-secondary mb-4" />
            <h3 className="font-semibold mb-2">Time Tracking Built-In</h3>
            <p className="text-sm text-muted-foreground">
              Track hours automatically. Generate invoices with one click.
            </p>
          </Card>
          <Card className="p-6 hover:shadow-glow transition-smooth">
            <Users className="h-8 w-8 text-accent mb-4" />
            <h3 className="font-semibold mb-2">Real-time Collaboration</h3>
            <p className="text-sm text-muted-foreground">
              See who's online. Chat instantly. Work together seamlessly.
            </p>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link to="/auth">
            <Button size="xl" className="shadow-glow">
              Start Your First Protected Project
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required • Free workspace included
          </p>
        </div>
      </div>
    </section>
  );
};
