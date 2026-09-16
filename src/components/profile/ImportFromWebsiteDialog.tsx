import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Globe, CheckCircle2, ExternalLink, ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportFromWebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: any) => void;
}

export const ImportFromWebsiteDialog = ({ open, onOpenChange, onImport }: ImportFromWebsiteDialogProps) => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [selectedPortfolioIdx, setSelectedPortfolioIdx] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!url) {
      toast({ title: "URL Required", description: "Please enter a website URL", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-profile-url', { body: { url } });

      if (data?.isLinkedInBlock) {
        toast({
          title: "LinkedIn Restricted",
          description: data.error || "LinkedIn blocks scraping. Try another URL.",
          variant: "destructive", duration: 8000,
        });
        return;
      }

      if (error) throw error;

      if (data?.success && data.data) {
        setExtractedData(data.data);
        // Pre-select all valid portfolio items by default
        const items = data.data.portfolio_items || [];
        setSelectedPortfolioIdx(new Set(items.map((_: any, i: number) => i)));
        toast({
          title: "Found " + (items.length || 0) + " items",
          description: items.length > 0 ? "Review and uncheck anything you don't want" : "No portfolio items detected — profile fields still imported",
        });
      } else {
        throw new Error(data?.error || "Failed to extract");
      }
    } catch (error: any) {
      console.error("Error analyzing URL:", error);
      toast({
        title: "Analysis Failed",
        description: error?.message || "Could not extract from this URL",
        variant: "destructive", duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!extractedData) return;
    // Filter portfolio_items by selection
    const filtered = {
      ...extractedData,
      portfolio_items: (extractedData.portfolio_items || []).filter((_: any, i: number) => selectedPortfolioIdx.has(i)),
    };
    onImport(filtered);
    toast({ title: "Imported", description: `${filtered.portfolio_items.length} items + profile fields applied` });
    onOpenChange(false);
    setUrl("");
    setExtractedData(null);
    setSelectedPortfolioIdx(new Set());
  };

  const handleCancel = () => {
    setUrl("");
    setExtractedData(null);
    setSelectedPortfolioIdx(new Set());
    onOpenChange(false);
  };

  const toggleItem = (i: number) => {
    setSelectedPortfolioIdx(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    const items = extractedData?.portfolio_items || [];
    if (selectedPortfolioIdx.size === items.length) {
      setSelectedPortfolioIdx(new Set());
    } else {
      setSelectedPortfolioIdx(new Set(items.map((_: any, i: number) => i)));
    }
  };

  const portfolioItems = extractedData?.portfolio_items || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Import from Website
          </DialogTitle>
          <DialogDescription>
            Paste any portfolio, EPK, IMDb, Behance, or personal site URL — we'll extract the real items only
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="website-url">Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="website-url"
                type="url"
                placeholder="https://yourwebsite.com or https://imdb.com/name/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
              <Button onClick={handleAnalyze} disabled={isLoading || !url}>
                {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing</> : "Analyze"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Works with personal sites, IMDb, Behance, YouTube, Vimeo, SoundCloud, GitHub, and more
            </p>
          </div>

          {extractedData && (
            <ScrollArea className="max-h-[450px] pr-4">
              <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-energy">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Data extracted — review below</span>
                </div>

                {/* Profile fields */}
                <div className="grid grid-cols-2 gap-3">
                  {extractedData.full_name && (
                    <div><Label className="text-xs text-muted-foreground">Name</Label><p className="font-medium text-sm">{extractedData.full_name}</p></div>
                  )}
                  {extractedData.role && (
                    <div><Label className="text-xs text-muted-foreground">Role</Label><p className="font-medium text-sm">{extractedData.role}</p></div>
                  )}
                  {extractedData.location && (
                    <div className="col-span-2"><Label className="text-xs text-muted-foreground">Location</Label><p className="font-medium text-sm">{extractedData.location}</p></div>
                  )}
                  {extractedData.bio && (
                    <div className="col-span-2"><Label className="text-xs text-muted-foreground">Bio</Label><p className="text-sm line-clamp-3">{extractedData.bio}</p></div>
                  )}
                </div>

                {extractedData.skills && extractedData.skills.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Skills ({extractedData.skills.length})</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {extractedData.skills.slice(0, 10).map((skill: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                      ))}
                      {extractedData.skills.length > 10 && <Badge variant="outline" className="text-xs">+{extractedData.skills.length - 10}</Badge>}
                    </div>
                  </div>
                )}

                {/* PORTFOLIO ITEMS — checkbox grid */}
                {portfolioItems.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Portfolio Items ({selectedPortfolioIdx.size}/{portfolioItems.length} selected)
                      </Label>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={toggleAll}>
                        {selectedPortfolioIdx.size === portfolioItems.length ? "Deselect all" : "Select all"}
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {portfolioItems.map((item: any, i: number) => (
                        <label
                          key={i}
                          className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                            selectedPortfolioIdx.has(i) ? "bg-primary/5 border-primary/40" : "bg-muted/20 border-border hover:bg-muted/40"
                          }`}
                        >
                          <Checkbox
                            checked={selectedPortfolioIdx.has(i)}
                            onCheckedChange={() => toggleItem(i)}
                            className="mt-0.5"
                          />
                          {item.thumbnail_url ? (
                            <img src={item.thumbnail_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0 bg-muted" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title || "(untitled)"}</p>
                            <a
                              href={item.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-muted-foreground truncate flex items-center gap-1 hover:text-primary"
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{item.media_url}</span>
                            </a>
                            {item.media_type && (
                              <Badge variant="outline" className="mt-1 text-[10px] py-0 px-1.5 h-4">{item.media_type}</Badge>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Tip: Verify each link goes to a real piece of work. Uncheck anything that looks off.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground text-center">
                    No verified portfolio items detected. Profile fields above will still be imported.
                  </div>
                )}

                {extractedData.press_links?.length > 0 && (
                  <div><Label className="text-xs text-muted-foreground">Press Links: {extractedData.press_links.length}</Label></div>
                )}
                {extractedData.awards?.length > 0 && (
                  <div><Label className="text-xs text-muted-foreground">Awards: {extractedData.awards.length}</Label></div>
                )}
                {extractedData.credits?.length > 0 && (
                  <div><Label className="text-xs text-muted-foreground">Credits: {extractedData.credits.length}</Label></div>
                )}
              </Card>
            </ScrollArea>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            {extractedData && (
              <Button onClick={handleApply}>
                Apply {selectedPortfolioIdx.size > 0 ? `(${selectedPortfolioIdx.size} items)` : "Profile Fields"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
