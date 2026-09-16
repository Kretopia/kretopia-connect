import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ProGate } from "@/components/project/ProGate";
import { ImageIcon, FileText, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StudioAICreateProps {
  projectId: string;
  currentUserId: string;
  isPro: boolean;
}

interface UsageState {
  used: number;
  cap: number; // -1 = unlimited
}

/**
 * "Create" tab — image + copy generation, saved straight into the
 * project's real Asset Library (creative_assets), not a separate silo.
 * Usage is gated server-side (generate-studio-image/copy edge functions +
 * studio_ai_usage table) — the UsageState here just mirrors what the last
 * generation call reported, it never itself decides whether a call is
 * allowed.
 */
export const StudioAICreate = ({ projectId, currentUserId, isPro }: StudioAICreateProps) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"image" | "copy">("image");

  const [imagePrompt, setImagePrompt] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [copyPrompt, setCopyPrompt] = useState("");
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyResult, setCopyResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [usage, setUsage] = useState<UsageState | null>(null);
  const [blocked, setBlocked] = useState(false);

  const handleGenerationError = async (error: unknown) => {
    // supabase.functions.invoke() throws FunctionsHttpError with `context`
    // set to the raw, unparsed Response object for non-2xx responses — the
    // JSON body (with our `code`/`used`/`cap` fields) has to be read from
    // it. Other error subtypes (FunctionsFetchError/FunctionsRelayError,
    // thrown when the request never reaches the function at all) carry a
    // differently-shaped `context` with no `.json()` method, so this must
    // stay fully defensive rather than assuming a Response.
    const context = (error as { context?: unknown })?.context as { status?: number; json?: () => Promise<unknown> } | undefined;
    const status = context?.status;
    const body =
      context && typeof context.json === "function"
        ? ((await context.json().catch(() => null)) as { error?: string; code?: string; used?: number; cap?: number } | null)
        : null;

    if (status === 429 && body?.code === "STUDIO_AI_DAILY_LIMIT") {
      setBlocked(true);
      if (typeof body.used === "number" && typeof body.cap === "number") {
        setUsage({ used: body.used, cap: body.cap });
      }
      return;
    }
    if (status === 402) {
      toast({
        title: "Out of AI credits",
        description: "The AI generation service is temporarily out of credits. Try again later.",
        variant: "destructive",
      });
      return;
    }
    const message = error instanceof Error ? error.message : undefined;
    toast({
      title: "Generation failed",
      description: body?.error || message || "Something went wrong. Try again.",
      variant: "destructive",
    });
  };

  const generateImage = async () => {
    if (!imagePrompt.trim() || blocked) return;
    setGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-studio-image", {
        body: { project_id: projectId, prompt: imagePrompt.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setImagePreviewUrl(data.previewUrl);
      if (typeof data.used === "number" && typeof data.cap === "number") {
        setUsage({ used: data.used, cap: data.cap });
      }
      toast({ title: "Image saved", description: "Added to this project's Assets." });
    } catch (err) {
      await handleGenerationError(err);
    } finally {
      setGeneratingImage(false);
    }
  };

  const generateCopy = async () => {
    if (!copyPrompt.trim() || blocked) return;
    setGeneratingCopy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-studio-copy", {
        body: { project_id: projectId, prompt: copyPrompt.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCopyResult(data.text);
      if (typeof data.used === "number" && typeof data.cap === "number") {
        setUsage({ used: data.used, cap: data.cap });
      }
      toast({ title: "Copy saved", description: "Added to this project's Assets." });
    } catch (err) {
      await handleGenerationError(err);
    } finally {
      setGeneratingCopy(false);
    }
  };

  const copyToClipboard = () => {
    if (!copyResult) return;
    navigator.clipboard.writeText(copyResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usageLabel =
    usage && usage.cap !== -1 ? `${usage.used}/${usage.cap} today` : usage?.cap === -1 ? "Unlimited" : null;

  const content = (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Create
          {usageLabel && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {usageLabel}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "image" | "copy")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="image" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> Image
            </TabsTrigger>
            <TabsTrigger value="copy" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Copy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Describe the image you want — cover art, a reference, a visual for the project.
            </p>
            <Textarea
              placeholder="e.g. Moody backstage photo of a band before a show, warm stage lights..."
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={3}
            />
            <Button onClick={generateImage} disabled={generatingImage || !imagePrompt.trim() || blocked} className="w-full gap-2">
              {generatingImage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating Image...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate Image
                </>
              )}
            </Button>
            {imagePreviewUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={imagePreviewUrl} alt={imagePrompt} className="w-full max-h-80 object-contain bg-muted" />
              </div>
            )}
          </TabsContent>

          <TabsContent value="copy" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Describe what you need — a caption, a pitch, a short script — and Kreto will draft it.
            </p>
            <Textarea
              placeholder="e.g. A punchy Instagram caption announcing this project is wrapped..."
              value={copyPrompt}
              onChange={(e) => setCopyPrompt(e.target.value)}
              rows={3}
            />
            <Button onClick={generateCopy} disabled={generatingCopy || !copyPrompt.trim() || blocked} className="w-full gap-2">
              {generatingCopy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating Copy...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate Copy
                </>
              )}
            </Button>
            {copyResult && (
              <div className="space-y-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {copyResult}
                </div>
                <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-2">
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy to clipboard
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  if (blocked && !isPro) {
    return (
      <ProGate feature="AI Create" description="Upgrade to Pro for unlimited AI image and copy generation." isPro={isPro}>
        {content}
      </ProGate>
    );
  }

  return content;
};
