import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Copy, Check, Crown, Sparkles, ExternalLink, Globe, Shield, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { APP_URL } from "@/lib/constants";

interface EmbeddableCreditsWidgetProps {
  userId: string;
  displayName: string;
  thriveId?: string;
  creditCount: number;
  topCredits?: Array<{ project_name: string; role: string; verification_status?: string }>;
}

export function EmbeddableCreditsWidget({ userId, displayName, thriveId, creditCount, topCredits = [] }: EmbeddableCreditsWidgetProps) {
  const { subscriptionInfo } = useAuth();
  const isPro = hasProAccess(subscriptionInfo.tier as any);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = APP_URL;
  const profileUrl = `${baseUrl}/epk/${userId}`;

  const embedHtml = `<!-- Kretopia Credits Widget -->
<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;max-width:360px;font-family:system-ui,-apple-system,sans-serif;background:#fafafa">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
    <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center">
      <span style="color:white;font-weight:bold;font-size:16px">${displayName.charAt(0)}</span>
    </div>
    <div>
      <div style="font-weight:600;font-size:15px">${displayName}</div>
      ${thriveId ? `<div style="font-size:11px;color:#6b7280;font-family:monospace">${thriveId}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
    <span style="font-size:24px;font-weight:700">${creditCount}</span>
    <span style="font-size:13px;color:#6b7280">Verified Credits</span>
  </div>
  ${topCredits.slice(0, 3).map(c => `<div style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:13px"><strong>${c.project_name}</strong> · ${c.role}</div>`).join('\n  ')}
  <a href="${profileUrl}" target="_blank" rel="noopener" style="display:block;text-align:center;padding:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-top:12px">View Full Credits on Kretopia</a>
</div>`;

  // Shields.io is a real, working badge host — unlike a Kretopia-hosted
  // /api/badge endpoint (which doesn't exist), this renders correctly
  // wherever it's pasted. Shared by both the Markdown and Badge tabs so
  // there's only one badge image URL to keep working.
  const badgeUrl = `${profileUrl}`;
  const badgeImageUrl = `https://img.shields.io/badge/Kretopia-${creditCount}%20Credits-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyTDkuMTkgOC42MyAyIDkuMjRsNS4xOCA1LjA5TDUuODIgMjJMMTIgMTguMjcgMTguMTggMjJsLTEuMzYtNy42N0wyMiA5LjI0bC03LjE5LS42MXoiLz48L3N2Zz4=`;

  const embedMarkdown = `[![Kretopia Credits](${badgeImageUrl})](${profileUrl})

**${displayName}** · ${creditCount} Verified Credits
${topCredits.slice(0, 3).map(c => `- **${c.project_name}** — ${c.role}`).join('\n')}

[View Full Credits →](${profileUrl})`;

  const badgeMarkdown = `[![Verified on Kretopia](${badgeImageUrl})](${badgeUrl})`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  // Gate: Pro only
  if (!isPro) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardContent className="p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold mb-2">Embeddable Credits Widget</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Showcase your verified Stamps on your website, portfolio, or LinkedIn. Creator feature.
          </p>
          <Button onClick={() => navigate("/subscription")} className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold gap-2">
            <Sparkles className="h-4 w-4" />
            Upgrade to Creator — $29/mo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Code className="h-5 w-5 text-primary" />
          Embed Your Credits
          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">PRO</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Share your verified credits on your website, portfolio, or social profiles.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="border border-border rounded-xl p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Preview</p>
          <div className="border border-border rounded-xl p-5 bg-card max-w-[360px] mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-primary-foreground font-bold">{displayName.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-sm">{displayName}</p>
                {thriveId && <p className="text-[11px] text-muted-foreground font-mono">{thriveId}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl font-bold">{creditCount}</span>
              <span className="text-sm text-muted-foreground">Verified Credits</span>
            </div>
            {topCredits.slice(0, 3).map((c, i) => (
              <div key={i} className="py-2 border-t border-border text-sm flex items-center gap-2">
                {c.verification_status === 'verified' && <Shield className="h-3 w-3 text-primary shrink-0" />}
                <span><strong>{c.project_name}</strong> · {c.role}</span>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent rounded-lg text-primary-foreground text-sm font-semibold">
              <Globe className="h-4 w-4" />
              View Full Credits on Kretopia
            </div>
          </div>
        </div>

        {/* Code Tabs */}
        <Tabs defaultValue="html" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="html" className="flex-1">HTML Embed</TabsTrigger>
            <TabsTrigger value="markdown" className="flex-1">Markdown</TabsTrigger>
            <TabsTrigger value="badge" className="flex-1">Badge</TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="space-y-2">
            <Label className="text-xs text-muted-foreground">Paste this HTML into your website</Label>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
                {embedHtml}
              </pre>
              <Button
                size="sm" variant="ghost"
                className="absolute top-2 right-2 h-7 w-7 p-0"
                onClick={() => handleCopy(embedHtml, "HTML embed")}
              >
                {copied === "HTML embed" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="markdown" className="space-y-2">
            <Label className="text-xs text-muted-foreground">For GitHub, Notion, or any Markdown-supported platform</Label>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
                {embedMarkdown}
              </pre>
              <Button
                size="sm" variant="ghost"
                className="absolute top-2 right-2 h-7 w-7 p-0"
                onClick={() => handleCopy(embedMarkdown, "Markdown")}
              >
                {copied === "Markdown" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="badge" className="space-y-2">
            <Label className="text-xs text-muted-foreground">Shield.io badge for GitHub READMEs & portfolios</Label>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
                {badgeMarkdown}
              </pre>
              <Button
                size="sm" variant="ghost"
                className="absolute top-2 right-2 h-7 w-7 p-0"
                onClick={() => handleCopy(badgeMarkdown, "Badge")}
              >
                {copied === "Badge" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Direct Link */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Direct profile link</Label>
          <div className="flex gap-2">
            <Input value={profileUrl} readOnly className="text-xs font-mono" />
            <Button size="sm" variant="outline" onClick={() => handleCopy(profileUrl, "Profile link")}>
              {copied === "Profile link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(profileUrl, '_blank')}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
