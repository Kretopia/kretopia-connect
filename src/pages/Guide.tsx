import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  User, Users, Briefcase, MessageCircle, DollarSign, Star,
  ChevronDown, ChevronUp, Lightbulb, Rocket, Target, Zap,
  CheckCircle2, ArrowRight, Shield, Camera, Palette, Globe,
  Handshake, TrendingUp, BookOpen, Award, FolderKanban
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface GuideSection {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  route?: string;
  steps: {
    emoji: string;
    title: string;
    description: string;
  }[];
  proTip?: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "profile",
    number: 1,
    title: "Build Your Profile",
    subtitle: "This is your creative resume — make it count",
    icon: <User className="h-6 w-6" />,
    color: "from-primary/20 to-primary/20",
    route: "/profile",
    steps: [
      {
        emoji: "",
        title: "Add a profile photo",
        description: "Choose a clear portrait that helps other people recognize your creative identity."
      },
      {
        emoji: "✍",
        title: "Write your bio",
        description: "2-3 sentences about what you do and what you're looking for. Be specific — \"Music producer specializing in Afrobeats\" beats \"I make music.\""
      },
      {
        emoji: "",
        title: "Add your skills",
        description: "Describe your actual skills and areas of expertise so others can understand your work."
      },
      {
        emoji: "",
        title: "Add portfolio links",
        description: "Link your best work — YouTube, SoundCloud, Behance, Instagram, personal website. Show, don't just tell."
      },
      {
        emoji: "",
        title: "Add credits & awards",
        description: "Worked on a music video? Released an album? Won a competition? Credits build trust and credibility."
      }
    ],
    proTip: "Keep your profile accurate, complete, and up to date."
  },
  {
    id: "circle",
    number: 2,
    title: "Find Your People",
    subtitle: "Discover and connect with creators who complement your skills",
    icon: <Users className="h-6 w-6" />,
    color: "from-primary/20 to-primary/20",
    route: "/discover",
    steps: [
      {
        emoji: "👆",
        title: "Explore creative profiles",
        description: "Browse creative profiles and review their work, experience, and interests."
      },
      {
        emoji: "",
        title: "Use filters",
        description: "Filter by skill, location, or availability to find exactly the type of collaborator you need."
      },
      {
        emoji: "",
        title: "Identify potential collaborators",
        description: "Explore relevant profiles and use the available connection options to build professional relationships."
      },
      {
        emoji: "",
        title: "Break the ice",
        description: "Don't just say \"hey.\" Mention something specific from their profile — \"Love your Afrobeats production on [project]!\""
      }
    ],
    proTip: "Use Discover to explore people and creative opportunities."
  },
  {
    id: "gigs",
    number: 3,
    title: "Find or Post Gigs",
    subtitle: "Browse opportunities or post your own to find talent",
    icon: <Briefcase className="h-6 w-6" />,
    color: "from-amber-500/20 to-orange-500/20",
    route: "/discover?tab=opportunities",
    steps: [
      {
        emoji: "🔍",
        title: "Browse gigs",
        description: "Review available opportunities, including their scope, requirements, and conditions."
      },
      {
        emoji: "",
        title: "Put Forward with context",
        description: "When you put yourself forward, include a cover letter and relevant portfolio links. Show why YOU are the perfect fit."
      },
      {
        emoji: "",
        title: "Post your own gig",
        description: "Need a videographer? A vocalist? Post a gig with clear requirements and budget to attract the right talent."
      },
      {
        emoji: "",
        title: "Track applications",
        description: "Manage incoming applications, review portfolios, and connect with the best candidates."
      }
    ],
    proTip: "A clear brief helps candidates understand the work before responding."
  },
  {
    id: "messages",
    number: 4,
    title: "Message & Connect",
    subtitle: "Build professional conversations and creative relationships.",
    icon: <MessageCircle className="h-6 w-6" />,
    color: "from-green-500/20 to-emerald-500/20",
    route: "/messages",
    steps: [
      {
        emoji: "",
        title: "Start conversations",
        description: "When messaging is available, introduce yourself with a relevant reference to the other person's work."
      },
      {
        emoji: "📎",
        title: "Share your work",
        description: "Send files, links, and media directly in chat to discuss potential collaborations."
      },
      {
        emoji: "",
        title: "Move to collaboration",
        description: "When you're ready to work together, create a project directly from your conversation."
      }
    ],
    proTip: "Respond within 24 hours — fast replies build trust and show professionalism."
  },
  {
    id: "projects",
    number: 5,
    title: "Collaborate on Projects",
    subtitle: "Manage your creative projects from start to finish",
    icon: <FolderKanban className="h-6 w-6" />,
    color: "from-primary/20 to-rose-500/20",
    route: "/desk",
    steps: [
      {
        emoji: "",
        title: "Create a project",
        description: "Set up a project with a title, description, timeline, and invite your collaborators."
      },
      {
        emoji: "",
        title: "Set milestones",
        description: "Break your project into milestones with deadlines. Stay organized and on track."
      },
      {
        emoji: "",
        title: "Share assets",
        description: "Upload and share files, designs, tracks, and documents. Keep everything in one place."
      },
      {
        emoji: "",
        title: "Use milestone payments",
        description: "Agree on deliverables, timelines, payment conditions, and approval steps before beginning paid work."
      }
    ],
    proTip: "Define milestones and responsibilities clearly before starting a collaboration."
  },
  {
    id: "thrivepay",
    number: 6,
    title: "Understand Payments",
    subtitle: "Review payment workflows and their applicable conditions.",
    icon: <DollarSign className="h-6 w-6" />,
    color: "from-emerald-500/20 to-teal-500/20",
    route: "/thrivepay",
    steps: [
      {
        emoji: "",
        title: "Review payment conditions",
        description: "Before committing funds or delivering work, confirm the applicable payment terms and approval process."
      },
      {
        emoji: "",
        title: "Automatic invoicing",
        description: "Professional invoices are generated automatically for every transaction. Great for taxes and records."
      },
      {
        emoji: "",
        title: "Multiple payout options",
        description: "Get paid via bank transfer, WiPay, or other supported methods. Fast and reliable."
      }
    ],
    proTip: "Review the available payment workflow and its conditions before committing funds or work."
  },
  {
    id: "credits",
    number: 7,
    title: "Build Your Credits",
    subtitle: "Document your contributions and professional experience through credits.",
    icon: <Award className="h-6 w-6" />,
    color: "from-yellow-500/20 to-amber-500/20",
    route: "/profile",
    steps: [
      {
        emoji: "",
        title: "Add project credits",
        description: "Every project you work on can be added as a credit — your role, the project name, and links to the work."
      },
      {
        emoji: "",
        title: "Request credit confirmation",
        description: "Collaborators can verify your credits, adding trust and credibility to your profile."
      },
      {
        emoji: "",
        title: "Collect endorsements",
        description: "After working together, ask collaborators to endorse your skills. Social proof matters."
      }
    ],
    proTip: "Think of credits like your creative CV — the more verified credits you have, the more opportunities come your way."
  }
];

export default function Guide() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["profile"]));
  const navigate = useNavigate();
  const { user } = useAuth();

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(GUIDE_SECTIONS.map(s => s.id)));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.08),transparent_70%)]" />
        <div className="relative max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Rocket className="h-4 w-4" />
            Your Guide to Success
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            How to Win with Kretopia
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Everything you need to know to find collaborators, land gigs, and build your creative career — step by step.
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <Button variant="outline" size="sm" onClick={expandAll}>
              <BookOpen className="h-4 w-4 mr-2" />
              Expand All
            </Button>
            {user && (
              <Button size="sm" onClick={() => navigate("/profile")}>
                <User className="h-4 w-4 mr-2" />
                Go to Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Target className="h-4 w-4" />
          <span>{GUIDE_SECTIONS.length} sections to master</span>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-2xl mx-auto px-4 mt-4 space-y-3">
        {GUIDE_SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          return (
            <Card key={section.id} className="overflow-hidden border-border/60">
              {/* Section Header - Always visible */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full text-left p-4 sm:p-5 flex items-center gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-primary",
                  section.color
                )}>
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      Step {section.number}
                    </Badge>
                  </div>
                  <h2 className="font-semibold text-base">{section.title}</h2>
                  <p className="text-sm text-muted-foreground truncate">{section.subtitle}</p>
                </div>
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <CardContent className="pt-0 pb-5 px-4 sm:px-5">
                  <Separator className="mb-4" />
                  <div className="space-y-4">
                    {section.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-lg">
                          {step.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{step.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {section.proTip && (
                    <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-primary/80 font-medium">{section.proTip}</p>
                    </div>
                  )}

                  {section.route && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-2"
                      onClick={() => navigate(section.route!)}
                    >
                      Go to {section.title.split(" ").slice(-1)}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="max-w-2xl mx-auto px-4 mt-8">
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <Zap className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-2">Ready to Thrive?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start by completing your profile — it only takes 2 minutes and opens the door to everything else.
            </p>
            <Button onClick={() => navigate(user ? "/profile" : "/auth")} className="gap-2">
              {user ? "Complete Your Profile" : "Create Your Account"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
